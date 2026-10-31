import type { ColorSample, DisplayP3, Hct, Jzazbz, Lab, Lch, LinearRgb, Oklch, Rec2020, Srgb, Xyz } from './types'

export function formatLab(lab: Lab): string {
  return `${lab.l.toFixed(1)} ${lab.a.toFixed(1)} ${lab.b.toFixed(1)}`
}

export function formatLch(lch: Lch): string {
  return `${lch.l.toFixed(1)} ${lch.c.toFixed(1)} ${lch.h.toFixed(1)}`
}

export function formatOklch(oklch: Oklch): string {
  return `${oklch.l.toFixed(3)} ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)}`
}

export function formatHct(hct: Hct): string {
  return `${hct.h.toFixed(1)} ${hct.c.toFixed(1)} ${hct.t.toFixed(1)}`
}

export function formatJzazbz(jzazbz: Jzazbz): string {
  return `${jzazbz.jz.toFixed(4)} ${jzazbz.az.toFixed(4)} ${jzazbz.bz.toFixed(4)}`
}

export function formatSrgb8(srgb: Srgb): string {
  return `${Math.round(srgb.r * 255)} ${Math.round(srgb.g * 255)} ${Math.round(srgb.b * 255)}`
}

export function formatLinearRgb(rgb: LinearRgb): string {
  return `${rgb.r.toFixed(3)} ${rgb.g.toFixed(3)} ${rgb.b.toFixed(3)}`
}

export function formatXyz(xyz: Xyz): string {
  return `${xyz.x.toFixed(3)} ${xyz.y.toFixed(3)} ${xyz.z.toFixed(3)}`
}

export function formatDisplayP3(p3: DisplayP3): string {
  return `${p3.r.toFixed(3)} ${p3.g.toFixed(3)} ${p3.b.toFixed(3)}`
}

export function formatRec2020(rec: Rec2020): string {
  return `${rec.r.toFixed(3)} ${rec.g.toFixed(3)} ${rec.b.toFixed(3)}`
}

function cssChannel(value: number): string {
  return value.toFixed(5)
}

export function inDisplayP3Gamut(p3: DisplayP3): boolean {
  return p3.r >= 0 && p3.r <= 1 && p3.g >= 0 && p3.g <= 1 && p3.b >= 0 && p3.b <= 1
}

/** CSS color() for wide-gamut / HDR swatches. Falls back to fitted hex. */
export function colorCss(
  sample: Pick<ColorSample, 'displayP3' | 'xyz' | 'hex'> & Partial<Pick<ColorSample, 'css'>>,
): string {
  if (sample.css) return sample.css
  const p3 = sample.displayP3
  if (p3 && inDisplayP3Gamut(p3)) {
    return `color(display-p3 ${cssChannel(p3.r)} ${cssChannel(p3.g)} ${cssChannel(p3.b)})`
  }
  const xyz = sample.xyz
  if (xyz) {
    return `color(xyz-d65 ${cssChannel(xyz.x)} ${cssChannel(xyz.y)} ${cssChannel(xyz.z)})`
  }
  return sample.hex
}

export function swatchBackground(sample: Pick<ColorSample, 'hex'> & Partial<Pick<ColorSample, 'css'>>): string {
  return sample.css || sample.hex
}
