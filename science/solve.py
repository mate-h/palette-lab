"""Optimize milligram weights so the predicted mix matches an sRGB target."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal

import numpy as np
from scipy.optimize import minimize

from .color import Color, color_from_hex, delta_e, describe, to_hex
from .mixing import Mixer, mixer_for, predict
from .paints import Paint, paint_from_spec

MixerName = Literal["km", "spectral"]


@dataclass
class Ingredient:
    paint: Paint
    weight_mg: float
    percent: float


@dataclass
class Recipe:
    ingredients: list[Ingredient]
    total_mass_mg: float
    target: Color
    predicted: Color
    delta_e: float
    feasibility: str
    mixer: MixerName = "km"
    notes: str = ""

    def as_dict(self) -> dict[str, object]:
        return {
            "feasibility": self.feasibility,
            "mixer": self.mixer,
            "total_mass_mg": self.total_mass_mg,
            "delta_e_00": round(self.delta_e, 3),
            "target": describe(self.target),
            "predicted": describe(self.predicted),
            "predictedHex": to_hex(self.predicted),
            "notes": self.notes,
            "ingredients": [
                {
                    "id": item.paint.id,
                    "name": item.paint.name,
                    "weight_mg": item.weight_mg,
                    "percent": round(item.percent, 2),
                }
                for item in self.ingredients
            ],
        }


def solve(
    target: Color,
    paints: list[Paint],
    total_mass_mg: float = 200,
    max_ingredients: int | None = None,
    min_mg: float = 1.0,
    l1: float = 0.05,
    ok_delta_e: float = 3.0,
    mixer: MixerName = "km",
) -> Recipe:
    """Solve a recipe. `target` is an sRGB (or any) ColorAide color."""
    if total_mass_mg <= 0:
        raise ValueError("total_mass_mg must be positive")
    if not paints:
        raise ValueError("Need at least one paint")

    mix = mixer_for(mixer)
    fractions = _optimize(target, paints, l1=l1, mix=mix)
    fractions = _refine_third(target, paints, fractions, mix=mix)
    fractions = _prune_fractions(fractions, min_frac=max(min_mg / total_mass_mg, 0.005))
    if max_ingredients is not None and max_ingredients < len(paints):
        keep = set(np.argsort(fractions)[::-1][:max_ingredients].tolist())
        subset = [paint for index, paint in enumerate(paints) if index in keep]
        fractions = _optimize(target, subset, l1=l1 * 0.5, mix=mix)
        fractions = _prune_fractions(fractions, min_frac=max(min_mg / total_mass_mg, 0.005))
        paints = subset

    masses = _quantize_mg(fractions * total_mass_mg, total_mass_mg, min_mg)
    used = [(paint, mass) for paint, mass in zip(paints, masses, strict=True) if mass > 0]
    if not used:
        strongest = int(np.argmax(fractions))
        used = [(paints[strongest], total_mass_mg)]

    used_paints = [paint for paint, _ in used]
    used_masses = [mass for _, mass in used]
    predicted = mix(used_paints, used_masses)
    error = delta_e(target, predicted)
    total = sum(used_masses)

    if mixer == "spectral":
        notes = (
            "ColorAide hex-spectral mix (single-constant KM from catalog sRGB). "
            f"Target {to_hex(target)} → predicted {to_hex(predicted)}."
        )
    else:
        notes = (
            "Two-constant KM from Berns/Unicolour K/S (Saunderson SPEX). "
            f"Target {to_hex(target)} → predicted {to_hex(predicted)}. "
            "cb/by/yo use labeled substitute coefficients."
        )

    return Recipe(
        ingredients=[
            Ingredient(paint=paint, weight_mg=mass, percent=100.0 * mass / total)
            for paint, mass in used
        ],
        total_mass_mg=total,
        target=target,
        predicted=predicted,
        delta_e=error,
        feasibility="ok" if error <= ok_delta_e else "infeasible",
        mixer=mixer,
        notes=notes,
    )


def solve_from_payload(payload: str) -> str:
    """JSON API used by the Pyodide worker."""
    data = json.loads(payload)
    mixer = data.get("mixer", "km")
    if mixer not in {"km", "spectral"}:
        raise ValueError(f"Unknown mixer: {mixer}")
    paints = [paint_from_spec(spec) for spec in data["paints"]]
    recipe = solve(
        color_from_hex(data["targetHex"]),
        paints,
        total_mass_mg=float(data.get("totalMassMg", 200)),
        max_ingredients=data.get("maxIngredients"),
        min_mg=float(data.get("minMg", 1.0)),
        mixer=mixer,
    )
    return json.dumps(recipe.as_dict())


def _optimize(target: Color, paints: list[Paint], l1: float, mix: Mixer = predict) -> np.ndarray:
    n = len(paints)
    starts = [
        np.full(n, 1.0 / n),
        _white_heavy(paints),
        _chroma_guess(target, paints),
        *_tint_starts(target, paints, mix=mix),
    ]
    best_x = starts[0]
    best = np.inf

    for start in starts:
        start = _normalize(np.clip(start, 0, None))
        start_value = _cost(start, target, paints, l1, mix)
        if start_value < best:
            best = start_value
            best_x = start
        result = minimize(
            lambda x, paints=paints, mix=mix: _cost(x, target, paints, l1, mix),
            start,
            method="SLSQP",
            bounds=[(0.0, 1.0)] * n,
            constraints={"type": "eq", "fun": lambda x: float(np.sum(x) - 1.0)},
            options={"maxiter": 200, "ftol": 1e-8},
        )
        x = _normalize(np.clip(result.x, 0, None))
        value = _cost(x, target, paints, l1, mix)
        if value < best:
            best = value
            best_x = x

    return best_x


def _cost(x: np.ndarray, target: Color, paints: list[Paint], l1: float, mix: Mixer = predict) -> float:
    weights = _normalize(np.clip(x, 0, None))
    try:
        predicted = mix(paints, weights.tolist())
    except ValueError:
        return 1e6
    error = delta_e(target, predicted)
    sparsity = l1 * float(np.sum(np.sqrt(weights + 1e-12)))
    return error + sparsity


def _normalize(x: np.ndarray) -> np.ndarray:
    total = float(np.sum(x))
    if total <= 0:
        return np.full_like(x, 1.0 / len(x))
    return x / total


def _prune_fractions(fractions: np.ndarray, min_frac: float) -> np.ndarray:
    """Drop leftover tubes that would only exist as quantization dust."""
    kept = fractions.copy()
    kept[kept < min_frac] = 0.0
    if float(kept.sum()) <= 0:
        kept[int(np.argmax(fractions))] = 1.0
    return _normalize(kept)


def _quantize_mg(masses: np.ndarray, total_mass_mg: float, min_mg: float) -> list[float]:
    """Round to milligrams. Drop leftovers below min_mg; do not promote every dust speck."""
    rounded = np.rint(masses).astype(int)
    for index, mass in enumerate(masses):
        if mass < min_mg:
            rounded[index] = 0
    if int(rounded.sum()) == 0:
        rounded[int(np.argmax(masses))] = int(round(total_mass_mg))
    drift = int(round(total_mass_mg)) - int(rounded.sum())
    if drift != 0 and rounded.sum() > 0:
        index = int(np.argmax(rounded))
        rounded[index] = max(0, rounded[index] + drift)
    return [float(value) for value in rounded]


def _tint_starts(target: Color, paints: list[Paint], mix: Mixer = predict) -> list[np.ndarray]:
    """White plus one chromatic paint — needed for high-tone grounds."""
    try:
        white = next(index for index, paint in enumerate(paints) if paint.id == "tw")
    except StopIteration:
        return []
    starts: list[np.ndarray] = []
    for index, paint in enumerate(paints):
        if index == white:
            continue
        for chroma_frac in (0.006, 0.02, 0.06, 0.12):
            weights = np.zeros(len(paints))
            weights[white] = 1.0 - chroma_frac
            weights[index] = chroma_frac
            starts.append(weights)
    return starts + [_evaluate_tint_lines(target, paints, white, mix=mix)]


def _evaluate_tint_lines(
    target: Color,
    paints: list[Paint],
    white: int,
    mix: Mixer = predict,
) -> np.ndarray:
    best = _white_heavy(paints)
    best_error = _cost(best, target, paints, l1=0.0, mix=mix)
    for index in range(len(paints)):
        if index == white:
            continue
        for chroma_frac in np.linspace(0.005, 0.2, 12):
            weights = np.zeros(len(paints))
            weights[white] = 1.0 - chroma_frac
            weights[index] = chroma_frac
            error = _cost(weights, target, paints, l1=0.0, mix=mix)
            if error < best_error:
                best_error = error
                best = weights
    return best


def _refine_third(
    target: Color,
    paints: list[Paint],
    fractions: np.ndarray,
    mix: Mixer = predict,
) -> np.ndarray:
    """Nudge a two-paint tint with a third tube (often magenta or black)."""
    best = fractions
    best_error = _cost(best, target, paints, l1=0.0, mix=mix)
    ordered = np.argsort(fractions)[::-1]
    used = {int(ordered[0]), int(ordered[1])} if len(ordered) > 1 else {int(ordered[0])}
    donor = int(ordered[0])
    for index in range(len(paints)):
        if index in used:
            continue
        for amount in (0.005, 0.015, 0.03, 0.06):
            if fractions[donor] <= amount:
                continue
            trial = fractions.copy()
            trial[donor] -= amount
            trial[index] += amount
            error = _cost(trial, target, paints, l1=0.0, mix=mix)
            if error < best_error:
                best_error = error
                best = trial
    return _normalize(best)


def _white_heavy(paints: list[Paint]) -> np.ndarray:
    weights = np.array([4.0 if paint.id == "tw" else 1.0 for paint in paints], dtype=float)
    return _normalize(weights)


def _chroma_guess(target: Color, paints: list[Paint]) -> np.ndarray:
    """Bias toward paints whose HCT hue is near the target, plus white."""
    target_hct = target.convert("hct")
    hue = float(target_hct["h"])
    chroma = float(target_hct["c"])
    tone = float(target_hct["t"])
    scores = []
    for paint in paints:
        paint_hct = paint.color.convert("hct")
        dh = min(abs(float(paint_hct["h"]) - hue), 360 - abs(float(paint_hct["h"]) - hue))
        hue_score = max(0.0, 1.0 - dh / 90.0) * (chroma / 40.0)
        white_score = 1.2 if paint.id == "tw" and tone > 40 else 0.15
        black_score = 0.8 if paint.id == "cb" and tone < 35 else 0.05
        scores.append(max(0.05, hue_score + white_score + black_score))
    return _normalize(np.array(scores, dtype=float))
