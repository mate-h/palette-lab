import type { Lab } from '@/lib/color'

/** MCU / bevy_quantizer sRGB → D65 Lab. Channels are 0–1. */
export function labFromSrgbMcu(r: number, g: number, b: number): Lab {
  const lr = linearized(r)
  const lg = linearized(g)
  const lb = linearized(b)
  const x = 0.41233895 * lr + 0.35762064 * lg + 0.18051042 * lb
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
  const z = 0.01932141 * lr + 0.11916382 * lg + 0.95034478 * lb
  const fx = labF(x / 95.047)
  const fy = labF(y / 100)
  const fz = labF(z / 108.883)
  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

function linearized(n: number): number {
  if (n <= 0.040449936) return (n / 12.92) * 100
  return ((n + 0.055) / 1.055) ** 2.4 * 100
}

function labF(t: number): number {
  const e = 216 / 24389
  const kappa = 24389 / 27
  if (t > e) return t ** (1 / 3)
  return (kappa * t + 16) / 116
}
