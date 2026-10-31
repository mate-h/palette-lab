<script lang="ts">
  import { formatHct, formatLab, formatOklch, formatSrgb8 } from '@/lib/color'
  import Button from '@/lib/components/Button.svelte'
  import KmSpectrumChart from '@/lib/components/KmSpectrumChart.svelte'
  import {
    bernsArtistPaintCatalog,
    bernsWavelengths,
    kmById,
  } from '@/lib/data/berns'
  import { formatGoldenLab, formatGoldenMunsell, goldenById } from '@/lib/data/golden'
  import type { UserPaint } from '@/lib/domain'

  let { paint, onBack }: { paint: UserPaint; onBack: () => void } = $props()

  const golden = $derived(goldenById(paint.product.id))
  const km = $derived(kmById(paint.product.id))
  const wavelengths = bernsWavelengths()
  const currentSizes = $derived(golden?.sizes.filter((size) => !size.discontinued) ?? [])
  const discontinuedSizes = $derived(golden?.sizes.filter((size) => size.discontinued) ?? [])

  function formatCoeff(value: number): string {
    if (value === 0) return '0'
    if (value >= 0.001) return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
    return value.toExponential(3)
  }
</script>

<div class="min-h-0 flex-1 overflow-auto">
  <div class="mx-auto max-w-5xl px-6 py-8">
    <Button onclick={onBack} size="sm" variant="ghost">
      ← Library
    </Button>

    {#if !golden}
      <h1 class="mt-4 text-24px font-medium text-paper-100">{paint.product.name}</h1>
      <p class="mt-3 text-13px text-paper-500">No Golden Heavy Body listing is attached to this paint.</p>
    {:else}
      <header class="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="font-mono text-10px tracking-[0.2em] text-brass uppercase">
            Golden · Heavy Body · Item {golden.item} · Series {golden.series}
          </p>
          <h1 class="mt-2 text-24px font-medium tracking-tight text-paper-100">{golden.name}</h1>
          <p class="mt-2 font-mono text-12px text-paper-300">
            {golden.pigment.colourIndex} ({golden.pigment.colourIndexNumber})
            · {golden.pigment.commonName}
          </p>
        </div>
        <Button href={golden.url} rel="noreferrer" target="_blank">
          Golden page
        </Button>
      </header>

      <p class="mt-4 max-w-2xl text-13px leading-relaxed text-paper-500">{golden.description}</p>

      <figure class="mt-8 border border-rule bg-ink-900">
        <div class="h-40 w-full" style:background={paint.appearance.color.hex}></div>
        <figcaption class="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 font-mono text-10px tracking-wide text-paper-500 uppercase">
          <span>sRGB from masstone photo</span>
          <span class="text-paper-300">
            {paint.appearance.color.hex}
            · {formatSrgb8(paint.appearance.color.srgb)}
          </span>
        </figcaption>
      </figure>

      <div class="mt-8 grid gap-px bg-rule md:grid-cols-2">
        <figure class="bg-ink-900">
          <img alt="{golden.name} masstone swatch" class="w-full object-contain" src={golden.images.swatch} />
          <figcaption class="px-3 py-2 font-mono text-10px tracking-wide text-paper-500 uppercase">
            Masstone swatch
          </figcaption>
        </figure>
        <figure class="bg-ink-900">
          <img alt="{golden.name} tint and glaze" class="w-full object-contain" src={golden.images.tintGlaze} />
          <figcaption class="px-3 py-2 font-mono text-10px tracking-wide text-paper-500 uppercase">
            Tint and glaze
          </figcaption>
        </figure>
      </div>

      <section class="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 class="font-mono text-10px tracking-[0.2em] text-brass uppercase">Technical detail</h2>
          <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-12px">
            <dt class="text-paper-500">Opacity</dt>
            <dd class="text-paper-100">{golden.opacity}</dd>
            <dt class="text-paper-500">Lightfastness</dt>
            <dd class="text-paper-100">{golden.lightfastness}</dd>
            <dt class="text-paper-500">Munsell</dt>
            <dd class="text-paper-100">{formatGoldenMunsell(golden.munsell)}</dd>
            <dt class="text-paper-500">CIE Lab</dt>
            <dd class="text-paper-100">{formatGoldenLab(golden.lab)}</dd>
            <dt class="text-paper-500">Tint strength</dt>
            <dd class="text-paper-100">{golden.tintStrength}</dd>
            <dt class="text-paper-500">Gloss</dt>
            <dd class="text-paper-100">{golden.glossAverage}</dd>
            <dt class="text-paper-500">Viscosity</dt>
            <dd class="text-paper-100">{golden.viscosityCps.min}–{golden.viscosityCps.max} CPS</dd>
          </dl>
          <p class="mt-3 text-12px leading-relaxed text-paper-500">
            Tint strength is Golden’s 10:1 white mix number, not the solver’s relative tinting
            strength ({paint.product.tintingStrength?.toFixed(2) ?? '—'}).
          </p>
        </div>

        <div>
          <h2 class="font-mono text-10px tracking-[0.2em] text-brass uppercase">Pigment</h2>
          <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-12px">
            <dt class="text-paper-500">CI name</dt>
            <dd class="text-paper-100">{golden.pigment.colourIndex}</dd>
            <dt class="text-paper-500">CI number</dt>
            <dd class="text-paper-100">{golden.pigment.colourIndexNumber}</dd>
            <dt class="text-paper-500">Common</dt>
            <dd class="text-paper-100">{golden.pigment.commonName}</dd>
            <dt class="text-paper-500">Chemistry</dt>
            <dd class="text-paper-100">{golden.pigment.chemicalDescription}</dd>
            <dt class="text-paper-500">Class</dt>
            <dd class="text-paper-100">{golden.pigment.classification}</dd>
          </dl>

          <h2 class="mt-6 font-mono text-10px tracking-[0.2em] text-brass uppercase">
            Computed appearance
          </h2>
          <p class="mt-2 text-12px text-paper-500">
            Browser swatch is sampled from Golden’s masstone photo. Product-page Lab is a
            spectrophotometer reading and will not match a transparent drawdown. Source:
            {paint.appearance.source}.
          </p>
          <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-12px">
            <dt class="text-paper-500">sRGB</dt>
            <dd class="text-paper-100">
              {paint.appearance.color.hex}
              · {formatSrgb8(paint.appearance.color.srgb)}
            </dd>
            <dt class="text-paper-500">OkLCH</dt>
            <dd class="text-paper-100">{formatOklch(paint.appearance.color.oklch)}</dd>
            <dt class="text-paper-500">HCT</dt>
            <dd class="text-paper-100">{formatHct(paint.appearance.color.hct)}</dd>
            <dt class="text-paper-500">Lab</dt>
            <dd class="text-paper-100">{formatLab(paint.appearance.color.lab)}</dd>
          </dl>
        </div>
      </section>

      {#if km}
        <section class="mt-8">
          <h2 class="font-mono text-10px tracking-[0.2em] text-brass uppercase">
            Two-constant K/S
          </h2>
          {#if km.substitute}
            <p class="mt-2 border border-brass/40 bg-ink-900 px-3 py-2 text-12px leading-relaxed text-brass">
              {#if km.source === 'golden-spectra-single-constant'}
                Substitute measurement · {km.substitute.reason}
              {:else}
                Substitute pigment · {km.colourIndex} {km.unicolourName} standing in for
                {km.substitute.forColourIndex} {km.substitute.forName}.
                {km.substitute.reason}
              {/if}
            </p>
          {/if}
          <p class="mt-2 max-w-2xl text-12px leading-relaxed text-paper-500">
            {#if km.source === 'golden-spectra-single-constant'}
              GoldenSpectra single-constant K/S (10 mil over white), padded to
              {wavelengths[0]}–{wavelengths.at(-1)} nm. S is 1 by construction.
            {:else}
              Unit absorption K and scattering S relative to titanium white S = 1.
              Saunderson K1={bernsArtistPaintCatalog.saunderson.k1},
              K2={bernsArtistPaintCatalog.saunderson.k2}. {wavelengths[0]}–{wavelengths.at(-1)} nm
              at {bernsArtistPaintCatalog.wavelengthInterval} nm. Redistributed from
              <a
                class="text-paper-300 underline decoration-rule underline-offset-2 hover:text-brass"
                href={bernsArtistPaintCatalog.source}
                rel="noreferrer"
                target="_blank"
              >Unicolour ArtistPaint</a>.
            {/if}
            Not used by the recipe solver yet.
          </p>
          <div class="mt-4">
            <KmSpectrumChart {km} />
          </div>
          <div class="mt-4 max-h-64 overflow-auto border border-rule">
            <table class="w-full border-collapse font-mono text-11px">
              <thead class="sticky top-0 bg-ink-900 text-left text-paper-500">
                <tr>
                  <th class="px-3 py-2 font-normal">λ nm</th>
                  <th class="px-3 py-2 font-normal">K</th>
                  <th class="px-3 py-2 font-normal">S</th>
                </tr>
              </thead>
              <tbody>
                {#each wavelengths as wavelength, i (wavelength)}
                  <tr class="border-t border-rule">
                    <td class="px-3 py-1 text-paper-300">{wavelength}</td>
                    <td class="px-3 py-1 text-paper-100">{formatCoeff(km.k[i])}</td>
                    <td class="px-3 py-1 text-paper-100">{formatCoeff(km.s[i])}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}

      <section class="mt-8">
        <h2 class="font-mono text-10px tracking-[0.2em] text-brass uppercase">Also in</h2>
        <p class="mt-2 font-mono text-12px text-paper-100">{golden.lines.join(' · ')}</p>
      </section>

      <section class="mt-8">
        <h2 class="font-mono text-10px tracking-[0.2em] text-brass uppercase">Sizes</h2>
        <table class="mt-3 w-full border-collapse font-mono text-12px">
          <thead>
            <tr class="text-left text-paper-500">
              <th class="pb-2 font-normal">Size</th>
              <th class="pb-2 font-normal">Item</th>
              <th class="pb-2 font-normal">UPC</th>
            </tr>
          </thead>
          <tbody>
            {#each currentSizes as size (size.item)}
              <tr class="border-t border-rule">
                <td class="py-1.5 text-paper-100">{size.size}</td>
                <td class="py-1.5 text-paper-300">{size.item}</td>
                <td class="py-1.5 text-paper-300">{size.upc}</td>
              </tr>
            {/each}
            {#each discontinuedSizes as size (size.item)}
              <tr class="border-t border-rule text-paper-500">
                <td class="py-1.5">{size.size} · discontinued</td>
                <td class="py-1.5">{size.item}</td>
                <td class="py-1.5">{size.upc}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>

      <div class="mt-8 grid gap-4 sm:grid-cols-2">
        <img alt="{golden.name} 2 oz tube" class="w-full border border-rule bg-ink-900" src={golden.images.tube2oz} />
        <img alt="{golden.name} 8 oz jar" class="w-full border border-rule bg-ink-900" src={golden.images.jar8oz} />
      </div>
    {/if}
  </div>
</div>
