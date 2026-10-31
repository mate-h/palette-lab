import { describe, expect, it } from 'vitest'
import { developmentPaintFixtures } from './paints'
import { bernsArtistPaintCatalog, bernsWavelengths, kmById } from './berns'

describe('Berns / Unicolour ArtistPaint K/S', () => {
  it('covers every development paint, with substitutes flagged', () => {
    expect(bernsArtistPaintCatalog.paints.map((paint) => paint.id)).toEqual([
      'tw',
      'cb',
      'by',
      'qm',
      'pb',
      'pg',
      'yo',
    ])
    for (const fixture of developmentPaintFixtures) {
      expect(kmById(fixture.id), fixture.id).toBeDefined()
    }
    expect(kmById('cb')?.substitute?.forColourIndex).toBe('PBk7')
    expect(kmById('by')?.substitute?.forColourIndex).toBe('PY154')
    expect(kmById('yo')?.substitute).toBeDefined()
    expect(kmById('tw')?.substitute).toBeUndefined()
    expect(kmById('qm')?.substitute).toBeUndefined()
  })

  it('keeps 380–750 nm at 10 nm with Unicolour Saunderson constants', () => {
    const wavelengths = bernsWavelengths()
    expect(wavelengths).toHaveLength(38)
    expect(wavelengths[0]).toBe(380)
    expect(wavelengths.at(-1)).toBe(750)
    expect(bernsArtistPaintCatalog.saunderson).toEqual({ k1: 0.03, k2: 0.65 })
    expect(bernsArtistPaintCatalog.whiteScattering).toBe(1)
  })

  it('uses Bone Black and Hansa Yellow Opaque as two-constant stand-ins', () => {
    expect(kmById('cb')?.unicolourName).toBe('BoneBlack')
    expect(kmById('cb')?.colourIndex).toBe('PBk9')
    expect(kmById('cb')?.k[0]).toBeCloseTo(0.317811397650624, 15)
    expect(kmById('by')?.unicolourName).toBe('HansaYellowOpaque')
    expect(kmById('by')?.colourIndex).toBe('PY74')
    expect(kmById('by')?.k[0]).toBeCloseTo(0.512100081314837, 15)
  })

  it('embeds GoldenSpectra Yellow Ochre K/S with S = 1', () => {
    const ochre = kmById('yo')
    expect(ochre?.source).toBe('golden-spectra-single-constant')
    expect(ochre?.s).toEqual(Array(38).fill(1))
    expect(ochre?.k[0]).toBeCloseTo(7.6202, 4)
    expect(ochre?.k[2]).toBeCloseTo(7.6202, 4)
    expect(ochre?.k[17]).toBeCloseTo(1.1586, 4)
    expect(ochre?.k.at(-1)).toBeCloseTo(0.3993, 4)
  })
})
