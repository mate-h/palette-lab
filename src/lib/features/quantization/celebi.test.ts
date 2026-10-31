import { describe, expect, it } from 'vitest'
import { packArgb } from '@/lib/color'
import { quantizeToMap } from './celebi'

describe('CelebiQuantizer', () => {
  it('maps a two-color buffer to at most two ARGB entries', () => {
    const red = packArgb(220, 24, 24)
    const blue = packArgb(24, 48, 200)
    const argbPixels = [...Array(80).fill(red), ...Array(80).fill(blue)]
    const map = quantizeToMap(argbPixels, 2)

    expect(map.size).toBeGreaterThanOrEqual(1)
    expect(map.size).toBeLessThanOrEqual(2)
    const total = [...map.values()].reduce((sum, count) => sum + count, 0)
    expect(total).toBe(argbPixels.length)
  })
})
