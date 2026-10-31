import type { MixerKind, WorkingSpace } from '@/lib/color'
import { colorFromLabBatch } from '@/lib/color'
import { createSamplePalette } from '@/lib/data/sample-palette'
import type { ImageDynamicRange, PaletteColor, Project } from '@/lib/domain'
import { createEmptyProject, createId, MAX_BLUR, MIN_BLUR } from '@/lib/domain'
import type { LoadedImage } from '@/lib/features/image'
import { loadImageFile, withDynamicRange } from '@/lib/features/image'
import type { GpuCluster } from '@/lib/features/quantization'
import { recipeEngine, scaleIngredients } from '@/lib/features/recipes'
import { paintLibraryStore } from './paints.svelte'
import { uiStore } from './ui.svelte'

class ProjectStore {
  project = $state<Project>(createEmptyProject('Study 01'))
  image = $state<LoadedImage | null>(null)
  solving = $state(false)
  error = $state<string | null>(null)
  private paletteGen = 0

  get selectedColor(): PaletteColor | null {
    const id = uiStore.selectedColorId
    if (!id || !this.project.palette) return null
    return this.project.palette.colors.find((color) => color.id === id) ?? null
  }

  async hydrate(): Promise<void> {
    const palette = await createSamplePalette()
    this.project = {
      ...this.project,
      palette,
      selectedPaintIds: ['tw', 'cb', 'by', 'qm', 'pb', 'pg', 'yo'],
      updatedAt: new Date().toISOString(),
    }
    uiStore.selectColor(palette.colors[0]?.id ?? null)
  }

  async loadFile(file: File): Promise<void> {
    this.error = null
    try {
      const loaded = await loadImageFile(file)
      this.image?.bitmap.close()
      this.image = loaded
      this.project = {
        ...this.project,
        image: loaded.meta,
        updatedAt: new Date().toISOString(),
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Couldn't decode this image."
    }
  }

  setImageDynamicRange(dynamicRange: ImageDynamicRange): void {
    if (!this.image) return
    const meta = withDynamicRange(this.image.meta, dynamicRange)
    if (meta === this.image.meta) return
    this.image = { ...this.image, meta }
    this.project = {
      ...this.project,
      image: meta,
      updatedAt: new Date().toISOString(),
    }
  }

  async clearImage(): Promise<void> {
    this.image?.bitmap.close()
    this.image = null
    const palette = await createSamplePalette()
    this.project = {
      ...this.project,
      image: null,
      palette,
      recipes: [],
      updatedAt: new Date().toISOString(),
    }
    uiStore.selectColor(palette.colors[0]?.id ?? null)
  }

  setBlur(blur: number): void {
    this.project = {
      ...this.project,
      settings: { ...this.project.settings, blur: Math.min(MAX_BLUR, Math.max(MIN_BLUR, blur)) },
      updatedAt: new Date().toISOString(),
    }
  }

  setMaxColors(maxColors: number): void {
    this.project = {
      ...this.project,
      settings: { ...this.project.settings, maxColors },
      updatedAt: new Date().toISOString(),
    }
  }

  setWorkingSpace(workingSpace: WorkingSpace): void {
    this.project = {
      ...this.project,
      settings: { ...this.project.settings, workingSpace },
      updatedAt: new Date().toISOString(),
    }
  }

  setMixer(mixer: MixerKind): void {
    this.project = {
      ...this.project,
      settings: { ...this.project.settings, mixer },
      updatedAt: new Date().toISOString(),
    }
    const recipe = this.selectedColor?.recipe
    if (recipe && recipe.origin === 'model') {
      void this.requestRecipe()
    }
  }

  setTotalMassMg(totalMassMg: number): void {
    this.project = {
      ...this.project,
      settings: { ...this.project.settings, totalMassMg },
      updatedAt: new Date().toISOString(),
    }
    this.rescaleSelectedRecipe(totalMassMg)
  }

  async setGpuPalette(clusters: GpuCluster[]): Promise<void> {
    if (clusters.length === 0) return
    const gen = ++this.paletteGen
    try {
      const samples = await colorFromLabBatch(clusters.map((cluster) => cluster.lab))
      if (gen !== this.paletteGen) return
      const prev = this.project.palette
      const reuse = prev?.source === 'celebi'
      const colors: PaletteColor[] = samples.map((color, index) => {
        const existing = reuse ? prev.colors[index] : undefined
        return {
          id: existing?.id ?? `swatch-${index}`,
          color,
          frequency: 1 / samples.length,
          pixelCount: 0,
          recipe: existing?.recipe,
          recipeError: existing?.recipeError,
          physicalAmount: existing?.physicalAmount,
        }
      })
      this.project = {
        ...this.project,
        palette: {
          id: reuse ? prev.id : createId('palette'),
          colors,
          source: 'celebi',
        },
        recipes: reuse ? this.project.recipes : [],
        updatedAt: new Date().toISOString(),
      }
      const selected = uiStore.selectedColorId
      if (!selected || !colors.some((color) => color.id === selected)) {
        uiStore.selectColor(colors[0]?.id ?? null)
      }
    } catch (error) {
      if (gen !== this.paletteGen) return
      this.error = error instanceof Error ? error.message : 'Palette readback failed.'
    }
  }

  private rescaleSelectedRecipe(totalMassMg: number): void {
    const target = this.selectedColor
    const recipe = target?.recipe
    const palette = this.project.palette
    if (!target || !recipe || !palette || recipe.ingredients.length === 0) return
    const ingredients = scaleIngredients(recipe.ingredients, totalMassMg)
    const next = { ...recipe, totalMassMg, ingredients }
    this.project = {
      ...this.project,
      palette: {
        ...palette,
        colors: palette.colors.map((color) =>
          color.id === target.id ? { ...color, recipe: next, physicalAmount: { requestedMg: totalMassMg } } : color,
        ),
      },
      updatedAt: new Date().toISOString(),
    }
  }

  async requestRecipe(): Promise<void> {
    const target = this.selectedColor
    if (!target || !this.project.palette) return
    this.error = null
    this.solving = true
    try {
      const recipe = await recipeEngine.solve(target.color, paintLibraryStore.available, {
        mixer: this.project.settings.mixer,
        totalMassMg: this.project.settings.totalMassMg,
      })
      const palette = this.project.palette
      if (!palette?.colors.some((color) => color.id === target.id)) return
      this.project = {
        ...this.project,
        recipes: [...this.project.recipes, recipe],
        palette: {
          ...palette,
          colors: palette.colors.map((color) =>
            color.id === target.id
              ? { ...color, recipe, recipeError: recipe.deltaE ?? undefined, physicalAmount: { requestedMg: recipe.totalMassMg } }
              : color,
          ),
        },
        updatedAt: new Date().toISOString(),
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Recipe solve failed.'
    } finally {
      this.solving = false
    }
  }
}

export const projectStore = new ProjectStore()
