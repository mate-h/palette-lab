import type { ColorSample } from './types'

export const PYODIDE_VERSION = '0.28.0'
export const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

export type ColorEngineStatus = 'idle' | 'loading' | 'ready' | 'error'

export type MixerKind = 'km' | 'spectral'

export interface WorkerPaintSpec {
  id: string
  name: string
  hex: string
  colourIndex?: string
  pigmentName?: string
  opacity?: string
  tintingStrength?: number
  densityGPerMl?: number
}

export interface WorkerSolveRequest {
  mixer: MixerKind
  targetHex: string
  totalMassMg: number
  paints: WorkerPaintSpec[]
  maxIngredients?: number
  minMg?: number
}

export interface WorkerSolveResult {
  mixer: MixerKind
  feasibility: 'ok' | 'infeasible'
  total_mass_mg: number
  delta_e_00: number
  predictedHex: string
  notes: string
  predictedSample: Omit<ColorSample, 'argb'>
  ingredients: { id: string; name: string; weight_mg: number; percent: number }[]
}

export type WorkerRequestBody =
  | { op: 'init' }
  | { op: 'fromHex'; hexes: string[] }
  | { op: 'fromLab'; labs: { l: number; a: number; b: number }[] }
  | { op: 'fromArgb'; argbs: number[] }
  | { op: 'deltaE'; a: string; b: string; method: string }
  | { op: 'convert'; hex: string; space: string }
  | { op: 'listSpaces' }
  | { op: 'solve'; request: WorkerSolveRequest }

export type WorkerRequest = WorkerRequestBody & { id: number }

export type WorkerResponse =
  | { id: number; ok: true; op: 'init'; spaces: string[] }
  | { id: number; ok: true; op: 'fromHex' | 'fromLab' | 'fromArgb'; samples: Omit<ColorSample, 'argb'>[] }
  | { id: number; ok: true; op: 'deltaE'; value: number }
  | { id: number; ok: true; op: 'convert'; coords: number[] }
  | { id: number; ok: true; op: 'listSpaces'; spaces: string[] }
  | { id: number; ok: true; op: 'solve'; result: WorkerSolveResult }
  | { id: number; ok: false; error: string }

export type WorkerProgress = { type: 'progress'; message: string }
