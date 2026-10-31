/**
 * Measurement / calibration boundary.
 *
 * TODO: camera or spectrometer capture
 * TODO: lighting / white-point calibration
 * TODO: compare predicted vs measured mix (ΔE)
 * TODO: feed observations back into the recipe engine
 *
 * Hardware (precision scale ~0.001 g, syringe dispenser) must stay
 * behind WeightRequest / MeasuredWeight / DispenseStatus — do not
 * couple this module to a vendor protocol.
 */
export {}
