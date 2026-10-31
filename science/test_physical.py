"""Validate two-constant KM mixing and the recipe solver."""

from __future__ import annotations

import unittest

import numpy as np

from science.color import color_from_hex, delta_e
from science.paints import LIBRARY, available, by_id
from science.physical import (
    K1,
    K2,
    internal_reflectance,
    masstone,
    mix_spectrum,
    predict,
    reflectance_to_xyz,
    saunderson_spex,
)
from science.solve import solve


class TestKubelkaMunkIdentities(unittest.TestCase):
    def test_zero_absorption_is_perfect_internal_reflector(self):
        r = internal_reflectance(np.zeros(8), np.ones(8))
        np.testing.assert_allclose(r, 1.0, atol=1e-12)

    def test_spex_saunderson_on_perfect_reflector(self):
        r = saunderson_spex(np.array([1.0]))
        self.assertAlmostEqual(float(r[0]), (1 - K1) * (1 - K2) / (1 - K2), places=12)

    def test_strong_absorption_goes_black(self):
        r = internal_reflectance(np.array([1e6]), np.array([1.0]))
        self.assertLess(float(r[0]), 1e-6)

    def test_perfect_diffuser_has_unit_y(self):
        xyz = reflectance_to_xyz(np.ones(38))
        self.assertAlmostEqual(float(xyz[1]), 1.0, places=9)


class TestPhysicalMixes(unittest.TestCase):
    def test_mass_scale_does_not_change_color(self):
        paints = available(["tw", "qm"])
        a = predict(paints, [80.0, 20.0])
        b = predict(paints, [8.0, 2.0])
        self.assertLess(delta_e(a, b), 1e-6)

    def test_white_is_lighter_than_magenta(self):
        white = masstone(by_id("tw"))
        magenta = masstone(by_id("qm"))
        self.assertGreater(white.convert("lab-d65")["l"], 80)
        self.assertLess(magenta.convert("lab-d65")["l"], white.convert("lab-d65")["l"] - 20)

    def test_black_is_dark(self):
        black = masstone(by_id("cb"))
        self.assertLess(black.convert("lab-d65")["l"], 40)

    def test_magenta_tints_are_monotonic_in_lightness(self):
        paints = available(["tw", "qm"])
        lights = [
            predict(paints, [1.0 - c, c]).convert("lab-d65")["l"]
            for c in (0.05, 0.2, 0.5, 1.0)
        ]
        self.assertTrue(all(a > b for a, b in zip(lights, lights[1:])))

    def test_blue_plus_yellow_is_green_not_gray(self):
        green = predict(available(["pb", "by"]), [50.0, 50.0])
        lab = green.convert("lab-d65")
        self.assertLess(lab["a"], 0)
        self.assertGreater(lab["b"], 0)
        self.assertGreater(lab["l"], 20)

    def test_phthalo_blue_plus_white_stays_blue(self):
        tint = predict(available(["tw", "pb"]), [90.0, 10.0])
        lab = tint.convert("lab-d65")
        self.assertLess(lab["b"], 0)


class TestPhysicalSolver(unittest.TestCase):
    def test_round_trip_white_magenta_tint(self):
        paints = available(["tw", "qm"])
        target = predict(paints, [170.0, 30.0])
        recipe = solve(target, paints, total_mass_mg=200, l1=0.0)
        self.assertLess(recipe.delta_e, 0.5)
        by_id_frac = {item.paint.id: item.percent for item in recipe.ingredients}
        self.assertAlmostEqual(by_id_frac.get("tw", 0), 85.0, delta=4)
        self.assertAlmostEqual(by_id_frac.get("qm", 0), 15.0, delta=4)

    def test_recovers_quinacridone_masstone(self):
        target = masstone(by_id("qm"))
        recipe = solve(target, list(LIBRARY), total_mass_mg=200)
        self.assertLess(recipe.delta_e, 3.0)
        dominant = max(recipe.ingredients, key=lambda item: item.percent)
        self.assertEqual(dominant.paint.id, "qm")
        self.assertGreater(dominant.percent, 90)

    def test_in_gamut_ochre_tint_round_trips(self):
        paints = available(["tw", "yo"])
        target = predict(paints, [198.8, 1.2])
        recipe = solve(target, list(LIBRARY), total_mass_mg=200, l1=0.0)
        self.assertLess(recipe.delta_e, 1.0)
        self.assertTrue(any(item.paint.id == "tw" for item in recipe.ingredients))

    def test_warm_ground_stays_near_physical_gamut(self):
        """#E8D9B8 sits outside this library's KM gamut (best tint ~ΔE 3.7)."""
        recipe = solve(color_from_hex("#E8D9B8"), list(LIBRARY), total_mass_mg=200)
        self.assertLess(recipe.delta_e, 8.0)
        self.assertTrue(any(item.paint.id == "tw" for item in recipe.ingredients))
        self.assertTrue(any(item.paint.id in {"by", "yo"} for item in recipe.ingredients))

    def test_magenta_shadow_uses_qm(self):
        recipe = solve(color_from_hex("#6B2A3C"), list(LIBRARY), total_mass_mg=200)
        self.assertLess(recipe.delta_e, 5.0)
        self.assertTrue(any(item.paint.id == "qm" for item in recipe.ingredients))

    def test_mix_spectrum_concentrations_sum_to_one(self):
        mixed = mix_spectrum(available(["tw", "pb", "by"]), [100.0, 40.0, 60.0])
        self.assertAlmostEqual(float(mixed.concentrations.sum()), 1.0)
        self.assertEqual(len(mixed.reflectance), 38)


if __name__ == "__main__":
    unittest.main()
