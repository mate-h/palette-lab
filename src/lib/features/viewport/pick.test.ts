import { describe, expect, it } from 'vitest'
import { labFromSrgbMcu } from './lab'
import { canvasToImageCoord, canvasToImagePixel, nearestPaletteIndex, sampleGaussian, zoomAroundPoint } from './pick'

describe('canvasToImagePixel', () => {
  const view = {
    canvasWidth: 400,
    canvasHeight: 100,
    imageWidth: 40,
    imageHeight: 20,
    panX: 0,
    panY: 0,
    zoom: 1,
  }

  it('maps the fitted image origin to (0, 0)', () => {
    expect(canvasToImagePixel(100, 0, view)).toEqual({ x: 0, y: 0 })
  })

  it('returns null outside the plate', () => {
    expect(canvasToImagePixel(0, 0, view)).toBeNull()
    expect(canvasToImagePixel(399, 99, view)).toBeNull()
  })

  it('maps a click through the current zoom and pan, not the fitted origin', () => {
    const zoomed = { ...view, panX: 80, panY: -24, zoom: 2.5 }
    const canvasX = 173
    const canvasY = 41
    const fitted = canvasToImageCoord(canvasX, canvasY, view)
    const actual = canvasToImageCoord(canvasX, canvasY, zoomed)
    expect(actual.x).not.toBeCloseTo(fitted.x, 4)
    expect(actual.y).not.toBeCloseTo(fitted.y, 4)

    const scale = Math.min(zoomed.canvasWidth / zoomed.imageWidth, zoomed.canvasHeight / zoomed.imageHeight) * zoomed.zoom
    const originX = (zoomed.canvasWidth - zoomed.imageWidth * scale) * 0.5 + zoomed.panX
    const originY = (zoomed.canvasHeight - zoomed.imageHeight * scale) * 0.5 + zoomed.panY
    expect(actual.x).toBeCloseTo((canvasX - originX) / scale, 8)
    expect(actual.y).toBeCloseTo((canvasY - originY) / scale, 8)
  })
})

describe('zoomAroundPoint', () => {
  const view = {
    canvasWidth: 400,
    canvasHeight: 200,
    imageWidth: 40,
    imageHeight: 20,
    panX: 48,
    panY: -22,
    zoom: 1.4,
  }

  it('keeps the image point under the cursor after zoom, including pan', () => {
    const cursor = { x: 173, y: 81 }
    const before = canvasToImageCoord(cursor.x, cursor.y, view)
    const next = zoomAroundPoint(view, cursor.x, cursor.y, view.zoom * 1.08)
    const after = canvasToImageCoord(cursor.x, cursor.y, { ...view, ...next })
    expect(after.x).toBeCloseTo(before.x, 8)
    expect(after.y).toBeCloseTo(before.y, 8)
  })

  it('leaves pan at zero when zooming the fitted center', () => {
    const centered = { ...view, panX: 0, panY: 0, zoom: 1 }
    const next = zoomAroundPoint(centered, 200, 100, 2)
    expect(next.panX).toBeCloseTo(0, 8)
    expect(next.panY).toBeCloseTo(0, 8)
  })
})

describe('nearestPaletteIndex', () => {
  const black = labFromSrgbMcu(0, 0, 0)
  const white = labFromSrgbMcu(1, 1, 1)
  const red = labFromSrgbMcu(1, 0, 0)

  it('returns -1 for an empty palette', () => {
    expect(nearestPaletteIndex(1, 0, 0, [])).toBe(-1)
  })

  it('picks the closest Lab swatch', () => {
    const entries = [black, white, red]
    expect(nearestPaletteIndex(0, 0, 0, entries)).toBe(0)
    expect(nearestPaletteIndex(1, 1, 1, entries)).toBe(1)
    expect(nearestPaletteIndex(0.9, 0.05, 0.05, entries)).toBe(2)
  })
})

describe('sampleGaussian', () => {
  const white = new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255])

  it('returns the pixel when sigma is 0', () => {
    const pixels = new Uint8ClampedArray([10, 20, 30, 255, 200, 0, 0, 255])
    expect(sampleGaussian(pixels, 2, 1, 0.2, 0.2, 0)).toEqual({ r: 10 / 255, g: 20 / 255, b: 30 / 255 })
  })

  it('stays white on a flat field', () => {
    const sample = sampleGaussian(white, 2, 2, 0.5, 0.5, 1.5)
    expect(sample.r).toBeCloseTo(1, 5)
    expect(sample.g).toBeCloseTo(1, 5)
    expect(sample.b).toBeCloseTo(1, 5)
  })
})
