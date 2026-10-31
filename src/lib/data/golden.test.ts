import { describe, expect, it } from 'vitest'
import { developmentPaintFixtures } from './paints'
import { goldenById, goldenHeavyBodyCatalog } from './golden'

describe('Golden Heavy Body catalog', () => {
  it('covers every development paint', () => {
    for (const fixture of developmentPaintFixtures) {
      expect(goldenById(fixture.id), fixture.id).toBeDefined()
    }
  })

  it('keeps manufacturer Lab as three numbers', () => {
    const yellow = goldenById('by')
    expect(yellow?.item).toBe('1008')
    expect(yellow?.pigment.colourIndex).toBe('PY154')
    expect(yellow?.lab).toEqual({ l: 81.55, a: 15.72, b: 90.13 })
  })

  it('records Yellow Ochre as Golden PY42', () => {
    expect(goldenById('yo')?.pigment.colourIndex).toBe('PY42')
    expect(goldenHeavyBodyCatalog.paints).toHaveLength(7)
  })

  it('uses a photo-sampled hex for Quinacridone Magenta, not Lab', () => {
    expect(goldenById('qm')?.swatchHex).toBe('#a1092f')
    expect(goldenById('qm')?.lab).toEqual({ l: 31.07, a: 25.99, b: 5.11 })
  })
})
