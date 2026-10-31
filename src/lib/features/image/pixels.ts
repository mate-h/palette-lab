import { packArgb } from '@/lib/color'
import { DEFAULT_QUANTIZE_MAX_EDGE } from '@/lib/domain'
import type { QuantizerInput } from '@/lib/features/quantization'

/**
 * Downsample and pack opaque pixels as MCU-style ARGB integers.
 * Transparent pixels (alpha < 255) are skipped.
 *
 * Default max edge is 256 (MCU docs suggest ~128×128; 256 is a quality/speed
 * compromise for the CPU path). GPU sampling in bevy_quantizer is 1/4 res.
 */
export function extractArgbPixels(
  source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas,
  maxEdge = DEFAULT_QUANTIZE_MAX_EDGE,
): QuantizerInput {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Could not create a 2D context for pixel extraction')
  }
  ctx.drawImage(source, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height).data

  const argbPixels: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 255) continue
    argbPixels.push(packArgb(data[i], data[i + 1], data[i + 2]))
  }

  return { argbPixels, width, height }
}
