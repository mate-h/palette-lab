"""Predict a mixed color from paint masses.

Default path is two-constant Kubelka–Munk from the Berns / Unicolour K/S
library (`physical.predict`). ColorAide’s single-constant spectral mix from
catalog hex is kept as `predict_coloraide` for comparison.
"""

from __future__ import annotations

from collections.abc import Callable

from .color import Color
from .paints import Paint
from . import physical

Mixer = Callable[[list[Paint], list[float]], Color]


def predict(paints: list[Paint], masses_mg: list[float]) -> Color:
    return physical.predict(paints, masses_mg)


def mixer_for(name: str) -> Mixer:
    if name == "spectral":
        return predict_coloraide
    if name == "km":
        return predict
    raise ValueError(f"Unknown mixer: {name}")


def predict_coloraide(paints: list[Paint], masses_mg: list[float]) -> Color:
    """Legacy single-constant KM from reconstructed catalog sRGB."""
    if len(paints) != len(masses_mg):
        raise ValueError("paints and masses_mg must be the same length")

    colors: list[Color] = []
    weights: list[float] = []
    for paint, mass in zip(paints, masses_mg, strict=True):
        if mass <= 0:
            continue
        colors.append(paint.color)
        weights.append(mass * paint.tinting_strength)

    if not colors:
        raise ValueError("Need at least one positive mass to predict a mix")

    return Color.weighted_mix(colors, weights, method="spectral")
