"""Closed-loop observation: target → recipe → predicted → measured.

Prediction uses two-constant KM. The Svelte app will eventually ingest a
camera/spectrometer reading here. This prototype only closes the model
loop (target vs predicted) unless a measured color is supplied.
"""

from __future__ import annotations

from dataclasses import dataclass

from .color import Color, delta_e, describe
from .paints import Paint
from .solve import Recipe, solve


@dataclass
class Observation:
    recipe: Recipe
    measured: Color | None
    delta_e_predicted: float
    delta_e_measured: float | None
    delta_e_pred_vs_meas: float | None

    def as_dict(self) -> dict[str, object]:
        payload = {
            "target": describe(self.recipe.target),
            "predicted": describe(self.recipe.predicted),
            "measured": describe(self.measured) if self.measured else None,
            "delta_e_target_predicted": round(self.delta_e_predicted, 3),
            "delta_e_target_measured": (
                None if self.delta_e_measured is None else round(self.delta_e_measured, 3)
            ),
            "delta_e_predicted_measured": (
                None if self.delta_e_pred_vs_meas is None else round(self.delta_e_pred_vs_meas, 3)
            ),
            "recipe": self.recipe.as_dict(),
        }
        return payload


def close_loop(
    target: Color,
    paints: list[Paint],
    total_mass_mg: float = 200,
    measured: Color | None = None,
    **solve_kwargs: object,
) -> Observation:
    recipe = solve(target, paints, total_mass_mg=total_mass_mg, **solve_kwargs)  # type: ignore[arg-type]
    return ingest_measurement(recipe, measured)


def ingest_measurement(recipe: Recipe, measured: Color | None) -> Observation:
    """Attach a real mixed-paint reading to an existing recipe."""
    return Observation(
        recipe=recipe,
        measured=measured,
        delta_e_predicted=recipe.delta_e,
        delta_e_measured=None if measured is None else delta_e(recipe.target, measured),
        delta_e_pred_vs_meas=None if measured is None else delta_e(recipe.predicted, measured),
    )
