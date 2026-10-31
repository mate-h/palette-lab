import type { Lab } from '@/lib/color'
import type { ImageDynamicRange } from '@/lib/domain'
import { MAX_BLUR, MIN_BLUR } from '@/lib/domain'
import { GpuCelebiQuantizer, type GpuCluster } from '@/lib/features/quantization'
import { canvasToImagePixel, nearestPaletteIndex, sampleGaussian, zoomAroundPoint, ZOOM_MAX, ZOOM_MIN, type ImageView } from './pick'
import blurSource from './blur.wgsl?raw'
import shaderSource from './display.wgsl?raw'

const UNIFORM_SIZE = 64
const BLUR_UNIFORM_SIZE = 32
const PALETTE_DEBOUNCE_MS = 150
const DEFAULT_BG = { r: 0.07, g: 0.066, b: 0.06, a: 1 }

export type HighlightMode = 'none' | 'fade' | 'silhouette'

export class ImageRenderer {
  private device: GPUDevice | null = null
  private context: GPUCanvasContext | null = null
  private pipeline: GPURenderPipeline | null = null
  private blurPipeline: GPURenderPipeline | null = null
  private sampler: GPUSampler | null = null
  private texture: GPUTexture | null = null
  private ping: GPUTexture | null = null
  private pong: GPUTexture | null = null
  private uniformBuffer: GPUBuffer | null = null
  private blurUniformH: GPUBuffer | null = null
  private blurUniformV: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private format: GPUTextureFormat | null = null
  private canvas: HTMLCanvasElement | null = null
  private quantizer = new GpuCelebiQuantizer()
  private lastBitmap: ImageBitmap | null = null
  private quantizeRunning = false
  private quantizeQueued = false
  private paletteTimer = 0
  private pendingClusters: GpuCluster[] | null = null
  private remap = 1
  private underpaint = 0
  private blur = 0
  private maxColors = 16

  panX = 0
  panY = 0
  zoom = 1
  imageWidth = 1
  imageHeight = 1
  canvasWidth = 1
  canvasHeight = 1
  onPalette: ((clusters: GpuCluster[]) => void) | null = null
  onDynamicRange: ((range: ImageDynamicRange) => void) | null = null
  hdrOutput = false
  private clearColor = { ...DEFAULT_BG }
  private pixels: Uint8ClampedArray | null = null
  private labs: Lab[] = []
  private highlightIndex = -1
  private highlightMode = 0
  private canvasConfig: GPUCanvasConfiguration | null = null
  private imageGen = 0

