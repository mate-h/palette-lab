import type { OpacityClass } from '@/lib/domain'
import catalog from './golden-heavy-body.json'

export interface GoldenMunsell {
  hue: string
  value: number
  chroma: number
}

export interface GoldenPigment {
  colourIndex: string
  colourIndexNumber: string
  commonName: string
  chemicalDescription: string
  classification: string
}

export interface GoldenSize {
  size: string
  item: string
  upc: string
  discontinued?: boolean
}

export interface GoldenImages {
  swatch: string
  tintGlaze: string
  tube2oz: string
  jar8oz: string
}

export interface GoldenHeavyBodyPaint {
  id: string
  url: string
  name: string
  item: string
  series: number
  description: string
  opacity: OpacityClass
  lightfastness: string
  munsell: GoldenMunsell
  glossAverage: number
  viscosityCps: { min: number; max: number }
  lab: { l: number; a: number; b: number }
  /** Median sRGB of Golden's masstone photo, not a Lab conversion. */
  swatchHex: string
  tintStrength: number
  pigment: GoldenPigment
  lines: string[]
  sizes: GoldenSize[]
  images: GoldenImages
}

export interface GoldenHeavyBodyCatalog {
  source: string
  retrieved: string
  notes: string
  paints: GoldenHeavyBodyPaint[]
}

export const goldenHeavyBodyCatalog = catalog as GoldenHeavyBodyCatalog

export const goldenHeavyBodyById = new Map(
  goldenHeavyBodyCatalog.paints.map((paint) => [paint.id, paint]),
)

export function goldenById(id: string): GoldenHeavyBodyPaint | undefined {
  return goldenHeavyBodyById.get(id)
}

export function formatGoldenLab(lab: GoldenHeavyBodyPaint['lab']): string {
  return `${lab.l.toFixed(2)} ${lab.a.toFixed(2)} ${lab.b.toFixed(2)}`
}

export function formatGoldenMunsell(munsell: GoldenMunsell): string {
  return `${munsell.hue} ${munsell.value} / ${munsell.chroma}`
}
