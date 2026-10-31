<script lang="ts">
  import { Label, Separator, Slider, ToggleGroup } from 'bits-ui'
  import Button from '@/lib/components/Button.svelte'
  import {
    formatDisplayP3,
    formatHct,
    formatJzazbz,
    formatOklch,
    formatRec2020,
    swatchBackground,
    type MixerKind,
  } from '@/lib/color'
  import { MAX_TOTAL_MASS_MG, MIN_TOTAL_MASS_MG } from '@/lib/domain'
  import { paintName } from '@/lib/data/sample-palette'
  import { formatGrams, formatMg } from '@/lib/features/recipes'
  import { projectStore } from '@/lib/stores/project.svelte'

  const color = $derived(projectStore.selectedColor)
  const space = $derived(projectStore.project.settings.workingSpace)
  const settings = $derived(projectStore.project.settings)
  const recipe = $derived(color?.recipe)
  const solving = $derived(projectStore.solving)

  function onMixer(value: string): void {
    if (value === 'km' || value === 'spectral') {
      projectStore.setMixer(value as MixerKind)
    }
  }

  function onMass(value: number): void {
    projectStore.setTotalMassMg(value)
  }
</script>

<section class="flex min-h-0 flex-col border-t border-rule">
  <header class="border-b border-rule px-4 py-3">
    <p class="font-mono text-10px tracking-[0.2em] text-paper-500 uppercase">Inspector</p>
    <h2 class="mt-1 text-14px font-medium text-paper-100">
      {color ? color.color.hex : 'No swatch'}
    </h2>
  </header>

  {#if !color}
    <p class="px-4 py-4 text-12px leading-relaxed text-paper-500">
      Select a palette color to inspect its target, recipe, and error.
    </p>
  {:else}
    <div class="min-h-0 flex-1 overflow-auto px-4 py-4">
      <div class="grid grid-cols-2 gap-3">
        <figure class="border border-rule">
          <div class="h-14" style:background={swatchBackground(color.color)}></div>
          <figcaption class="px-2 py-1.5 font-mono text-10px tracking-wide text-paper-500 uppercase">
            Target
          </figcaption>
        </figure>
        <figure class="border border-rule">
          <div
            class="h-14"
            style:background={recipe?.predicted ? swatchBackground(recipe.predicted) : 'transparent'}
            class:bg-ink-800={!recipe?.predicted}
          ></div>
          <figcaption class="px-2 py-1.5 font-mono text-10px tracking-wide text-paper-500 uppercase">
            Predicted
          </figcaption>
        </figure>
      </div>

      <dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-11px">
        <dt class="text-paper-500">Space</dt>
        <dd class="text-paper-100">
          {#if space === 'hct'}
            HCT {formatHct(color.color.hct)}
          {:else if space === 'jzazbz'}
            Jzazbz {formatJzazbz(color.color.jzazbz)}
          {:else}
            OkLCH {formatOklch(color.color.oklch)}
          {/if}
        </dd>
        <dt class="text-paper-500">Lab</dt>
        <dd class="text-paper-100">
          {color.color.lab.l.toFixed(1)} {color.color.lab.a.toFixed(1)} {color.color.lab.b.toFixed(1)}
        </dd>
        <dt class="text-paper-500">P3</dt>
        <dd class="text-paper-100">{formatDisplayP3(color.color.displayP3)}</dd>
        <dt class="text-paper-500">Rec.2020</dt>
        <dd class="text-paper-100">{formatRec2020(color.color.rec2020)}</dd>
        <dt class="text-paper-500">Y</dt>
        <dd class="text-paper-100">{color.color.relativeLuminance.toFixed(3)}</dd>
        {#if color.color.relativeLuminance > 1 || !color.color.inSrgbGamut}
          <dt class="text-paper-500">Range</dt>
          <dd class="text-brass">
            {color.color.relativeLuminance > 1 ? 'HDR' : 'Outside sRGB'}
          </dd>
        {/if}
      </dl>
      {#if projectStore.image?.meta.dynamicRange === 'hdr'}
        <p class="mt-3 text-11px leading-relaxed text-paper-500">
          HDR plate. The recipe is solved from the tone-mapped SDR / Lab target.
        </p>
      {/if}

      <Separator.Root class="my-4 h-px bg-rule" />

      <div class="flex flex-col gap-2">
        <p class="font-mono text-10px tracking-wide text-paper-500 uppercase">Mixer</p>
        <ToggleGroup.Root
          class="btn-group grid w-full grid-cols-2"
          disabled={solving}
          onValueChange={onMixer}
          type="single"
          value={settings.mixer}
        >
          <ToggleGroup.Item class="btn-seg" value="km">
            KM
          </ToggleGroup.Item>
          <ToggleGroup.Item class="btn-seg" value="spectral">
            Spectral
          </ToggleGroup.Item>
        </ToggleGroup.Root>
        <p class="text-11px leading-relaxed text-paper-500">
          KM uses Berns/Unicolour two-constant K/S. Spectral is ColorAide’s hex reconstruction.
        </p>
      </div>

      <div class="mt-4 flex flex-col gap-2">
        <div class="flex items-baseline justify-between">
          <Label.Root class="font-mono text-10px tracking-wide text-paper-500 uppercase" for="total-mass">
            Mix mass
          </Label.Root>
          <span class="font-mono text-13px text-brass">{formatMg(settings.totalMassMg)}</span>
        </div>
        <Slider.Root
          class="relative flex h-5 w-full touch-none items-center select-none"
          disabled={solving}
          max={MAX_TOTAL_MASS_MG}
          min={MIN_TOTAL_MASS_MG}
          onValueChange={onMass}
          step={10}
          type="single"
          value={settings.totalMassMg}
        >
          {#snippet children()}
            <span class="slider-track">
              <Slider.Range class="slider-range" />
            </span>
            <Slider.Thumb class="slider-thumb" index={0} />
          {/snippet}
        </Slider.Root>
        <p class="font-mono text-10px text-paper-500">
          {MIN_TOTAL_MASS_MG}–{MAX_TOTAL_MASS_MG} mg · {formatGrams(settings.totalMassMg)} · scales the current recipe
        </p>
      </div>

      <Button
        class="mt-4 w-full"
        disabled={solving}
        onclick={() => void projectStore.requestRecipe()}
        size="lg"
        variant="primary"
      >
        {solving ? 'Solving…' : 'Solve recipe'}
      </Button>

      {#if projectStore.error}
        <p class="mt-3 font-mono text-11px text-red-300">{projectStore.error}</p>
      {/if}

      <Separator.Root class="my-4 h-px bg-rule" />

      <div class="flex items-baseline justify-between">
        <p class="font-mono text-10px tracking-[0.2em] text-paper-500 uppercase">Recipe</p>
        {#if recipe?.origin === 'mock'}
          <span class="border border-brass/50 px-1.5 py-0.5 font-mono text-9px tracking-wide text-brass uppercase">
            Mock
          </span>
        {:else if recipe?.mixer}
          <span class="border border-rule px-1.5 py-0.5 font-mono text-9px tracking-wide text-paper-300 uppercase">
            {recipe.mixer === 'km' ? 'KM' : 'Spectral'}
          </span>
        {/if}
      </div>

      {#if recipe && recipe.ingredients.length > 0}
        <table class="mt-3 w-full border-collapse font-mono text-11px">
          <thead>
            <tr class="text-left text-paper-500">
              <th class="pb-1 font-normal">Paint</th>
              <th class="pb-1 text-right font-normal">mg</th>
              <th class="pb-1 text-right font-normal">%</th>
            </tr>
          </thead>
          <tbody>
            {#each recipe.ingredients as ingredient (ingredient.paintId)}
              <tr class="border-t border-rule">
                <td class="py-1.5 text-paper-100">{paintName(ingredient.paintId)}</td>
                <td class="py-1.5 text-right text-paper-100">{ingredient.weightMg}</td>
                <td class="py-1.5 text-right text-paper-500">{ingredient.percent.toFixed(1)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="mt-3 font-mono text-11px text-paper-300">
          Total {formatMg(recipe.totalMassMg)}
          <span class="text-paper-500">({formatGrams(recipe.totalMassMg)})</span>
        </p>
      {:else}
        <p class="mt-3 text-12px leading-relaxed text-paper-500">
          No physical recipe yet. Solve runs the Python KM optimizer in the ColorAide worker.
        </p>
      {/if}

      {#if recipe?.notes}
        <p class="mt-3 text-11px leading-relaxed text-paper-500">{recipe.notes}</p>
      {/if}

      <Separator.Root class="my-4 h-px bg-rule" />

      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-11px">
        <dt class="text-paper-500">ΔE<sub>00</sub></dt>
        <dd class="text-paper-100">
          {recipe?.deltaE == null ? '—' : recipe.deltaE.toFixed(2)}
        </dd>
        <dt class="text-paper-500">Feasibility</dt>
        <dd class="text-paper-100">{recipe?.feasibility ?? '—'}</dd>
      </dl>
    </div>
  {/if}
</section>
