import { colorFromHex } from '@/lib/color'
import { createId } from '@/lib/domain'
import type { Palette, PaletteColor, Recipe } from '@/lib/domain'
import { percentsFromMasses, totalMass } from '@/lib/features/recipes'
import { paintById } from './paints'

/**
 * Fixture palette so the inspector can show structure before an image is loaded.
 * Weights are illustrative mock data — not solved recipes.
 */
export async function createSamplePalette(): Promise<Palette> {
  const colors = await Promise.all([
    swatch('s0', '#E8D9B8', 0.34, 340, [
      ['tw', 142],
      ['yo', 28],
      ['by', 8],
    ]),
    swatch('s1', '#6B2A3C', 0.22, 220, [
      ['qm', 64],
      ['cb', 18],
      ['tw', 31],
    ]),
    swatch('s2', '#1E3A4C', 0.18, 180, [
      ['pb', 41],
      ['cb', 12],
      ['tw', 55],
    ]),
    swatch('s3', '#C4A04A', 0.14, 140, [
      ['yo', 88],
      ['by', 14],
      ['tw', 22],
    ]),
    swatch('s4', '#2A2A28', 0.12, 120, [
      ['cb', 72],
      ['tw', 19],
      ['pg', 6],
    ]),
  ])

  return {
    id: 'sample-palette',
    source: 'sample',
    colors,
  }
}

async function swatch(
  id: string,
  hex: string,
  frequency: number,
  pixelCount: number,
  parts: [string, number][],
): Promise<PaletteColor> {
  const recipe = await mockRecipe(hex, parts)
  return {
    id,
    color: recipe.target,
    frequency,
    pixelCount,
    recipe,
    recipeError: recipe.deltaE ?? undefined,
    physicalAmount: { requestedMg: recipe.totalMassMg },
  }
}

async function mockRecipe(targetHex: string, parts: [string, number][]): Promise<Recipe> {
  const masses = parts.map(([, mg]) => mg)
  const percents = percentsFromMasses(masses)
  const target = await colorFromHex(targetHex)
  return {
    id: createId('mock-recipe'),
    origin: 'mock',
    feasibility: 'ok',
    notes: 'Mock recipe for UI structure. Not a physical solve.',
    target,
    predicted: target,
    deltaE: 0,
    totalMassMg: totalMass(masses),
    paintIds: parts.map(([id]) => id),
    ingredients: parts.map(([paintId, weightMg], index) => ({
      paintId,
      weightMg,
      percent: percents[index] ?? 0,
    })),
  }
}

export function paintName(paintId: string): string {
  return paintById(paintId)?.name ?? paintId
}
