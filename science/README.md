# Palette Lab science pipeline

Standalone Python prototype for the physical recipe solver. The Svelte app mounts this package into the Pyodide worker and calls `solve_from_payload`.

Start from an **sRGB target**. Solve a milligram recipe using the Golden-style library. Predict the mix with **two-constant Kubelka–Munk** from Berns / Unicolour K/S (Saunderson SPEX, CIE 1931 2° × D65). Compare target vs predicted (and later measured).

```
sRGB target
    → ColorAide Color
    → optimizer (mass fractions)
    → K_mix = Σ cᵢ Kᵢ,  S_mix = Σ cᵢ Sᵢ
    → R∞ → Saunderson SPEX → XYZ D65
    → ΔE00(target, predicted)
    → [optional] measured mix
```

Exact K/S: **tw**, **qm**, **pb**, **pg**. Substitutes: **cb** ← Bone Black PBk9, **by** ← Hansa Yellow Opaque PY74, **yo** ← GoldenSpectra Yellow Ochre K/S with S=1.

ColorAide’s single-constant hex-spectral mix is still available as `predict_coloraide`.

## Setup

From the repo root:

```sh
python3 -m venv science/.venv
source science/.venv/bin/activate
pip install -r science/requirements.txt
```

## Run

```sh
python -m science --hex 6B2A3C
python -m science --hex '#E8D9B8' --mass 200 --max-ingredients 4
python -m science --srgb 107 42 60 --paints tw,qm,cb,yo
python -m science --demo
python -m science --validate
python -m science --hex 1E3A4C --json
```

`--srgb` accepts 0–1 or 0–255. Paint ids: `tw` `cb` `by` `qm` `pb` `pg` `yo`.

```sh
python -m unittest science.test_physical
```

Exit code `2` from a solve means ΔE00 > 3 (marked `infeasible`). The recipe is still printed.

## Closed loop

`close_loop(target, paints)` always fills **target** and **predicted**.

`ingest_measurement(recipe, measured)` is the hook for a real mixed swatch (camera or spectrometer).

## What this is not

- Not RGB interpolation
- Substitute coefficients are labeled; they are not the missing pigments
