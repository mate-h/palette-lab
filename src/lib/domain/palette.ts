import type { ColorSample } from '@/lib/color'
import type { Recipe } from './recipe'

export interface PhysicalAmount {
  requestedMg: number
  measuredMg?: number
}

export interface PaletteColor {
  id: string
  color: ColorSample
  /** Share of sampled opaque pixels, 0–1. */
  frequency: number
  pixelCount: number
  recipe?: Recipe
  recipeError?: number
  physicalAmount?: PhysicalAmount
}

export interface Palette {
  id: string
  colors: PaletteColor[]
  /** `celebi` is a real MCU result. `sample` is UI fixture data. */
  source: 'celebi' | 'sample'
}
