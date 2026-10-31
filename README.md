# Palette Lab

An instrument for turning digital colors into reproducible physical paint.

Palette Lab sits between image analysis, color science, and acrylic mixing. The long-term workflow is:

```
Image → analysis → Celebi quantization → palette
  → map colors onto available pigments
  → physical recipes (mg)
  → mix on the bench
  → measure the result
  → calibrate the model
```

This repository is the architecture and the first working surface: load an image, extract a real Celebi palette, inspect colors in HCT or OkLCH, browse a development paint library, and solve milligram recipes with the Python KM mixer in the browser. Hardware and calibration remain typed TODOs.

## Run

```sh
npm install
npm run dev
```

```sh
npm test
npm run build
npm run check
```

Vite + Svelte 5 + TypeScript + UnoCSS. No backend. First load downloads [Pyodide](https://pyodide.org/en/0.28.0/usage/quickstart.html) and installs [ColorAide](https://facelessuser.github.io/coloraide/) in a Web Worker.

## What is real

- **Celebi quantization** via [`@material/material-color-utilities`](https://www.npmjs.com/package/@material/material-color-utilities) `QuantizerCelebi.quantize` (Wu initialization + Wsmeans in D65 Lab). Same algorithm family as [bevy_quantizer](https://github.com/mate-h/bevy_quantizer) and the [Extract Palette](https://observablehq.com/@mateh/extract-palette) notebook.
- **Color science** via ColorAide (`ColorAll`) running in Pyodide: sRGB, linear sRGB, XYZ D65, Lab D65, LCh D65, OkLCH, HCT, ΔE76 / ΔE2000, plus the rest of ColorAide’s space catalog through `colorEngine.convert` / `colorEngine.spaces`.
- **WebGPU viewport** for the source image (pan / zoom / fit). 2D canvas fallback if `navigator.gpu` is missing.
- Domain types for paint, pigment, palette, recipe, measurement, and a serializable project.

## Color pipeline

```
UI / stores
  → src/lib/color (TypeScript facade)
  → coloraide.worker.ts
  → Pyodide 0.28
  → ColorAide (pipeline.py) + science/ (KM solver)
```

The UI never imports ColorAide, Pyodide, or MCU color converters. ARGB packing stays in TypeScript. Celebi still clusters in MCU’s D65 Lab; each palette entry is then expanded through ColorAide so HCT / OkLCH / Lab / ΔE share one scientific backend.

Pyodide is loaded from `https://cdn.jsdelivr.net/pyodide/v0.28.0/full/`. ColorAide is installed with micropip on first run.

## What is not implemented

| Area | Status |
|---|---|
| Physical mixing / Kubelka–Munk | Python solver in the Pyodide worker (`science.solve`) |
| GPU Celebi compute | `GpuCelebiQuantizer` stub — port [bevy_quantizer](https://github.com/mate-h/bevy_quantizer) WGSL |
| Quantized overlay remap | TODO (`remap.wgsl`) |
| Web Worker for CPU Celebi | TODO — currently main-thread |
| Spectrometer / camera | Measurement types only |
| Scale / dispenser | `WeightRequest` / `MeasuredWeight` / `DispenseStatus` only |
| Persistence | `serializeProject` JSON; image bytes and IndexedDB are TODO |

Sample palette recipes in the empty workspace are labeled **Mock**. They demonstrate the inspector, not a solved mix.

## Architecture

```
src/lib/
  color/           ColorAide worker facade + ΔE (no UI)
  domain/          Paint, Palette, Recipe, Measurement, Project
  features/
    image/         File → ImageBitmap, ARGB extract
    viewport/      WebGPU display
    quantization/  Quantizer interface + MCU Celebi
    recipes/       weights + RecipeEngine
    measurements/  closed-loop types
    palette/ paints/
  stores/          Svelte 5 rune modules
  components/      laboratory UI (bits-ui primitives + UnoCSS)
  data/            development paints + sample palette
```

Target color, predicted physical mix, and measured physical mix are separate fields. RGB interpolation is not a mixing model.

## Quantization

CPU path: downsample to a max edge of **256 px** (MCU docs use ~128; this is a quality/speed compromise), skip pixels with alpha &lt; 255, run `QuantizerCelebi.quantize`. Palette size is clamped to `2..=128`, matching bevy_quantizer.

HCT / OkLCH is a **display and future mapping** working space, not a second quantizer. Celebi stays in D65 Lab (CIE76).

GPU path (future): histogram 5-bit RGB bins → compact Lab points → Wu moments / box cuts → Wsmeans → fullscreen Lab nearest-color remap. See `src/shaders/quantize.wgsl` and `remap.wgsl` in [bevy_quantizer](https://github.com/mate-h/bevy_quantizer).

## Science prototype

A Python closed-loop solver lives in [`science/`](science/README.md). The Vite app mounts those modules into the Pyodide worker and solves from the inspector (KM or ColorAide hex-spectral). The same code still runs from the CLI:

```sh
python3 -m venv science/.venv && source science/.venv/bin/activate
pip install -r science/requirements.txt
python -m science --hex 6B2A3C
```

sRGB target → milligram recipe from the development paint library → two-constant KM prediction → ΔE00.

## Paint library

Development data is a Golden Heavy Body Acrylic Essentials-style set plus Yellow Ochre. Catalog hex values are approximations. The library is extensible; those seven tubes are not application constants.

## UI

Headless primitives from [bits-ui](https://github.com/huntabyte/bits-ui) (Tabs, ToggleGroup, Slider, Switch, Tooltip, Dialog, Separator, Label, Button), styled with UnoCSS. No Tailwind, no SaaS dashboard kit.
