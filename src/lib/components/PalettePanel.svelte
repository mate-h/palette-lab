<script lang="ts">
  import { Tooltip } from 'bits-ui'
  import { formatHct, formatJzazbz, formatOklch, swatchBackground } from '@/lib/color'
  import { projectStore } from '@/lib/stores/project.svelte'
  import { uiStore } from '@/lib/stores/ui.svelte'

  const palette = $derived(projectStore.project.palette)
  const space = $derived(projectStore.project.settings.workingSpace)
  const selectedId = $derived(uiStore.selectedColorId)
  let list: HTMLOListElement | undefined = $state()

  $effect(() => {
    const id = selectedId
    if (!id || !list) return
    const row = list.querySelector(`[data-color-id="${id}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  })
</script>

<section class="flex min-h-0 flex-col">
  <header class="flex items-baseline justify-between border-b border-rule px-4 py-3">
    <div>
      <p class="font-mono text-10px tracking-[0.2em] text-paper-500 uppercase">Palette</p>
      <h2 class="mt-1 text-14px font-medium text-paper-100">
        {palette?.colors.length ?? 0} colors
      </h2>
    </div>
    <span class="font-mono text-10px tracking-wide text-paper-500 uppercase">
      {palette?.source === 'celebi' ? 'Celebi' : 'Sample'}
    </span>
  </header>

  <Tooltip.Provider delayDuration={200}>
    <ol bind:this={list} class="min-h-0 flex-1 overflow-auto">
      {#each palette?.colors ?? [] as swatch (swatch.id)}
        {@const coords =
          space === 'hct'
            ? formatHct(swatch.color.hct)
            : space === 'jzazbz'
              ? formatJzazbz(swatch.color.jzazbz)
              : formatOklch(swatch.color.oklch)}
        <li>
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <button
                  {...props}
                  class="flex w-full items-stretch gap-3 border-b border-rule px-4 py-2.5 text-left hover:bg-ink-800"
                  class:bg-ink-800={selectedId === swatch.id}
                  data-color-id={swatch.id}
                  onclick={() => uiStore.selectColor(swatch.id)}
                  type="button"
                >
                  <span
                    class="mt-0.5 size-7 shrink-0 border border-rule"
                    style:background={swatchBackground(swatch.color)}
                  ></span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center justify-between gap-2">
                      <span class="font-mono text-12px text-paper-100">{swatch.color.hex}</span>
                      <span class="font-mono text-10px text-paper-500">
                        {(swatch.frequency * 100).toFixed(1)}%
                      </span>
                    </span>
                    <span class="mt-0.5 block truncate font-mono text-10px text-paper-500">
                      {space.toUpperCase()} {coords}
                    </span>
                  </span>
                  <span
                    class="mt-1 size-1.5 shrink-0 rounded-full"
                    class:bg-brass={swatch.recipe?.origin === 'mock'}
                    class:bg-paper-100={swatch.recipe?.origin === 'model' && swatch.recipe.feasibility === 'ok'}
                    class:bg-paper-500={!swatch.recipe}
                    class:bg-red-400={swatch.recipe?.feasibility === 'infeasible' || swatch.recipe?.feasibility === 'unimplemented'}
                    title={swatch.recipe ? `${swatch.recipe.origin} recipe` : 'No recipe'}
                  ></span>
                </button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                class="z-50 border border-rule bg-ink-800 px-2 py-1.5 font-mono text-10px text-paper-300"
                sideOffset={6}
              >
                {swatch.pixelCount} px · {swatch.recipe ? swatch.recipe.origin : 'no recipe'}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </li>
      {/each}
    </ol>
  </Tooltip.Provider>
</section>
