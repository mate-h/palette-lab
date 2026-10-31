"""ColorAide setup for the recipe prototype.

Spectral (Kubelka–Munk) mixing is a ColorAide interpolator, not registered
on the default Color class. HCT is registered so reports match the app.
"""

from __future__ import annotations

from coloraide.everything import ColorAll as _Color
from coloraide.interpolate.spectral import Spectral


class Color(_Color):
    """ColorAide with spectral KM mixing and the full space catalog."""

    DELTA_E = "2000"


Color.register(Spectral(), overwrite=True)


def color_from_srgb(red: float, green: float, blue: float) -> Color:
    """Build a Color from sRGB. Values in 0–1, or 0–255 if any channel > 1."""
    if max(red, green, blue) > 1.0:
        red, green, blue = red / 255.0, green / 255.0, blue / 255.0
    return Color("srgb", [red, green, blue])


def color_from_hex(hex_color: str) -> Color:
    if not hex_color.startswith("#"):
        hex_color = f"#{hex_color}"
    return Color(hex_color)


def to_hex(color: Color) -> str:
    fitted = color.convert("srgb")
    fitted.fit()
    red, green, blue = [
        max(0, min(255, round(channel * 255))) for channel in fitted.coords(nans=False)[:3]
    ]
    return f"#{red:02x}{green:02x}{blue:02x}"


def delta_e(a: Color, b: Color, method: str = "2000") -> float:
    return float(a.delta_e(b, method=method))


def describe(color: Color) -> dict[str, object]:
    srgb = color.convert("srgb")
    lab = color.convert("lab-d65")
    oklch = color.convert("oklch")
    hct = color.convert("hct")
    return {
        "hex": to_hex(color),
        "srgb": [round(c, 4) for c in srgb.coords(nans=False)[:3]],
        "lab": [round(c, 2) for c in lab.coords(nans=False)[:3]],
        "oklch": [round(c, 4) for c in oklch.coords(nans=False)[:3]],
        "hct": [round(c, 2) for c in hct.coords(nans=False)[:3]],
    }
