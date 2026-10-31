import type { ColorSample } from '@/lib/color'

/** Chemical / Colour Index identity of a pigment, independent of a product. */
export interface PigmentIdentity {
  colourIndex: string
  commonName: string
  notes?: string
}

export type OpacityClass = 'transparent' | 'semi-transparent' | 'semi-opaque' | 'opaque'

/**
 * A manufactured paint: the tube or jar on the shelf.
 * Distinct from the pigment(s) it contains and from its displayed color.
 */
export interface PaintProduct {
  id: string
  name: string
  manufacturer: string
  sku?: string
  line?: string
  pigments: PigmentIdentity[]
  opacity: OpacityClass
  /** Relative tinting strength. 1 is a typical heavy-body acrylic. */
  tintingStrength?: number
  /** g/mL, if known. Used later for volume ↔ mass. */
  densityGPerMl?: number
  metadata?: Record<string, string>
}

/** Catalog or measured appearance — not RGB-only. */
export interface PaintAppearance {
  color: ColorSample
  source: 'catalog-approx' | 'measured' | 'unknown'
}

export interface UserPaint {
  product: PaintProduct
  appearance: PaintAppearance
  available: boolean
}
