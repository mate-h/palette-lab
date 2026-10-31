import type { ColorSample, MixerKind } from '@/lib/color'

export type { MixerKind }
export type RecipeFeasibility = 'unimplemented' | 'infeasible' | 'ok'
export type RecipeOrigin = 'mock' | 'model' | 'calibrated' | 'manual'

export interface RecipeIngredient {
  paintId: string
  weightMg: number
  percent: number
}

/**
 * A physical mixture. Target is the digital color; predicted is the
 * mix the model expects; those are not the same thing.
 */
export interface Recipe {
  id: string
  paintIds: string[]
  ingredients: RecipeIngredient[]
  totalMassMg: number
  target: ColorSample
  predicted: ColorSample | null
  deltaE: number | null
  feasibility: RecipeFeasibility
  origin: RecipeOrigin
  mixer?: MixerKind
  notes?: string
}

export interface RecipeSolveOptions {
  mixer: MixerKind
  totalMassMg: number
  maxIngredients?: number
}
