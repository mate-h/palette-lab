<script lang="ts">
  import { Switch } from 'bits-ui'
  import { kmById } from '@/lib/data/berns'
  import { goldenById } from '@/lib/data/golden'
  import { paintLibraryStore } from '@/lib/stores/paints.svelte'
  import type { UserPaint } from '@/lib/domain'
  import PaintDetailView from './PaintDetailView.svelte'

  const selected = $derived(
    paintLibraryStore.selectedId ? paintLibraryStore.byId(paintLibraryStore.selectedId) : undefined,
  )

  function openPaint(paint: UserPaint): void {
    paintLibraryStore.select(paint.product.id)
  }
</script>

{#if selected}
  <PaintDetailView onBack={() => paintLibraryStore.select(null)} paint={selected} />
{:else}
  <div class="min-h-0 flex-1 overflow-auto">
    <div class="mx-auto max-w-5xl px-6 py-8">
      <header class="mb-8 max-w-xl">
        <p class="font-mono text-10px tracking-[0.2em] text-brass uppercase">Library</p>
        <h1 class="mt-2 text-24px font-medium tracking-tight text-paper-100">Available paints</h1>
        <p class="mt-3 text-13px leading-relaxed text-paper-500">
          Golden Heavy Body listings for this set. Open a paint for manufacturer Lab, Munsell, tint
          strength, pigment CI, and sizes. TW, QM, PB GS, and PG BS have measured two-constant
          K/S. Carbon Black, PY154, and Yellow Ochre use labeled substitutes.
        </p>
      </header>

      <div class="grid gap-px bg-rule md:grid-cols-2">
        {#each paintLibraryStore.paints as paint (paint.product.id)}
          {@const golden = goldenById(paint.product.id)}
          {@const km = kmById(paint.product.id)}
          <article class="flex gap-4 bg-ink-900 p-4">
            <button
              class="size-14 shrink-0 border border-rule"
              onclick={() => openPaint(paint)}
              style:background={paint.appearance.color.hex}
              type="button"
            >
              <span class="sr-only">Inspect {paint.product.name}</span>
            </button>
            <div class="min-w-0 flex-1">
              <div class="flex items-start gap-3">
                <div class="min-w-0">
                  <h2 class="text-14px font-medium text-paper-100">{paint.product.name}</h2>
                  <p class="mt-0.5 font-mono text-11px text-paper-500">
                    {paint.product.manufacturer}
                    {#if paint.product.sku}
                      · {paint.product.sku}
                    {/if}
                    {#if paint.product.line}
                      · {paint.product.line}
                    {/if}
                  </p>
                </div>
                <Switch.Root
                  checked={paint.available}
                  class="relative mt-0.5 h-5 w-9 shrink-0 border border-rule bg-ink-800 data-[state=checked]:border-brass"
                  onCheckedChange={(checked) => paintLibraryStore.setAvailable(paint.product.id, checked)}
                >
                  <Switch.Thumb
                    class="block size-4 translate-x-0 bg-paper-500 transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-brass"
                  />
                </Switch.Root>
              </div>
              <p class="mt-2 font-mono text-11px text-paper-300">
                {paint.product.pigments
                  .map((pigment) => `${pigment.colourIndex} ${pigment.commonName}`)
                  .join(' · ')}
              </p>
              <p class="mt-1 font-mono text-10px text-paper-500">
                {paint.product.opacity}
                {#if golden}
                  · Lab {golden.lab.l.toFixed(1)} {golden.lab.a.toFixed(1)} {golden.lab.b.toFixed(1)}
                {/if}
                {#if km?.substitute}
                  · K/S substitute
                {:else if km}
                  · K/S
                {/if}
              </p>
            </div>
          </article>
        {/each}
      </div>
    </div>
  </div>
{/if}
