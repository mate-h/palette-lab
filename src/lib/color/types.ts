export type ColorSpaceId =
  | 'srgb'
  | 'linearRgb'
  | 'xyz'
  | 'lab'
  | 'lch'
  | 'oklch'
  | 'hct'
  | 'displayP3'
  | 'rec2020'
  | 'jzazbz'

/** sRGB channels in 0–1. */
export interface Srgb {
  r: number
  g: number
  b: number
}

export interface LinearRgb {
  r: number
  g: number
  b: number
}

export interface DisplayP3 {
  r: number
  g: number
  b: number
}

export interface Rec2020 {
  r: number
  g: number
  b: number
}

export interface Xyz {
  x: number
  y: number
  z: number
}

export interface Lab {
  l: number
  a: number
  b: number
}

export interface Lch {
  l: number
  c: number
  h: number
}

export interface Oklch {
  l: number
  c: number
  h: number
}

/** Material HCT: hue 0–360, chroma unbounded, tone 0–100. */
export interface Hct {
  h: number
  c: number
  t: number
}

/** Jzazbz: HDR-capable perceptual space. */
export interface Jzazbz {
  jz: number
  az: number
  bz: number
}

/**
 * A color with representations in the spaces Palette Lab computes in.
 * sRGB / hex are for display-referred recipes — not a sufficient model of paint.
 */
export interface ColorSample {
  argb: number
  hex: string
  css: string
  srgb: Srgb
  linearRgb: LinearRgb
  displayP3: DisplayP3
  rec2020: Rec2020
  xyz: Xyz
  lab: Lab
  lch: Lch
  oklch: Oklch
  hct: Hct
  jzazbz: Jzazbz
  relativeLuminance: number
  inSrgbGamut: boolean
}

export type WorkingSpace = 'hct' | 'oklch' | 'jzazbz'
