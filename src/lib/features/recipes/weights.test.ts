import { describe, expect, it } from 'vitest'
import { gToMg, mgToG, percentsFromMasses, scaleIngredients, totalMass } from './weights'

describe('recipe weights', () => {
  it('converts milligrams and grams', () => {
    expect(mgToG(125)).toBe(0.125)
    expect(gToMg(0.037)).toBeCloseTo(37)
  })

  it('turns masses into percentages that sum to 100', () => {
    const masses = [125, 37, 12]
    const percents = percentsFromMasses(masses)
    expect(totalMass(masses)).toBe(174)
    expect(percents.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100)
    expect(percents[0]).toBeCloseTo((125 / 174) * 100)
  })

  it('returns zeros when total mass is empty', () => {
    expect(percentsFromMasses([0, 0])).toEqual([0, 0])
  })

  it('rescales ingredient milligrams from percents', () => {
    const scaled = scaleIngredients(
      [
        { paintId: 'tw', percent: 85 },
        { paintId: 'qm', percent: 15 },
      ],
      400,
    )
    expect(scaled.map((item) => item.weightMg)).toEqual([340, 60])
    expect(scaled.reduce((sum, item) => sum + item.weightMg, 0)).toBe(400)
  })
})
