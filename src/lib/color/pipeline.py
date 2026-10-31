"""ColorAide pipeline running inside the Pyodide worker."""

from __future__ import annotations

import json

try:
    from coloraide.everything import ColorAll as Color
except Exception:  # pragma: no cover - older ColorAide layouts
    from coloraide import Color
    from coloraide.spaces.hct import HCT

    if "hct" not in Color.CS_MAP:
        Color.register(HCT())


def _coords(color: Color, space: str) -> list[float]:
    converted = color.convert(space)
    return [float(value) for value in converted.coords(nans=False)]


def _hex(color: Color) -> str:
    srgb = color.convert("srgb")
    srgb.fit()
    red, green, blue = [
        max(0, min(255, round(channel * 255))) for channel in srgb.coords(nans=False)[:3]
    ]
    return f"#{red:02x}{green:02x}{blue:02x}"


def _css(color: Color) -> str:
    p3 = color.convert("display-p3")
    if p3.in_gamut():
        red, green, blue = [float(value) for value in p3.coords(nans=False)[:3]]
        return f"color(display-p3 {red:.5f} {green:.5f} {blue:.5f})"
    xyz = color.convert("xyz-d65")
    x, y, z = [float(value) for value in xyz.coords(nans=False)[:3]]
    return f"color(xyz-d65 {x:.5f} {y:.5f} {z:.5f})"


def _sample(color: Color) -> dict:
    srgb = _coords(color, "srgb")
    linear = _coords(color, "srgb-linear")
    xyz = _coords(color, "xyz-d65")
    lab = _coords(color, "lab-d65")
    lch = _coords(color, "lch-d65")
    oklch = _coords(color, "oklch")
    hct = _coords(color, "hct")
    p3 = _coords(color, "display-p3")
    rec = _coords(color, "rec2020")
    try:
        jzazbz = _coords(color, "jzazbz")
    except Exception:
        jzazbz = [0.0, 0.0, 0.0]
    return {
        "hex": _hex(color),
        "css": _css(color),
        "srgb": {"r": srgb[0], "g": srgb[1], "b": srgb[2]},
        "linearRgb": {"r": linear[0], "g": linear[1], "b": linear[2]},
        "displayP3": {"r": p3[0], "g": p3[1], "b": p3[2]},
        "rec2020": {"r": rec[0], "g": rec[1], "b": rec[2]},
        "xyz": {"x": xyz[0], "y": xyz[1], "z": xyz[2]},
        "lab": {"l": lab[0], "a": lab[1], "b": lab[2]},
        "lch": {"l": lch[0], "c": lch[1], "h": lch[2]},
        "oklch": {"l": oklch[0], "c": oklch[1], "h": oklch[2]},
        "hct": {"h": hct[0], "c": hct[1], "t": hct[2]},
        "jzazbz": {"jz": jzazbz[0], "az": jzazbz[1], "bz": jzazbz[2]},
        "relativeLuminance": xyz[1],
        "inSrgbGamut": bool(color.in_gamut("srgb")),
    }


def sample_from_srgb(red: float, green: float, blue: float) -> dict:
    return _sample(Color("srgb", [red, green, blue]))


def samples_from_hex_json(payload: str) -> str:
    hexes = json.loads(payload)
    return json.dumps([_sample(Color(hex_color)) for hex_color in hexes])


def samples_from_lab_json(payload: str) -> str:
    samples = []
    for lab in json.loads(payload):
        samples.append(_sample(Color("lab-d65", [lab["l"], lab["a"], lab["b"]])))
    return json.dumps(samples)


def samples_from_argb_json(payload: str) -> str:
    samples = []
    for argb in json.loads(payload):
        value = int(argb)
        red = ((value >> 16) & 255) / 255
        green = ((value >> 8) & 255) / 255
        blue = (value & 255) / 255
        samples.append(sample_from_srgb(red, green, blue))
    return json.dumps(samples)


def delta_e_json(payload: str) -> str:
    data = json.loads(payload)
    method = data.get("method", "2000")
    first = Color(data["a"])
    second = Color(data["b"])
    return json.dumps(float(first.delta_e(second, method=method)))


def convert_json(payload: str) -> str:
    data = json.loads(payload)
    return json.dumps(_coords(Color(data["hex"]), data["space"]))


def list_spaces_json() -> str:
    return json.dumps(sorted(Color.CS_MAP.keys()))


def solve_recipe_json(payload: str) -> str:
    """Run the science solver (KM or hex-spectral) and attach a ColorAide sample."""
    from science.solve import solve_from_payload

    result = json.loads(solve_from_payload(payload))
    result["predictedSample"] = _sample(Color(result["predictedHex"]))
    return json.dumps(result)
