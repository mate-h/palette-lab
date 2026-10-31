"""Development paint library — same fixtures as the Svelte app.

Catalog hex values are appearance approximations, not measured reflectance.
"""

from __future__ import annotations

from dataclasses import dataclass

from .color import Color, color_from_hex


@dataclass(frozen=True)
class Paint:
    id: str
    name: str
    manufacturer: str
    colour_index: str
    pigment_name: str
    hex: str
    opacity: str
    tinting_strength: float
    density_g_per_ml: float | None
    color: Color


def _paint(
    paint_id: str,
    name: str,
    colour_index: str,
    pigment_name: str,
    hex_color: str,
    opacity: str,
    tinting_strength: float,
    density_g_per_ml: float | None = None,
) -> Paint:
    return Paint(
        id=paint_id,
        name=name,
        manufacturer="Golden",
        colour_index=colour_index,
        pigment_name=pigment_name,
        hex=hex_color,
        opacity=opacity,
        tinting_strength=tinting_strength,
        density_g_per_ml=density_g_per_ml,
        color=color_from_hex(hex_color),
    )


LIBRARY: tuple[Paint, ...] = (
    _paint("tw", "Titanium White", "PW6", "Titanium Dioxide", "#F4F1E8", "opaque", 0.35, 1.4),
    _paint("cb", "Carbon Black", "PBk7", "Carbon Black", "#1A1A1A", "opaque", 1.1, 1.3),
    _paint(
        "by",
        "Benzimidazolone Yellow Medium",
        "PY154",
        "Benzimidazolone Yellow",
        "#E8B400",
        "semi-opaque",
        1.0,
    ),
    _paint("qm", "Quinacridone Magenta", "PR122", "Quinacridone Magenta", "#9B1B4A", "transparent", 1.2),
    _paint("pb", "Phthalo Blue (Green Shade)", "PB15:3", "Copper Phthalocyanine", "#0A3D7A", "transparent", 1.4),
    _paint(
        "pg",
        "Phthalo Green (Blue Shade)",
        "PG7",
        "Chlorinated Copper Phthalocyanine",
        "#0B5C4A",
        "transparent",
        1.3,
    ),
    _paint("yo", "Yellow Ochre", "PY43", "Natural Hydrated Iron Oxide", "#C8A04A", "semi-opaque", 0.7, 1.5),
)


def available(ids: list[str] | None = None) -> list[Paint]:
    if not ids:
        return list(LIBRARY)
    wanted = set(ids)
    paints = [paint for paint in LIBRARY if paint.id in wanted]
    missing = wanted.difference(paint.id for paint in paints)
    if missing:
        raise KeyError(f"Unknown paint ids: {', '.join(sorted(missing))}")
    return paints


def by_id(paint_id: str) -> Paint:
    for paint in LIBRARY:
        if paint.id == paint_id:
            return paint
    raise KeyError(paint_id)


def paint_from_spec(spec: dict[str, object]) -> Paint:
    """Build a library paint from the Svelte worker payload."""
    density = spec.get("densityGPerMl")
    return _paint(
        str(spec["id"]),
        str(spec.get("name") or spec["id"]),
        str(spec.get("colourIndex") or ""),
        str(spec.get("pigmentName") or ""),
        str(spec["hex"]),
        str(spec.get("opacity") or "opaque"),
        float(spec.get("tintingStrength") or 1.0),
        None if density is None else float(density),
    )