  async init(canvas: HTMLCanvasElement): Promise<boolean> {
    if (!navigator.gpu) return false
    try {
      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) return false
      const device = await adapter.requestDevice()
      const context = canvas.getContext('webgpu')
      if (!context) return false

      const { format, hdr } = configureCanvas(context, device)

      const displayModule = device.createShaderModule({ code: shaderSource })
      const blurModule = device.createShaderModule({ code: blurSource })
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: displayModule, entryPoint: 'vs' },
        fragment: { module: displayModule, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      })
      const blurPipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: blurModule, entryPoint: 'vs' },
        fragment: {
          module: blurModule,
          entryPoint: 'fs',
          targets: [{ format: 'rgba16float' }],
        },
        primitive: { topology: 'triangle-list' },
      })

      this.canvas = canvas
      this.device = device
      this.context = context
      this.pipeline = pipeline
      this.blurPipeline = blurPipeline
      this.format = format
      this.hdrOutput = hdr
      this.canvasConfig = { device, format, alphaMode: 'opaque' }
      if (hdr) {
        this.canvasConfig.colorSpace = 'display-p3'
        this.canvasConfig.toneMapping = { mode: 'extended' }
      }
      this.sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' })
      this.uniformBuffer = device.createBuffer({
        size: UNIFORM_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
      this.blurUniformH = device.createBuffer({
        size: BLUR_UNIFORM_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
      this.blurUniformV = device.createBuffer({
        size: BLUR_UNIFORM_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
      this.quantizer.init(device)
      return true
    } catch {
      return false
    }
  }

  setImage(bitmap: ImageBitmap): void {
    if (!this.device) return
    if (this.lastBitmap === bitmap && this.texture) return
    this.lastBitmap = bitmap
    this.texture?.destroy()
    this.imageWidth = bitmap.width
    this.imageHeight = bitmap.height
    const texture = this.device.createTexture({
      size: [bitmap.width, bitmap.height],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    })
    try {
      this.device.queue.copyExternalImageToTexture(
        { source: bitmap },
        { texture, colorSpace: 'display-p3' },
        [bitmap.width, bitmap.height],
      )
    } catch {
      this.device.queue.copyExternalImageToTexture({ source: bitmap }, { texture }, [
        bitmap.width,
        bitmap.height,
      ])
    }
    this.texture = texture
    this.ensureScratch(bitmap.width, bitmap.height)
    this.pixels = readBitmapPixels(bitmap)
    this.highlightIndex = -1
    this.highlightMode = 0
    this.fit()
    this.scheduleQuantize()
    const gen = ++this.imageGen
    void this.probeDynamicRange(texture, gen)
  }

  clearImage(): void {
    this.imageGen += 1
    this.lastBitmap = null
    this.texture?.destroy()
    this.ping?.destroy()
    this.pong?.destroy()
    this.texture = null
    this.ping = null
    this.pong = null
    this.bindGroup = null
    this.pixels = null
    this.labs = []
    this.imageWidth = 1
    this.imageHeight = 1
    this.quantizeQueued = false
    this.setHighlight(null, 'none')
    this.fit()
  }

  setBlur(sigma: number): void {
    const next = Math.min(MAX_BLUR, Math.max(MIN_BLUR, sigma))
    if (next === this.blur) return
    this.blur = next
    this.scheduleQuantize()
    this.render()
  }

  setMaxColors(maxColors: number): void {
    const next = Math.min(128, Math.max(2, Math.round(maxColors)))
    if (next === this.maxColors) return
    this.maxColors = next
    this.quantizer.setMaxColors(next)
    this.scheduleQuantize()
    this.render()
  }

  setRemap(enabled: boolean): void {
    const next = enabled ? 1 : 0
    if (next === this.remap) return
    this.remap = next
    this.render()
  }

  setUnderpaint(enabled: boolean): void {
    const next = enabled ? 1 : 0
    if (next === this.underpaint) return
    this.underpaint = next
    this.render()
  }

  setBackground(r: number, g: number, b: number): void {
    this.clearColor = { r, g, b, a: 1 }
    this.render()
  }

  setHighlight(index: number | null, mode: HighlightMode): void {
    const nextMode = mode === 'fade' ? 1 : mode === 'silhouette' ? 2 : 0
    const nextIndex = nextMode === 0 || index == null ? -1 : index
    if (nextMode === this.highlightMode && nextIndex === this.highlightIndex) return
    this.highlightMode = nextMode
    this.highlightIndex = nextIndex
    this.render()
  }

  pickPaletteIndex(canvasX: number, canvasY: number): number | null {
    if (!this.pixels || this.labs.length === 0) return null
    const img = canvasToImagePixel(canvasX, canvasY, this.view())
    if (!img) return null
    const sample = sampleGaussian(
      this.pixels,
      this.imageWidth,
      this.imageHeight,
      img.x,
      img.y,
      this.blur,
    )
    const index = nearestPaletteIndex(sample.r, sample.g, sample.b, this.labs)
    return index < 0 ? null : index
  }

  setView(panX: number, panY: number, zoom: number): void {
    this.panX = panX
    this.panY = panY
    this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom))
    this.render()
  }

  zoomAt(canvasX: number, canvasY: number, factor: number): void {
    const next = zoomAroundPoint(this.view(), canvasX, canvasY, this.zoom * factor)
    this.setView(next.panX, next.panY, next.zoom)
  }

  view(): ImageView {
    return {
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      imageWidth: this.imageWidth,
      imageHeight: this.imageHeight,
      panX: this.panX,
      panY: this.panY,
      zoom: this.zoom,
    }
  }

  fit(): void {
    this.panX = 0
    this.panY = 0
    this.zoom = 1
    this.render()
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    if (!this.canvas || !this.context || !this.device || !this.format || !this.canvasConfig) return
    const width = Math.max(1, Math.floor(cssWidth * dpr))
    const height = Math.max(1, Math.floor(cssHeight * dpr))
    if (width === this.canvasWidth && height === this.canvasHeight) return
    this.canvas.width = width
    this.canvas.height = height
    this.canvasWidth = width
    this.canvasHeight = height
    this.context.configure(this.canvasConfig)
    this.render()
  }

  render(): void {
    if (!this.device || !this.context || !this.pipeline || !this.uniformBuffer) return
    const { r, g, b, a } = this.clearColor
    const data = new ArrayBuffer(UNIFORM_SIZE)
    const floats = new Float32Array(data)
    floats.set([
      this.panX,
      this.panY,
      this.zoom,
      0,
      this.canvasWidth,
      this.canvasHeight,
      this.imageWidth,
      this.imageHeight,
      r,
      g,
      b,
      a,
    ])
    const view = new DataView(data)
    view.setInt32(48, this.highlightIndex, true)
    view.setUint32(52, this.highlightMode, true)
    view.setUint32(56, (this.remap ? 1 : 0) | (this.underpaint ? 2 : 0), true)
    view.setUint32(60, this.hdrOutput ? 1 : 0, true)
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data)

    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: this.hdrOutput ? srgbEncodedToLinearP3(this.clearColor) : this.clearColor,
        },
      ],
    })
    pass.setPipeline(this.pipeline)
    if (this.bindGroup) {
      pass.setBindGroup(0, this.bindGroup)
      pass.draw(3)
    }
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  dispose(): void {
    if (this.paletteTimer) window.clearTimeout(this.paletteTimer)
    this.quantizer.dispose()
    this.texture?.destroy()
    this.ping?.destroy()
    this.pong?.destroy()
    this.uniformBuffer?.destroy()
    this.blurUniformH?.destroy()
    this.blurUniformV?.destroy()
    this.device?.destroy()
    this.texture = null
    this.ping = null
    this.pong = null
    this.uniformBuffer = null
    this.blurUniformH = null
    this.blurUniformV = null
    this.device = null
    this.context = null
    this.pipeline = null
    this.blurPipeline = null
  }

  private scheduleQuantize(): void {
    if (!this.texture || !this.device) return
    if (this.quantizeRunning) {
      this.quantizeQueued = true
      return
    }
    this.runQuantize()
  }

  private runQuantize(): void {
    if (!this.device || !this.texture) return
    this.quantizeRunning = true
    this.quantizeQueued = false

    const encoder = this.device.createCommandEncoder()
    const view = this.blurAndQuantize(encoder)
    this.rebuildBindGroup(view)
    this.device.queue.submit([encoder.finish()])
    this.render()
    void this.finishQuantize()
  }

  private async finishQuantize(): Promise<void> {
    try {
      const clusters = await this.quantizer.readClusters()
      if (clusters) {
        this.labs = clusters.map((cluster) => cluster.lab)
        this.pendingClusters = clusters
      }
    } finally {
      this.quantizeRunning = false
      if (this.quantizeQueued) this.scheduleQuantize()
      else this.flushPaletteSoon()
    }
  }

  private flushPaletteSoon(): void {
    if (this.paletteTimer) return
    this.paletteTimer = window.setTimeout(() => {
      this.paletteTimer = 0
      if (this.quantizeRunning || this.quantizeQueued) return
      const next = this.pendingClusters
      this.pendingClusters = null
      if (next) this.onPalette?.(next)
    }, PALETTE_DEBOUNCE_MS)
  }

  private blurAndQuantize(encoder: GPUCommandEncoder): GPUTextureView {
    const source = this.texture!.createView()
    const useBlur =
      this.blur >= 0.01 && this.ping && this.pong && this.blurPipeline && this.blurUniformH && this.blurUniformV
    let quantizeView = source
    if (useBlur) {
      this.blurPass(encoder, source, this.ping!, this.blurUniformH!, 1, 0)
      this.blurPass(encoder, this.ping!.createView(), this.pong!, this.blurUniformV!, 0, 1)
      quantizeView = this.pong!.createView()
    }
    this.quantizer.dispatch(encoder, quantizeView, this.imageWidth, this.imageHeight)
    return quantizeView
  }

  private blurPass(
    encoder: GPUCommandEncoder,
    source: GPUTextureView,
    target: GPUTexture,
    uniforms: GPUBuffer,
    dirX: number,
    dirY: number,
  ): void {
    if (!this.device || !this.blurPipeline || !this.sampler) return
    const data = new ArrayBuffer(BLUR_UNIFORM_SIZE)
    const floats = new Float32Array(data)
    floats.set([dirX, dirY, this.blur, 0, this.imageWidth, this.imageHeight])
    this.device.queue.writeBuffer(uniforms, 0, data)
    const bindGroup = this.device.createBindGroup({
      layout: this.blurPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniforms } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: source },
      ],
    })
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: target.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    })
    pass.setPipeline(this.blurPipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(3)
    pass.end()
  }

  private ensureScratch(width: number, height: number): void {
    if (!this.device) return
    if (this.ping?.width === width && this.ping.height === height) return
    this.ping?.destroy()
    this.pong?.destroy()
    const desc = {
      size: { width, height },
      format: 'rgba16float' as const,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    }
    this.ping = this.device.createTexture(desc)
    this.pong = this.device.createTexture(desc)
  }

  private async probeDynamicRange(texture: GPUTexture, gen: number): Promise<void> {
    if (!this.device) return
    try {
      const peak = await readTexturePeak(this.device, texture)
      if (gen !== this.imageGen) return
      this.onDynamicRange?.(peak > 1.002 ? 'hdr' : 'sdr')
    } catch {
      if (gen !== this.imageGen) return
      this.onDynamicRange?.('sdr')
    }
  }

  private rebuildBindGroup(source: GPUTextureView): void {
    if (!this.device || !this.pipeline || !this.uniformBuffer || !this.sampler || !this.quantizer.clusters) {
      return
    }
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: source },
        { binding: 3, resource: { buffer: this.quantizer.clusters } },
      ],
    })
  }
}

