import { colorEngine, initColorEngine } from '@/lib/color'
import { paintLibraryStore } from './paints.svelte'
import { projectStore } from './project.svelte'
import { uiStore } from './ui.svelte'

export async function bootApp(): Promise<void> {
  uiStore.engineStatus = 'loading'
  uiStore.engineMessage = 'Starting ColorAide…'
  const pulse = setInterval(() => {
    uiStore.engineMessage = colorEngine.message
  }, 200)
  try {
    await initColorEngine()
    uiStore.engineMessage = 'Hydrating paint library…'
    await paintLibraryStore.hydrate()
    uiStore.engineMessage = 'Building sample palette…'
    await projectStore.hydrate()
    uiStore.engineStatus = 'ready'
    uiStore.engineMessage = colorEngine.message
  } catch (error) {
    uiStore.engineStatus = 'error'
    uiStore.engineMessage = error instanceof Error ? error.message : 'Color engine failed'
    throw error
  } finally {
    clearInterval(pulse)
  }
}
