import type { MixerKind, WorkingSpace } from '@/lib/color'
import type { Measurement } from './measurement'
import type { Palette } from './palette'
import type { Recipe } from './recipe'

export type ImageColorSpace = 'srgb' | 'display-p3' | 'unknown'
export type ImageDynamicRange = 'sdr' | 'hdr'

export interface ImageMetadata {
  name: string
  mimeType: string
  width: number
  height: number
  byteLength: number
  colorSpace: ImageColorSpace
  dynamicRange: ImageDynamicRange
}

export interface QuantizationSettings {
  maxColors: number
  workingSpace: WorkingSpace
  /** Max edge length of the CPU downsample (tests / fallback). */
  maxEdge: number
  /** Gaussian σ in source pixels, applied on the GPU before Celebi. */
  blur: number
  /** Unused — GPU Celebi recomputes when image, blur, or maxColors change. */
  recompute: boolean
  mixer: MixerKind
  totalMassMg: number
}

export interface CalibrationData {
  /** TODO: empirical mix observations used to refine the mixing model. */
  notes?: string
}

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  image: ImageMetadata | null
  settings: QuantizationSettings
  palette: Palette | null
  selectedPaintIds: string[]
  recipes: Recipe[]
  measurements: Measurement[]
  calibration: CalibrationData
}

export const DEFAULT_QUANTIZE_MAX_EDGE = 256
export const DEFAULT_TOTAL_MASS_MG = 200
export const MIN_TOTAL_MASS_MG = 50
export const MAX_TOTAL_MASS_MG = 2000
export const MIN_BLUR = 0
export const MAX_BLUR = 32

export function defaultQuantizationSettings(): QuantizationSettings {
  return {
    maxColors: 16,
    workingSpace: 'oklch',
    maxEdge: DEFAULT_QUANTIZE_MAX_EDGE,
    blur: 0,
    recompute: true,
    mixer: 'km',
    totalMassMg: DEFAULT_TOTAL_MASS_MG,
  }
}

export function createEmptyProject(name = 'Untitled'): Project {
  const now = new Date().toISOString()
  return {
    id: createId('project'),
    name,
    createdAt: now,
    updatedAt: now,
    image: null,
    settings: defaultQuantizationSettings(),
    palette: null,
    selectedPaintIds: [],
    recipes: [],
    measurements: [],
    calibration: {},
  }
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** JSON snapshot. Image bytes are omitted — IndexedDB persistence is TODO. */
export function serializeProject(project: Project): string {
  return JSON.stringify(project)
}

export function deserializeProject(json: string): Project {
  const project = JSON.parse(json) as Project
  if (project.image) {
    project.image = {
      ...project.image,
      colorSpace: project.image.colorSpace ?? 'unknown',
      dynamicRange: project.image.dynamicRange ?? 'sdr',
    }
  }
  return project
}
