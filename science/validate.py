"""Print a physical-mixer validation report and run the unit tests."""

from __future__ import annotations

import unittest

from .color import color_from_hex, describe, to_hex
from .km import km_by_id
from .paints import LIBRARY, available, by_id
from .physical import masstone, predict
from .solve import solve
from .test_physical import (
    TestKubelkaMunkIdentities,
    TestPhysicalMixes,
    TestPhysicalSolver,
)


def main() -> int:
    print("Masstones (two-constant KM, CIE 1931 2° × D65)")
    print(f"{'id':<4} {'name':<32} {'hex':<8} {'L*':>6} {'a*':>7} {'b*':>7} subst")
    for paint in LIBRARY:
        color = masstone(paint)
        lab = color.convert("lab-d65")
        spectrum = km_by_id(paint.id)
        flag = "yes" if spectrum and spectrum.substitute else ""
        print(
            f"{paint.id:<4} {paint.name:<32} {to_hex(color):<8} "
            f"{lab['l']:6.1f} {lab['a']:7.1f} {lab['b']:7.1f} {flag}"
        )

    print("\nKnown mixes")
    cases = [
        ("85/15 TW+QM", available(["tw", "qm"]), [170, 30]),
        ("90/10 TW+PB", available(["tw", "pb"]), [180, 20]),
        ("50/50 PB+BY", available(["pb", "by"]), [100, 100]),
        ("70/30 TW+YO", available(["tw", "yo"]), [140, 60]),
    ]
    for label, paints, masses in cases:
        color = predict(paints, masses)
        lab = describe(color)["lab"]
        print(f"  {label:<14} {to_hex(color)}  Lab {lab}")

    print("\nSolver round-trips and targets")
    targets = [
        ("TW+QM 85/15", predict(available(["tw", "qm"]), [170, 30]), available(["tw", "qm"])),
        ("QM masstone", masstone(by_id("qm")), list(LIBRARY)),
        ("warm ground", color_from_hex("#E8D9B8"), list(LIBRARY)),
        ("magenta shadow", color_from_hex("#6B2A3C"), list(LIBRARY)),
        ("phthalo dusk", color_from_hex("#1E3A4C"), list(LIBRARY)),
    ]
    for label, target, paints in targets:
        recipe = solve(target, paints, total_mass_mg=200)
        parts = ", ".join(f"{item.paint.id} {item.weight_mg:.0f}mg" for item in recipe.ingredients)
        print(
            f"  {label:<16} ΔE00 {recipe.delta_e:5.2f}  {recipe.feasibility:<10} "
            f"{to_hex(recipe.target)} → {to_hex(recipe.predicted)}  {parts}"
        )

    print("\nUnit tests")
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()
    for case in (TestKubelkaMunkIdentities, TestPhysicalMixes, TestPhysicalSolver):
        suite.addTests(loader.loadTestsFromTestCase(case))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1
