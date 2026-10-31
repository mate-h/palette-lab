<script lang="ts">
  import { onMount } from 'svelte'
  import { Tabs } from 'bits-ui'
  import Button from '@/lib/components/Button.svelte'
  import LibraryView from '@/lib/components/LibraryView.svelte'
  import MeasurementsView from '@/lib/components/MeasurementsView.svelte'
  import WorkspaceView from '@/lib/components/WorkspaceView.svelte'
  import { bootApp } from '@/lib/stores/boot'
  import type { AppView } from '@/lib/stores/ui.svelte'
  import { uiStore } from '@/lib/stores/ui.svelte'

  const views: { id: AppView; label: string }[] = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'library', label: 'Library' },
    { id: 'measurements', label: 'Measure' },
  ]

  onMount(() => {
    void bootApp()
  })
</script>

{#if uiStore.engineStatus !== 'ready'}
  <div class="flex h-full flex-col items-center justify-center bg-ink-950 px-6 text-center">
    <p class="font-mono text-10px tracking-[0.22em] text-brass uppercase">Palette Lab</p>
    <h1 class="mt-3 text-22px font-medium text-paper-100">Color science engine</h1>
    <p class="mt-3 max-w-md text-13px leading-relaxed text-paper-500">
      {uiStore.engineMessage}
    </p>
    <p class="mt-6 max-w-sm font-mono text-10px leading-relaxed text-paper-500">
      Pyodide loads Python in this browser, then NumPy, SciPy, and ColorAide. First start
      downloads the runtime from jsDelivr.
    </p>
    {#if uiStore.engineStatus === 'error'}
      <Button class="mt-6" onclick={() => void bootApp()} variant="primary">
        Retry
      </Button>
    {/if}
  </div>
{:else}
  <Tabs.Root
    class="flex h-full min-h-0 flex-col bg-ink-950 text-paper-100"
    onValueChange={(value) => {
      if (value === 'workspace' || value === 'library' || value === 'measurements') {
        uiStore.view = value
      }
    }}
    value={uiStore.view}
  >
    <header class="flex h-12 shrink-0 items-center justify-between border-b border-rule px-4">
      <div class="flex items-baseline gap-3">
        <h1 class="text-15px font-medium tracking-tight text-paper-100">Palette Lab</h1>
        <p class="hidden font-mono text-10px tracking-[0.16em] text-paper-500 uppercase sm:block">
          Digital color → physical paint
        </p>
      </div>
      <Tabs.List class="btn-group inline-flex items-stretch">
        {#each views as view (view.id)}
          <Tabs.Trigger class="btn-seg" value={view.id}>
            {view.label}
          </Tabs.Trigger>
        {/each}
      </Tabs.List>
    </header>

    <Tabs.Content class="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden" value="workspace">
      <WorkspaceView />
    </Tabs.Content>
    <Tabs.Content class="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden" value="library">
      <LibraryView />
    </Tabs.Content>
    <Tabs.Content class="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden" value="measurements">
      <MeasurementsView />
    </Tabs.Content>
  </Tabs.Root>
{/if}
