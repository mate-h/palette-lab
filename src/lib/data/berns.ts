import catalog from './berns-artist-paint.json'

export interface BernsSaunderson {
  k1: number
  k2: number
}

export interface BernsSubstitute {
  forColourIndex: string
  forName: string
  reason: string
}

export interface BernsArtistPaint {
  id: string
  unicolourName: string
  colourIndex: string
  source: 'unicolour-artistpaint' | 'golden-spectra-single-constant'
  k: number[]
  s: number[]
  substitute?: BernsSubstitute
}

export interface BernsArtistPaintCatalog {
  source: string
  redistribution: string
  dataset: string
  citation: string
  notes: string
  startWavelength: number
  wavelengthInterval: number
  bandCount: number
  saunderson: BernsSaunderson
  whiteScattering: number
  xyzWhite: string
  rgb: string
  paints: BernsArtistPaint[]
}

export const bernsArtistPaintCatalog = catalog as BernsArtistPaintCatalog

export const bernsArtistPaintById = new Map(
  bernsArtistPaintCatalog.paints.map((paint) => [paint.id, paint]),
)

export function kmById(id: string): BernsArtistPaint | undefined {
  return bernsArtistPaintById.get(id)
}

export function bernsWavelengths(): number[] {
  const { startWavelength, wavelengthInterval, bandCount } = bernsArtistPaintCatalog
  return Array.from({ length: bandCount }, (_, i) => startWavelength + i * wavelengthInterval)
}
