<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import Button from '@/lib/components/Button.svelte'
  import type { Palette } from '@/lib/domain'
  import { projectStore } from '@/lib/stores/project.svelte'
  import { uiStore } from '@/lib/stores/ui.svelte'
  import { ImageRenderer } from './renderer'

  let {
    bitmap,
    palette = null,
    blur = 0,
    maxColors = 16,
  }: {
    bitmap: ImageBitmap | null
    palette?: Palette | null
    blur?: number
    maxColors?: number
  } = $props()

  let showQuantized = $state(true)
  let underpaint = $state(false)
  let host: HTMLDivElement | undefined = $state()
  let canvas: HTMLCanvasElement | undefined = $state()
  let fallback: HTMLCanvasElement | undefined = $state()
  let renderer = new ImageRenderer()
  let ready = $state(false)
  let unsupported = $state(false)
  const canRemap = $derived(Boolean(ready && bitmap))
  let inspect = $state<'none' | 'fade' | 'silhouette'>('none')
  let shiftHeld = $state(false)
  let dragging = false
  let didDrag = false
  let lastX = 0
  let lastY = 0
  let pointerStartX = 0
  let pointerStartY = 0
  let lastPointer: { clientX: number; clientY: number } | null = null
  let themeQuery: MediaQueryList | undefined

  onMount(async () => {
    const gpuCanvas = canvas
    if (!gpuCanvas) return
    const ok = await renderer.init(gpuCanvas)
    renderer.onPalette = (clusters) => {
      void projectStore.setGpuPalette(clusters)
    }
    renderer.onDynamicRange = (range) => {
      projectStore.setImageDynamicRange(range)
    }
    ready = ok
    unsupported = !ok
    applyThemeBackground()
    themeQuery = window.matchMedia('(prefers-color-scheme: light)')
    themeQuery.addEventListener('change', applyThemeBackground)
    window.addEventListener('keydown', onShiftKey)
    window.addEventListener('keyup', onShiftKey)
    window.addEventListener('blur', onWindowBlur)
    if (ok) {
      syncSize()
      if (bitmap) renderer.setImage(bitmap)
    } else {
      drawFallback()
    }
  })

  onDestroy(() => {
    renderer.onPalette = null
    renderer.onDynamicRange = null
    themeQuery?.removeEventListener('change', applyThemeBackground)
    window.removeEventListener('keydown', onShiftKey)
    window.removeEventListener('keyup', onShiftKey)
    window.removeEventListener('blur', onWindowBlur)
    renderer.dispose()
  })

  $effect(() => {
    const el = host
    if (!(el instanceof Element)) return
    const observer = new ResizeObserver(() => {
      if (ready) syncSize()
      else drawFallback()
    })
    observer.observe(el)
    return () => observer.disconnect()
  })

  $effect(() => {
    if (ready) {
      if (bitmap) renderer.setImage(bitmap)
      else renderer.clearImage()
    } else {
      drawFallback()
    }
  })

  $effect(() => {
    if (!ready) return
    renderer.setBlur(blur)
  })

  $effect(() => {
    if (!ready) return
    renderer.setMaxColors(maxColors)
  })

  $effect(() => {
    if (!ready) return
    renderer.setRemap(showQuantized)
  })

  $effect(() => {
    if (!ready) return
    renderer.setUnderpaint(underpaint)
  })

  $effect(() => {
    bitmap
    if (!ready) return
    renderer.setHighlight(null, 'none')
    inspect = 'none'
  })

  function pageBackground(): { hex: string; r: number; g: number; b: number } {
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--ink-950').trim() || '#12110f'
    const match = /^#([0-9a-f]{6})$/i.exec(hex)
    if (!match) return { hex: '#12110f', r: 0.07, g: 0.066, b: 0.06 }
    const n = Number.parseInt(match[1], 16)
    return {
      hex,
      r: ((n >> 16) & 255) / 255,
      g: ((n >> 8) & 255) / 255,
      b: (n & 255) / 255,
    }
  }

  function applyThemeBackground(): void {
    const { r, g, b } = pageBackground()
    if (ready) renderer.setBackground(r, g, b)
    else drawFallback()
  }

  function syncSize(): void {
    if (!host) return
    const rect = host.getBoundingClientRect()
    renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1)
  }

  function drawFallback(): void {
    if (!fallback || !host) return
    const rect = host.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    fallback.width = Math.max(1, Math.floor(rect.width * dpr))
    fallback.height = Math.max(1, Math.floor(rect.height * dpr))
    const ctx =
      fallback.getContext('2d', { colorSpace: 'display-p3' }) ?? fallback.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = pageBackground().hex
    ctx.fillRect(0, 0, fallback.width, fallback.height)
    if (!bitmap) return
    const scale = Math.min(fallback.width / bitmap.width, fallback.height / bitmap.height)
    const w = bitmap.width * scale
    const h = bitmap.height * scale
    ctx.drawImage(bitmap, (fallback.width - w) / 2, (fallback.height - h) / 2, w, h)
  }

  function canvasScale(rect: DOMRectReadOnly): { sx: number; sy: number } {
    return {
      sx: renderer.canvasWidth / rect.width,
      sy: renderer.canvasHeight / rect.height,
    }
  }

  function canvasPoint(event: { clientX: number; clientY: number }): { x: number; y: number } | null {
    if (!canvas || renderer.canvasWidth === 0 || renderer.canvasHeight === 0) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const { sx, sy } = canvasScale(rect)
    return {
      x: (event.clientX - rect.left) * sx,
      y: (event.clientY - rect.top) * sy,
    }
  }

  function pickAt(event: { clientX: number; clientY: number }): number | null {
    const point = canvasPoint(event)
    if (!point) return null
    return renderer.pickPaletteIndex(point.x, point.y)
  }

  function clearFade(): void {
    if (inspect !== 'fade') return
    renderer.setHighlight(null, 'none')
    inspect = 'none'
  }

  function updateHover(point: { clientX: number; clientY: number }): void {
    if (!ready || !canRemap || inspect === 'silhouette' || dragging || !shiftHeld) {
      if (!shiftHeld) clearFade()
      return
    }
    const index = pickAt(point)
    if (index == null) {
      clearFade()
      return
    }
    renderer.setHighlight(index, 'fade')
    inspect = 'fade'
  }

  function onShiftKey(event: KeyboardEvent): void {
    if (event.key !== 'Shift') return
    const held = event.type === 'keydown'
    if (held === shiftHeld) return
    shiftHeld = held
    if (held && lastPointer) updateHover(lastPointer)
    else clearFade()
  }

  function onWindowBlur(): void {
    shiftHeld = false
    clearFade()
  }

  function onPointerDown(event: PointerEvent): void {
    if (!ready) return
    dragging = true
    didDrag = false
    lastX = event.clientX
    lastY = event.clientY
    pointerStartX = event.clientX
    pointerStartY = event.clientY
    canvas?.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent): void {
    if (dragging) {
      if (Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) > 4) {
        didDrag = true
      }
      const rect = canvas?.getBoundingClientRect()
      const { sx, sy } = rect && rect.width > 0 && rect.height > 0 ? canvasScale(rect) : { sx: 1, sy: 1 }
      renderer.setView(
        renderer.panX + (event.clientX - lastX) * sx,
        renderer.panY + (event.clientY - lastY) * sy,
        renderer.zoom,
      )
      lastX = event.clientX
      lastY = event.clientY
      return
    }
    lastPointer = { clientX: event.clientX, clientY: event.clientY }
    updateHover(lastPointer)
  }

  function onPointerUp(event: PointerEvent): void {
    dragging = false
    canvas?.releasePointerCapture(event.pointerId)
    if (!ready || !canRemap || didDrag) return
    if (inspect === 'silhouette') {
      renderer.setHighlight(null, 'none')
      inspect = 'none'
      return
    }
    const index = pickAt(event)
    if (index == null) return
    renderer.setHighlight(index, 'silhouette')
    inspect = 'silhouette'
    const id = palette?.colors[index]?.id
    if (id) uiStore.selectColor(id)
  }

  function onPointerCancel(event: PointerEvent): void {
    dragging = false
    didDrag = true
    canvas?.releasePointerCapture(event.pointerId)
  }

  function onPointerLeave(): void {
    lastPointer = null
    clearFade()
  }

  function onWheel(event: WheelEvent): void {
    if (!ready) return
    event.preventDefault()
    const point = canvasPoint(event)
    if (!point) return
    const factor = event.deltaY > 0 ? 0.92 : 1.08
    renderer.zoomAt(point.x, point.y, factor)
  }
