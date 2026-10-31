"""Two-constant Kubelka–Munk mixer from measured (and substitute) K/S.

Matches Unicolour ArtistPaint: mass-fraction concentrations, opaque KM
reflectance, Saunderson SPEX (no additive K1 term). Reflectance is
integrated against CIE 1931 2° × D65 so the result can be compared to
sRGB targets. Dataset coefficients themselves were published with a D50
Unicolour config; that is a white-point choice, not a different KM model.

Tinting strength is already in K and S. Masses are not scaled by the
catalog tintingStrength field.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from coloraide import cmfs, illuminants

from .color import Color
from .km import CATALOG, km_by_id, wavelengths
from .paints import Paint

WAVELENGTHS = np.array(wavelengths(), dtype=float)
K1 = CATALOG.k1
K2 = CATALOG.k2

_CMF = cmfs.CIE_1931_2DEG
_D65 = illuminants.D65
_XBAR = np.array([_CMF[float(nm)][0] for nm in WAVELENGTHS])
_YBAR = np.array([_CMF[float(nm)][1] for nm in WAVELENGTHS])
_ZBAR = np.array([_CMF[float(nm)][2] for nm in WAVELENGTHS])
_SPD = np.array([_D65[float(nm)] for nm in WAVELENGTHS])
_WX = _SPD * _XBAR
_WY = _SPD * _YBAR
_WZ = _SPD * _ZBAR
_NORM = 1.0 / float(_WY.sum())


@dataclass(frozen=True)
class MixSpectrum:
    wavelengths: np.ndarray
    k: np.ndarray
    s: np.ndarray
    reflectance_internal: np.ndarray
    reflectance: np.ndarray
    concentrations: np.ndarray


def ks_matrices(paints: list[Paint]) -> tuple[np.ndarray, np.ndarray]:
    """Return (n_paints, n_bands) absorption and scattering matrices."""
    rows_k: list[np.ndarray] = []
    rows_s: list[np.ndarray] = []
    for paint in paints:
        spectrum = km_by_id(paint.id)
        if spectrum is None:
            raise KeyError(f"No K/S for paint {paint.id}")
        rows_k.append(np.asarray(spectrum.k, dtype=float))
        rows_s.append(np.asarray(spectrum.s, dtype=float))
    return np.vstack(rows_k), np.vstack(rows_s)


def concentrations(masses_mg: list[float] | np.ndarray) -> np.ndarray:
    weights = np.asarray(masses_mg, dtype=float)
    weights = np.clip(weights, 0.0, None)
    total = float(weights.sum())
    if total <= 0:
        raise ValueError("Need at least one positive mass to mix")
    return weights / total


def internal_reflectance(k: np.ndarray, s: np.ndarray) -> np.ndarray:
    """Opaque two-constant KM: R∞ = 1 + K/S − √((K/S)² + 2 K/S)."""
    safe_s = np.maximum(s, 1e-15)
    ks = k / safe_s
    reflectance = 1.0 + ks - np.sqrt(ks * ks + 2.0 * ks)
    return np.where(s <= 1e-15, 0.0, np.clip(reflectance, 0.0, 1.0))


def saunderson_spex(reflectance_internal: np.ndarray, k1: float = K1, k2: float = K2) -> np.ndarray:
    """Unicolour SPEX Saunderson: no additive K1 term."""
    return (1.0 - k1) * (1.0 - k2) * reflectance_internal / (1.0 - k2 * reflectance_internal)


def mix_spectrum(paints: list[Paint], masses_mg: list[float] | np.ndarray) -> MixSpectrum:
    if len(paints) != len(masses_mg):
        raise ValueError("paints and masses_mg must be the same length")
    conc = concentrations(masses_mg)
    k_mat, s_mat = ks_matrices(paints)
    k = conc @ k_mat
    s = conc @ s_mat
    r_int = internal_reflectance(k, s)
    return MixSpectrum(
        wavelengths=WAVELENGTHS.copy(),
        k=k,
        s=s,
        reflectance_internal=r_int,
        reflectance=np.clip(saunderson_spex(r_int), 0.0, 1.0),
        concentrations=conc,
    )


def reflectance_to_xyz(reflectance: np.ndarray) -> np.ndarray:
    """CIE 1931 2° × D65, Y = 1 for a perfect reflecting diffuser."""
    return _NORM * np.array(
        [
            float(np.dot(reflectance, _WX)),
            float(np.dot(reflectance, _WY)),
            float(np.dot(reflectance, _WZ)),
        ]
    )


def reflectance_to_color(reflectance: np.ndarray) -> Color:
    xyz = reflectance_to_xyz(reflectance)
    return Color("xyz-d65", xyz.tolist())


def predict(paints: list[Paint], masses_mg: list[float]) -> Color:
    return reflectance_to_color(mix_spectrum(paints, masses_mg).reflectance)


def masstone(paint: Paint) -> Color:
    return predict([paint], [1.0])
