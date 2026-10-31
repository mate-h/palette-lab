import type { Palette } from '@/lib/domain'

export interface QuantizerInput {
  argbPixels: number[]
  width: number
  height: number
}

export interface QuantizerOptions {
  /** Clamped to 2..=128, matching bevy_quantizer. */
  maxColors: number
  maxEdge?: number
}

export interface Quantizer {
  quantize(input: QuantizerInput, options: QuantizerOptions): Promise<Palette>
}

export function clampMaxColors(maxColors: number): number {
  return Math.min(128, Math.max(2, Math.round(maxColors)))
}
