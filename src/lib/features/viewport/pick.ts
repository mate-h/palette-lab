import type { Lab } from '@/lib/color'
import { labFromSrgbMcu } from './lab'

export interface ImageView {
  canvasWidth: number
  canvasHeight: number
  imageWidth: number
  imageHeight: number
  panX: number
  panY: number
  zoom: number
}

export interface PaletteLab {
  l: number
  a: number
  b: number
}

export const ZOOM_MIN = 0.05
export const ZOOM_MAX = 32

export function viewScale(view: ImageView): number {
  const fit = Math.min(
    view.canvasWidth / Math.max(view.imageWidth, 1),
    view.canvasHeight / Math.max(view.imageHeight, 1),
  )
  return fit * Math.max(view.zoom, 0.001)
}

export function viewOrigin(view: ImageView, scale = viewScale(view)): { x: number; y: number } {
  return {
    x: (view.canvasWidth - view.imageWidth * scale) * 0.5 + view.panX,
    y: (view.canvasHeight - view.imageHeight * scale) * 0.5 + view.panY,
  }
}

/** Canvas device-pixel → image space. The point may lie outside the plate. */
export function canvasToImageCoord(
  canvasX: number,
  canvasY: number,
  view: ImageView,
): { x: number; y: number } {
  const scale = viewScale(view)
  const origin = viewOrigin(view, scale)
  return {
    x: (canvasX - origin.x) / scale,
    y: (canvasY - origin.y) / scale,
  }
}

/** Canvas device-pixel → image pixel. Null when the point is outside the plate. */
export function canvasToImagePixel(
  canvasX: number,
  canvasY: number,
  view: ImageView,
): { x: number; y: number } | null {
  const point = canvasToImageCoord(canvasX, canvasY, view)
  if (point.x < 0 || point.y < 0 || point.x >= view.imageWidth || point.y >= view.imageHeight) {
    return null
  }
  return point
}

/** New pan/zoom so `canvas` stays over the same image point, including after a pan. */
export function zoomAroundPoint(
  view: ImageView,
  canvasX: number,
  canvasY: number,
  nextZoom: number,
): { panX: number; panY: number; zoom: number } {
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoom))
  const scaleOld = viewScale(view)
  const next = { ...view, zoom }
  const scaleNew = viewScale(next)
  const originOld = viewOrigin(view, scaleOld)
  const ratio = scaleNew / scaleOld
  const originNewX = canvasX - (canvasX - originOld.x) * ratio
  const originNewY = canvasY - (canvasY - originOld.y) * ratio
  return {
    zoom,
    panX: originNewX - (view.canvasWidth - view.imageWidth * scaleNew) * 0.5,
    panY: originNewY - (view.canvasHeight - view.imageHeight * scaleNew) * 0.5,
  }
}

/** Separable-ish 2D Gaussian sample of an sRGB8 pixel buffer, 0–1 channels. */
export function sampleGaussian(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  sigma: number,
): { r: number; g: number; b: number } {
  const cx = Math.min(width - 1, Math.max(0, Math.floor(x)))
  const cy = Math.min(height - 1, Math.max(0, Math.floor(y)))
  if (sigma < 0.01) {
    const i = (cy * width + cx) * 4
    return { r: pixels[i]! / 255, g: pixels[i + 1]! / 255, b: pixels[i + 2]! / 255 }
  }
  const radius = Math.min(96, Math.ceil(sigma * 3))
  const twoS2 = 2 * sigma * sigma
  let r = 0
  let g = 0
  let b = 0
  let wsum = 0
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const px = Math.min(width - 1, Math.max(0, cx + dx))
      const py = Math.min(height - 1, Math.max(0, cy + dy))
      const w = Math.exp(-(dx * dx + dy * dy) / twoS2)
      const i = (py * width + px) * 4
      r += pixels[i]! * w
      g += pixels[i + 1]! * w
      b += pixels[i + 2]! * w
      wsum += w
    }
  }
  return { r: r / wsum / 255, g: g / wsum / 255, b: b / wsum / 255 }
}

/** Same nearest-Lab remap as `display.wgsl`. */
export function nearestPaletteIndex(
  r: number,
  g: number,
  b: number,
  entries: readonly PaletteLab[],
): number {
  if (entries.length === 0) return -1
  const lab = labFromSrgbMcu(r, g, b)
  let best = 0
  let bestD = Number.POSITIVE_INFINITY
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!
    const d = dist2(lab, entry)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function dist2(a: Lab, b: PaletteLab): number {
  const dl = a.l - b.l
  const da = a.a - b.a
  const db = a.b - b.b
  return dl * dl + da * da + db * db
}
