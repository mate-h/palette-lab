"""Two-constant K/S for the development library.

Exact matches and pigment substitutes come from Berns 2016 / Unicolour
ArtistPaint. Yellow Ochre is GoldenSpectra single-constant K/S with S = 1.
Not used by the ColorAide mixer.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

_DATA_PATH = Path(__file__).parent / "data" / "berns-artist-paint.json"


@dataclass(frozen=True)
class KmSubstitute:
    for_colour_index: str
    for_name: str
    reason: str


@dataclass(frozen=True)
class KmSpectrum:
    id: str
    unicolour_name: str
    colour_index: str
    source: str
    k: tuple[float, ...]
    s: tuple[float, ...]
    substitute: KmSubstitute | None


@dataclass(frozen=True)
class KmCatalog:
    start_wavelength: int
    wavelength_interval: int
    k1: float
    k2: float
    paints: dict[str, KmSpectrum]


def _load() -> KmCatalog:
    raw = json.loads(_DATA_PATH.read_text())
    paints = {}
    for entry in raw["paints"]:
        sub = entry.get("substitute")
        paints[entry["id"]] = KmSpectrum(
            id=entry["id"],
            unicolour_name=entry["unicolourName"],
            colour_index=entry["colourIndex"],
            source=entry["source"],
            k=tuple(entry["k"]),
            s=tuple(entry["s"]),
            substitute=(
                KmSubstitute(
                    for_colour_index=sub["forColourIndex"],
                    for_name=sub["forName"],
                    reason=sub["reason"],
                )
                if sub
                else None
            ),
        )
    return KmCatalog(
        start_wavelength=raw["startWavelength"],
        wavelength_interval=raw["wavelengthInterval"],
        k1=raw["saunderson"]["k1"],
        k2=raw["saunderson"]["k2"],
        paints=paints,
    )


CATALOG = _load()


def km_by_id(paint_id: str) -> KmSpectrum | None:
    return CATALOG.paints.get(paint_id)


def wavelengths() -> list[int]:
    start = CATALOG.start_wavelength
    step = CATALOG.wavelength_interval
    count = len(next(iter(CATALOG.paints.values())).k)
    return [start + i * step for i in range(count)]
