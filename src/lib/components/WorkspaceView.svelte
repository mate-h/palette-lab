<script lang="ts">
  import ImageViewport from '@/lib/features/viewport/ImageViewport.svelte'
  import { IMAGE_ACCEPT, isImageFile } from '@/lib/features/image'
  import { projectStore } from '@/lib/stores/project.svelte'
  import Button from './Button.svelte'
  import PalettePanel from './PalettePanel.svelte'
  import QuantizeControls from './QuantizeControls.svelte'
  import RecipeInspector from './RecipeInspector.svelte'

  let dragging = $state(false)
  let fileInput: HTMLInputElement | undefined = $state()

  async function takeFiles(files: FileList | File[] | null): Promise<void> {
    const file = [...(files ?? [])].find(isImageFile)
    if (file) await projectStore.loadFile(file)
  }
</script>

<div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
  <aside class="flex flex-col border-r border-rule bg-ink-900">
    <QuantizeControls />
    <div class="flex flex-col gap-3 px-4 py-4 text-12px leading-relaxed text-paper-500">
      <p>
        An instrument for turning digital colors into reproducible physical paint.
      </p>
      <p>
        Load a plate. Celebi runs on the GPU as you change colors or blur, then solve a
        milligram recipe in the inspector. The Python KM solver runs in the ColorAide worker.
      </p>
    </div>
  </aside>

  <section class="relative min-h-[320px] min-w-0 bg-ink-950">
    <div
      class="absolute inset-0"
      class:outline={dragging}
      class:outline-1={dragging}
      class:outline-brass={dragging}
      ondragenter={(event) => {
        event.preventDefault()
        dragging = true
      }}
      ondragover={(event) => {
        event.preventDefault()
        dragging = true
      }}
      ondragleave={() => {
        dragging = false
      }}
      ondrop={(event) => {
        event.preventDefault()
        dragging = false
        void takeFiles(event.dataTransfer?.files ?? null)
      }}
      role="region"
    >
      <ImageViewport
        bitmap={projectStore.image?.bitmap ?? null}
        blur={projectStore.project.settings.blur}
        maxColors={projectStore.project.settings.maxColors}
        palette={projectStore.project.palette}
      />
    </div>

    {#if !projectStore.image}
      <div class="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
        <div class="pointer-events-auto max-w-sm border border-dashed border-rule bg-ink-900/80 px-6 py-8 text-center">
          <p class="font-mono text-10px tracking-[0.22em] text-brass uppercase">Plate</p>
          <p class="mt-3 text-15px text-paper-100">Drop an image, or browse a file.</p>
          <p class="mt-2 text-12px leading-relaxed text-paper-500">
            JPEG, PNG, HEIC, and other stills. HDR plates display on a capable monitor; Celebi and recipes
            still solve from a tone-mapped SDR target.
          </p>
          <Button class="mt-5" onclick={() => fileInput?.click()}>
            Browse
          </Button>
          {#if projectStore.error}
            <p class="mt-4 font-mono text-11px text-red-300">{projectStore.error}</p>
          {/if}
        </div>
      </div>
    {:else}
      <div class="absolute top-3 left-3 flex items-center gap-3 bg-ink-900/80 px-2 py-1 font-mono text-10px text-paper-300">
        <span>{projectStore.image.meta.name}</span>
        <span class="text-paper-500">
          {projectStore.image.meta.width}×{projectStore.image.meta.height}
        </span>
        {#if projectStore.image.meta.dynamicRange === 'hdr'}
          <span class="border border-brass/50 px-1.5 py-0.5 tracking-wide text-brass uppercase">HDR</span>
        {/if}
        <Button
          onclick={() => {
            fileInput?.click()
          }}
          size="sm"
          variant="ghost"
        >
          Replace
        </Button>
      </div>
    {/if}

    <input
      accept={IMAGE_ACCEPT}
      bind:this={fileInput}
      class="sr-only"
      onchange={(event) => {
        const input = event.currentTarget
        void takeFiles(input.files)
        input.value = ''
      }}
      type="file"
    />
  </section>

  <aside class="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1.15fr)] border-l border-rule bg-ink-900">
    <PalettePanel />
    <RecipeInspector />
  </aside>
</div>
