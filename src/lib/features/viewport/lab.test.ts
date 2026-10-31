import { describe, expect, it } from 'vitest'
import { labFromSrgbMcu } from './lab'

describe('labFromSrgbMcu', () => {
  it('maps black and white to MCU D65 Lab', () => {
    expect(labFromSrgbMcu(0, 0, 0).l).toBeCloseTo(0, 4)
    expect(labFromSrgbMcu(1, 1, 1).l).toBeCloseTo(100, 3)
  })

  it('places red in +a', () => {
    const lab = labFromSrgbMcu(1, 0, 0)
    expect(lab.a).toBeGreaterThan(60)
    expect(lab.b).toBeGreaterThan(40)
  })
})
