"""CLI: sRGB target → milligram recipe from the development paint library.

Examples:
  python -m science --hex 6B2A3C
  python -m science --hex '#E8D9B8' --mass 200 --max-ingredients 4
  python -m science --srgb 0.42 0.16 0.24 --paints tw,qm,cb,yo
  python -m science --demo
  python -m science --validate
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow `python -m science` from the repo root or from science/.
if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from science.color import color_from_hex, color_from_srgb, describe, to_hex
    from science.loop import close_loop
    from science.paints import LIBRARY, available
else:
    from .color import color_from_hex, color_from_srgb, describe, to_hex
    from .loop import close_loop
    from .paints import LIBRARY, available


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Solve a physical paint recipe from an sRGB target")
    parser.add_argument("--hex", help="Target sRGB hex, with or without #")
    parser.add_argument("--srgb", nargs=3, type=float, metavar=("R", "G", "B"), help="Target sRGB 0–1 or 0–255")
    parser.add_argument("--mass", type=float, default=200, help="Total recipe mass in mg (default 200)")
    parser.add_argument("--paints", help="Comma-separated paint ids (default: full library)")
    parser.add_argument("--max-ingredients", type=int, default=None)
    parser.add_argument("--min-mg", type=float, default=1.0)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--demo", action="store_true", help="Solve a few sample targets")
    parser.add_argument("--validate", action="store_true", help="Run physical mixer checks")
    args = parser.parse_args(argv)

    if args.validate:
        if __package__ in {None, ""}:
            from science.validate import main as validate_main
        else:
            from .validate import main as validate_main
        return validate_main()

    if args.demo:
        return _demo(args)

    if args.hex:
        target = color_from_hex(args.hex)
    elif args.srgb:
        target = color_from_srgb(*args.srgb)
    else:
        parser.error("Provide --hex, --srgb, --demo, or --validate")

    paints = available(args.paints.split(",") if args.paints else None)
    observation = close_loop(
        target,
        paints,
        total_mass_mg=args.mass,
        max_ingredients=args.max_ingredients,
        min_mg=args.min_mg,
    )
    _print_observation(observation, as_json=args.json)
    return 0 if observation.recipe.feasibility == "ok" else 2


def _demo(args: argparse.Namespace) -> int:
    samples = [
        ("warm ground", "#E8D9B8"),
        ("magenta shadow", "#6B2A3C"),
        ("phthalo dusk", "#1E3A4C"),
        ("ochre", "#C8A04A"),
    ]
    paints = available(args.paints.split(",") if args.paints else None)
    code = 0
    for label, hex_color in samples:
        print(f"\n=== {label}  {hex_color} ===")
        observation = close_loop(
            color_from_hex(hex_color),
            paints,
            total_mass_mg=args.mass,
            max_ingredients=args.max_ingredients,
            min_mg=args.min_mg,
        )
        _print_observation(observation, as_json=args.json)
        if observation.recipe.feasibility != "ok":
            code = 2
    return code


def _print_observation(observation, as_json: bool) -> None:
    if as_json:
        print(json.dumps(observation.as_dict(), indent=2))
        return

    recipe = observation.recipe
    print(f"Target     {to_hex(recipe.target)}   {describe(recipe.target)}")
    print(f"Predicted  {to_hex(recipe.predicted)}   {describe(recipe.predicted)}")
    print(f"ΔE00 target↔predicted  {recipe.delta_e:.2f}   {recipe.feasibility}")
    if observation.measured is not None:
        print(f"Measured   {to_hex(observation.measured)}")
        print(f"ΔE00 target↔measured   {observation.delta_e_measured:.2f}")
        print(f"ΔE00 predicted↔measured {observation.delta_e_pred_vs_meas:.2f}")
    print(f"Total      {recipe.total_mass_mg:.0f} mg")
    print(f"{'Paint':<32} {'mg':>8} {'%':>8}")
    for item in recipe.ingredients:
        print(f"{item.paint.name:<32} {item.weight_mg:8.0f} {item.percent:8.1f}")
    print(recipe.notes)
    print("Paints: " + ", ".join(f"{paint.id}={paint.name}" for paint in LIBRARY))


if __name__ == "__main__":
    raise SystemExit(main())
