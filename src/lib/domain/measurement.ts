import type { ColorSample } from '@/lib/color'

export type MeasurementMethod = 'camera' | 'spectrometer' | 'unknown'

export interface LightingInfo {
  illuminant?: string
  notes?: string
}

/**
 * A closed-loop observation: predicted mix vs what was actually mixed.
 * No spectrometer or camera integration yet.
 */
export interface Measurement {
  id: string
  recipeId: string
  target: ColorSample
  predicted: ColorSample | null
  measured: ColorSample | null
  method: MeasurementMethod
  lighting?: LightingInfo
  deltaE: number | null
  timestamp: string
}

export type DispenseStatus = 'idle' | 'requested' | 'dispensing' | 'complete' | 'error'

export interface Tolerance {
  absoluteMg: number
  relative?: number
}

export interface WeightRequest {
  paintId: string
  requestedMg: number
  tolerance: Tolerance
}

export interface MeasuredWeight {
  paintId: string
  requestedMg: number
  actualMg: number
  timestamp: string
}

/**
 * Hardware-agnostic weighing / dispensing event.
 * TODO: attach a scale (~0.001 g) or syringe dispenser without coupling
 * this type to a serial protocol or vendor.
 */
export interface MeasurementEvent {
  kind: 'weight-request' | 'weight-measured' | 'dispense'
  status?: DispenseStatus
  weight?: MeasuredWeight
  request?: WeightRequest
  timestamp: string
}
