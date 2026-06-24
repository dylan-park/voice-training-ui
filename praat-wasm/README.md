# Praat WASM spike

This package is the browser-facing boundary for a headless Praat WebAssembly
build. It contains both a JavaScript fallback analyzer and a Praat-backed WASM
path for browser-side voice metrics: mono PCM to Praat `Sound`, pitch,
resonance/formants, voice quality, intensity, phrase/register detail, and
corrected spectral weight.

## What works now

- `analyzePcm({ samples, sampleRate, label, note, registerFloor })`
- Duration, pitch contour, pitch summary, relative intensity, phrase splitting,
  and register detail from the JavaScript fallback.
- `analyzePcmWithPraat({ samples, sampleRate, label, note, registerFloor })`
  loads `dist/praat-voice-garden.js`, runs real Praat analysis, and returns the
  existing Voice Garden `Recording` / `RecordingDetail` shape.
- Praat-backed pitch, vowel-gated F1/F2/F3 resonance, HNR clarity, jitter and
  shimmer steadiness, intensity, phrase segmentation/register landing, and
  corrected H1*-A3* weight summaries.
- A Web Worker entrypoint and a small client wrapper. The worker tries Praat WASM
  first and falls back to JavaScript if the WASM artifact is unavailable.
- Node tests, a synthetic benchmark, and a WASM smoke test.

## What is intentionally not done yet

- No upstream Praat source or Emscripten SDK is committed here; both live under
  ignored `vendor/` directories.
- The current Praat build uses Praat static libraries built from the vendored
  source. It is viable, but not yet size-pruned to the hand-minimal object list.
- The legacy LTAS tilt secondary weight metric still returns `null`; the
  corrected H1*-A3* headline weight metric is wired in.

## Praat/Emscripten path

```sh
cd praat-wasm
npm run fetch:praat
npm run build:praat-libs -- --jobs=2
npm run build:wasm
npm run smoke:wasm
npm run smoke:browser
```

The generated WASM artifact is ignored at `dist/`. The project is licensed as
AGPL-3.0-or-later; this package links Praat's GPLv3-or-later code in that
artifact, and Voice Garden chooses Affero copyleft for network-hosted use.
