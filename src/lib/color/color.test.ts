import { describe, expect, it } from 'vitest'
import { colorCss, formatDisplayP3, formatHct, formatJzazbz, formatOklch, formatSrgb8 } from './format'
import { packArgb, unpackArgb } from './pack'

describe('ARGB packing', () => {
  it('round-trips 8-bit channels', () => {
    const packed = packArgb(220, 24, 48)
    expect(unpackArgb(packed)).toMatchObject({ r: 220, g: 24, b: 48, a: 255 })
  })
})

describe('formatters', () => {
  it('prints HCT and OkLCH at fixed precision', () => {
    expect(formatHct({ h: 12.345, c: 40.2, t: 50 })).toBe('12.3 40.2 50.0')
    expect(formatOklch({ l: 0.7215, c: 0.1244, h: 41.2 })).toBe('0.722 0.124 41.2')
    expect(formatSrgb8({ r: 0.9, g: 0.2, b: 0.1 })).toBe('230 51 26')
    expect(formatDisplayP3({ r: 0.812, g: 0.204, b: 0.1 })).toBe('0.812 0.204 0.100')
    expect(formatJzazbz({ jz: 0.12345, az: -0.02, bz: 0.08 })).toBe('0.1235 -0.0200 0.0800')
  })
})

describe('colorCss', () => {
  it('emits display-p3 when channels are in gamut', () => {
    expect(
      colorCss({
        hex: '#cc3366',
        displayP3: { r: 0.75, g: 0.2, b: 0.4 },
        xyz: { x: 0.3, y: 0.2, z: 0.15 },
      }),
    ).toBe('color(display-p3 0.75000 0.20000 0.40000)')
  })

  it('emits xyz-d65 when P3 is out of gamut', () => {
    expect(
      colorCss({
        hex: '#ffffff',
        displayP3: { r: 1.2, g: 0.4, b: -0.1 },
        xyz: { x: 1.1, y: 1.4, z: 0.9 },
      }),
    ).toBe('color(xyz-d65 1.10000 1.40000 0.90000)')
  })

  it('prefers an existing css string', () => {
    expect(
      colorCss({
        hex: '#000000',
        css: 'color(display-p3 0.1 0.2 0.3)',
        displayP3: { r: 0, g: 0, b: 0 },
        xyz: { x: 0, y: 0, z: 0 },
      }),
    ).toBe('color(display-p3 0.1 0.2 0.3)')
  })
})