function readBitmapPixels(bitmap: ImageBitmap): Uint8ClampedArray {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return new Uint8ClampedArray()
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data
}

function configureCanvas(
  context: GPUCanvasContext,
  device: GPUDevice,
): { format: GPUTextureFormat; hdr: boolean } {
  const displayHdr = typeof matchMedia === 'function' && matchMedia('(dynamic-range: high)').matches
  if (displayHdr) {
    try {
      context.configure({
        device,
        format: 'rgba16float',
        colorSpace: 'display-p3',
        toneMapping: { mode: 'extended' },
        alphaMode: 'opaque',
      })
      const config = context.getConfiguration?.()
      if (config?.toneMapping?.mode === 'extended') {
        return { format: 'rgba16float', hdr: true }
      }
    } catch {
      /* fall through to SDR */
    }
  }
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({ device, format, alphaMode: 'opaque' })
  return { format, hdr: false }
}

function decodeSrgb(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function srgbEncodedToLinearP3(color: { r: number; g: number; b: number; a: number }): GPUColorDict {
  const r = decodeSrgb(color.r)
  const g = decodeSrgb(color.g)
  const b = decodeSrgb(color.b)
  return {
    r: 0.822461969 * r + 0.177538031 * g,
    g: 0.033194199 * r + 0.966805801 * g,
    b: 0.017082631 * r + 0.07239744 * g + 0.910519929 * b,
    a: color.a,
  }
}

function f16ToF32(bits: number): number {
  const sign = (bits >> 15) & 1
  const exponent = (bits >> 10) & 0x1f
  const fraction = bits & 0x3ff
  if (exponent === 0) {
    return (sign ? -1 : 1) * (fraction / 1024) * 2 ** -14
  }
  if (exponent === 31) {
    return fraction ? Number.NaN : (sign ? -1 : 1) * Number.POSITIVE_INFINITY
  }
  return (sign ? -1 : 1) * (1 + fraction / 1024) * 2 ** (exponent - 15)
}

async function readTexturePeak(device: GPUDevice, texture: GPUTexture): Promise<number> {
  const tile = 16
  const origins = [
    { x: 0, y: 0 },
    { x: Math.max(0, Math.floor((texture.width - tile) / 2)), y: Math.max(0, Math.floor((texture.height - tile) / 2)) },
    { x: Math.max(0, texture.width - tile), y: Math.max(0, texture.height - tile) },
  ]
  let peak = 0
  for (const origin of origins) {
    peak = Math.max(peak, await readTextureTilePeak(device, texture, origin.x, origin.y, tile))
  }
  return peak
}

async function readTextureTilePeak(
  device: GPUDevice,
  texture: GPUTexture,
  originX: number,
  originY: number,
  tile: number,
): Promise<number> {
  const width = Math.min(tile, texture.width - originX)
  const height = Math.min(tile, texture.height - originY)
  if (width <= 0 || height <= 0) return 0
  const bytesPerRow = Math.max(256, Math.ceil((width * 8) / 256) * 256)
  const buffer = device.createBuffer({
    size: bytesPerRow * height,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })
  const encoder = device.createCommandEncoder()
  encoder.copyTextureToBuffer(
    { texture, origin: [originX, originY] },
    { buffer, bytesPerRow },
    { width, height },
  )
  device.queue.submit([encoder.finish()])
  try {
    await buffer.mapAsync(GPUMapMode.READ)
    const bytes = buffer.getMappedRange()
    const view = new DataView(bytes)
    let peak = 0
    for (let y = 0; y < height; y++) {
      const row = y * bytesPerRow
      for (let x = 0; x < width; x++) {
        const offset = row + x * 8
        const r = f16ToF32(view.getUint16(offset, true))
        const g = f16ToF32(view.getUint16(offset + 2, true))
        const b = f16ToF32(view.getUint16(offset + 4, true))
        const yLin = 0.2289746 * r + 0.6917385 * g + 0.0792869 * b
        peak = Math.max(peak, r, g, b, yLin)
      }
    }
    buffer.unmap()
    return peak
  } finally {
    buffer.destroy()
  }
}