</script>

<div bind:this={host} class="relative h-full min-h-0 w-full overflow-hidden bg-ink-950">
  <canvas
    bind:this={canvas}
    class="block h-full w-full active:cursor-grabbing"
    class:cursor-crosshair={canRemap && shiftHeld}
    class:cursor-grab={!canRemap || !shiftHeld}
    class:hidden={unsupported}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerCancel}
    onpointerleave={onPointerLeave}
    onwheel={onWheel}
  ></canvas>

  {#if unsupported}
    <canvas bind:this={fallback} class="block h-full w-full"></canvas>
    <p class="absolute bottom-3 left-3 font-mono text-10px tracking-wide text-paper-500 uppercase">
      WebGPU unavailable — 2D fallback.
    </p>
  {/if}

  {#if !bitmap && !unsupported}
    <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
      <p class="font-mono text-11px tracking-[0.18em] text-paper-500 uppercase">No plate</p>
    </div>
  {/if}

  {#if ready && bitmap}
    <div class="pointer-events-none absolute bottom-3 left-3 font-mono text-10px tracking-wide text-paper-500">
      shift isolate · click silhouette · scroll zoom · drag pan
    </div>
    <div class="absolute right-3 bottom-3 flex items-center gap-2">
      <label
        class="flex cursor-pointer items-center gap-1.5 border border-ink-500 bg-ink-800 px-2 py-1 font-mono text-10px tracking-wide text-paper-300 uppercase select-none hover:border-brass hover:text-paper-50"
        class:border-umber={underpaint}
        class:text-paper-50={underpaint}
        title="Burnt umber value study for underpainting"
      >
        <input bind:checked={underpaint} class="check" type="checkbox" />
        Underpaint
      </label>
      {#if canRemap}
        <Button
          class={showQuantized ? 'border-brass text-brass' : ''}
          onclick={() => {
            showQuantized = !showQuantized
          }}
          size="sm"
        >
          {showQuantized ? 'Quantized' : 'Original'}
        </Button>
      {/if}
      <Button onclick={() => renderer.fit()} size="sm">
        Fit
      </Button>
    </div>
  {/if}
</div>
