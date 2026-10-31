<script lang="ts">
  import { Label, Slider, ToggleGroup } from 'bits-ui'
  import type { WorkingSpace } from '@/lib/color'
  import { MAX_BLUR, MIN_BLUR } from '@/lib/domain'
  import { projectStore } from '@/lib/stores/project.svelte'

  const settings = $derived(projectStore.project.settings)

  function onColors(value: number): void {
    projectStore.setMaxColors(value)
  }

  function onBlur(value: number): void {
    projectStore.setBlur(value)
  }

  function onSpace(value: string): void {
    if (value === 'hct' || value === 'oklch' || value === 'jzazbz') {
      projectStore.setWorkingSpace(value as WorkingSpace)
    }
  }
</script>

<section class="flex flex-col gap-5 border-b border-rule px-4 py-4">
  <header>
    <p class="font-mono text-10px tracking-[0.2em] text-paper-500 uppercase">Quantize</p>
    <h2 class="mt-1 text-14px font-medium text-paper-100">Celebi · GPU</h2>
  </header>

  <div class="flex flex-col gap-2">
    <div class="flex items-baseline justify-between">
      <Label.Root class="font-mono text-10px tracking-wide text-paper-500 uppercase" for="max-colors">
        Colors
      </Label.Root>
      <span class="font-mono text-13px text-brass">{settings.maxColors}</span>
    </div>
    <Slider.Root
      class="relative flex h-5 w-full touch-none items-center select-none"
      max={128}
      min={2}
      onValueChange={onColors}
      step={1}
      type="single"
      value={settings.maxColors}
    >
      {#snippet children()}
        <span class="slider-track">
          <Slider.Range class="slider-range" />
        </span>
        <Slider.Thumb class="slider-thumb" index={0} />
      {/snippet}
    </Slider.Root>
    <p class="font-mono text-10px text-paper-500">2–128 · live Wu + Wsmeans in D65 Lab</p>
  </div>

  <div class="flex flex-col gap-2">
    <div class="flex items-baseline justify-between">
      <Label.Root class="font-mono text-10px tracking-wide text-paper-500 uppercase" for="blur">
        Blur
      </Label.Root>
      <span class="font-mono text-13px text-brass">{settings.blur.toFixed(1)}</span>
    </div>
    <Slider.Root
      class="relative flex h-5 w-full touch-none items-center select-none"
      max={MAX_BLUR}
      min={MIN_BLUR}
      onValueChange={onBlur}
      step={0.1}
      type="single"
      value={settings.blur}
    >
      {#snippet children()}
        <span class="slider-track">
          <Slider.Range class="slider-range" />
        </span>
        <Slider.Thumb class="slider-thumb" index={0} />
      {/snippet}
    </Slider.Root>
    <p class="font-mono text-10px text-paper-500">σ 0–32 · separable Gaussian before Celebi</p>
  </div>

  <div class="flex flex-col gap-2">
    <p class="font-mono text-10px tracking-wide text-paper-500 uppercase">Working space</p>
    <ToggleGroup.Root
      class="btn-group grid w-full grid-cols-3"
      onValueChange={onSpace}
      type="single"
      value={settings.workingSpace}
    >
      <ToggleGroup.Item class="btn-seg" value="oklch">
        OkLCH
      </ToggleGroup.Item>
      <ToggleGroup.Item class="btn-seg" value="hct">
        HCT
      </ToggleGroup.Item>
      <ToggleGroup.Item class="btn-seg" value="jzazbz">
        Jzazbz
      </ToggleGroup.Item>
    </ToggleGroup.Root>
    <p class="text-11px leading-relaxed text-paper-500">
      Display / mapping space via ColorAide. Celebi still clusters in D65 Lab from a tone-mapped SDR
      target, even when the plate is HDR.
    </p>
  </div>

  {#if projectStore.error}
    <p class="font-mono text-11px text-red-300">{projectStore.error}</p>
  {/if}
</section>
