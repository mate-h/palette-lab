import { QuantizerCelebi } from '@material/material-color-utilities'
import { colorFromArgbBatch } from '@/lib/color'
import { createId } from '@/lib/domain'
import type { Palette, PaletteColor } from '@/lib/domain'
import { clampMaxColors, type Quantizer, type QuantizerInput, type QuantizerOptions } from './types'

export function quantizeToMap(argbPixels: number[], maxColors: number): Map<number, number> {
  return QuantizerCelebi.quantize(argbPixels, clampMaxColors(maxColors))
}

/**
 * CPU Celebi via material-color-utilities (Wu init + Wsmeans in D65 Lab).
 * Palette coordinates are then expanded through the ColorAide worker.
 * TODO: move QuantizerCelebi.quantize onto a Web Worker — it is synchronous
 * and will block the main thread on large pixel buffers.
 */
export class CelebiQuantizer implements Quantizer {
  async quantize(input: QuantizerInput, options: QuantizerOptions): Promise<Palette> {
    const map = quantizeToMap(input.argbPixels, options.maxColors)
    const ranked = [...map.entries()].sort((a, b) => b[1] - a[1])
    const total = ranked.reduce((sum, [, count]) => sum + count, 0)
    const samples = await colorFromArgbBatch(ranked.map(([argb]) => argb))

    const colors: PaletteColor[] = ranked.map(([, pixelCount], index) => ({
      id: `swatch-${index}`,
      color: samples[index]!,
      frequency: total > 0 ? pixelCount / total : 0,
      pixelCount,
    }))

    return {
      id: createId('palette'),
      colors,
      source: 'celebi',
    }
  }
}

export const celebiQuantizer = new CelebiQuantizer()
