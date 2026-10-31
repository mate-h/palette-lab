"""Two-constant KM recipe solver.

Used by `python -m science` and by the Pyodide worker (`from science.solve`).
The CLI observation loop is not imported here.
"""

from .color import Color, color_from_srgb, describe, delta_e
from .km import CATALOG as KM_CATALOG, KmSpectrum, km_by_id
from .mixing import mixer_for, predict, predict_coloraide
from .paints import LIBRARY, Paint, available, paint_from_spec
from .physical import masstone, mix_spectrum
from .solve import Recipe, solve, solve_from_payload

__all__ = [
    "Color",
    "KM_CATALOG",
    "KmSpectrum",
    "LIBRARY",
    "Paint",
    "Recipe",
    "available",
    "color_from_srgb",
    "delta_e",
    "describe",
    "km_by_id",
    "masstone",
    "mix_spectrum",
    "mixer_for",
    "paint_from_spec",
    "predict",
    "predict_coloraide",
    "solve",
    "solve_from_payload",
]
