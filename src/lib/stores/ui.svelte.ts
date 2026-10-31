import type { ColorEngineStatus } from '@/lib/color'

export type AppView = 'workspace' | 'library' | 'measurements'

class UiStore {
  view = $state<AppView>('workspace')
  selectedColorId = $state<string | null>(null)
  engineStatus = $state<ColorEngineStatus>('idle')
  engineMessage = $state('Color engine idle')

  selectColor(id: string | null): void {
    this.selectedColorId = id
  }
}

export const uiStore = new UiStore()
