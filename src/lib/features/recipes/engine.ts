import { colorCss, packArgb, solveRecipe, type ColorSample } from '@/lib/color'
import { createId } from '@/lib/domain'
import type { Recipe, RecipeSolveOptions, UserPaint } from '@/lib/domain'

export interface RecipeEngine {
  solve(target: ColorSample, paints: UserPaint[], options: RecipeSolveOptions): Promise<Recipe>
}

export class ScienceRecipeEngine implements RecipeEngine {
  async solve(target: ColorSample, paints: UserPaint[], options: RecipeSolveOptions): Promise<Recipe> {
    const available = paints.filter((paint) => paint.available)
    if (available.length === 0) {
      throw new Error('Turn on at least one library paint before solving.')
    }

    const result = await solveRecipe({
      mixer: options.mixer,
      targetHex: target.hex,
      totalMassMg: options.totalMassMg,
      maxIngredients: options.maxIngredients,
      paints: available.map((paint) => ({
        id: paint.product.id,
        name: paint.product.name,
        hex: paint.appearance.color.hex,
        colourIndex: paint.product.pigments[0]?.colourIndex,
        pigmentName: paint.product.pigments[0]?.commonName,
        opacity: paint.product.opacity,
        tintingStrength: paint.product.tintingStrength,
        densityGPerMl: paint.product.densityGPerMl,
      })),
    })

    const predicted = attachSample(result.predictedSample)
    return {
      id: createId('recipe'),
      paintIds: available.map((paint) => paint.product.id),
      ingredients: result.ingredients.map((item) => ({
        paintId: item.id,
        weightMg: item.weight_mg,
        percent: item.percent,
      })),
      totalMassMg: result.total_mass_mg,
      target,
      predicted,
      deltaE: result.delta_e_00,
      feasibility: result.feasibility,
      origin: 'model',
      mixer: result.mixer,
      notes: result.notes,
    }
  }
}

function attachSample(sample: Omit<ColorSample, 'argb'>): ColorSample {
  const next: ColorSample = {
    ...sample,
    argb: packArgb(
      Math.round(sample.srgb.r * 255),
      Math.round(sample.srgb.g * 255),
      Math.round(sample.srgb.b * 255),
    ),
    hex: sample.hex.startsWith('#') ? sample.hex.toLowerCase() : `#${sample.hex.toLowerCase()}`,
    displayP3: sample.displayP3 ?? sample.srgb,
    rec2020: sample.rec2020 ?? sample.srgb,
    jzazbz: sample.jzazbz ?? { jz: 0, az: 0, bz: 0 },
    relativeLuminance: sample.relativeLuminance ?? sample.xyz?.y ?? 0,
    inSrgbGamut: sample.inSrgbGamut ?? true,
    css: sample.css ?? '',
  }
  return { ...next, css: next.css || colorCss(next) }
}

export const recipeEngine = new ScienceRecipeEngine()
