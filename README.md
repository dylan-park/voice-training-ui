# Voice Garden

![HLdkXJnXwAAVpuS.jpg](HLdkXJnXwAAVpuS.jpg)

This is the only part of this repo that is primarily written by a human!! I am warning you this because I think AI disclosure is important.

This is a cozy voice feminization tool that will analyze your voice and show you metrics. I am not a professional, these metrics are my best understanding of what is useful and accurate but could be entirely wrong. Please use this as only one tool in your voice fem toolkit.

Voice Garden relies heavily on the use of Claude Code, please use Claude Code or a similar coding agent. This tool produces analysis of each voice sample using AI based on your metrics. Instead of embedding this into the UI, it is implemented using skills, so the primary way of interacting with this codebase is via a coding agent, which will run the proper skills and update the UI with the results.

For best results, I recommend that you read the same passage with a similar microphone for all of your tests, so they can be reliably compared. I personally use the Rainbow Passage.

## Usage

Open your coding agent of choice and ask it to read CLAUDE.md. It will give you a summary of how to use this application and work with you to analyze your voice.

If you don't know what a coding agent is or how to do this, DM me. I will see about packaging it for you in an easier format, but it will be less useful as I will have to remove the AI features.

## Browser-only analysis spike

There is an experimental `praat-wasm/` package that defines the browser-side
analysis boundary for a headless Praat WebAssembly build. It includes a
JavaScript PCM fallback analyzer plus a real Praat WASM wrapper for mono PCM to
`Sound_to_Pitch`, exposed through the same worker/result shape the dashboard can
consume.

```sh
cd praat-wasm
npm run fetch:praat
npm run build:praat-libs -- --jobs=2
npm run build:wasm
npm test
npm run smoke:wasm
npm run smoke:browser
npm run bench -- 30
```

Generated Praat source, Emscripten SDK files, and WASM artifacts live under
ignored `praat-wasm/vendor/` and `praat-wasm/dist/` paths. See
`praat-wasm/PORTING.md` for the C++/Emscripten path and remaining parity work.

## License

Voice Garden is licensed under the **GNU Affero General Public License, version
3 or later** (`AGPL-3.0-or-later`; see `LICENSE`).

This is explicit because Voice Garden uses **Praat** through
**praat-parselmouth** for Python analysis and includes a Praat-derived
WebAssembly build path in `praat-wasm/`. Praat and praat-parselmouth are
GPLv3-or-later; AGPLv3-or-later is the project's stronger compatible copyleft
choice so network-hosted versions keep the same source-sharing expectations.

## Credits & third-party assets

- **Reference voices** — the preview clips in `dashboard-react/public/reference-audio/` and the measured values in `reference.json` are derived from the **VCTK Corpus** (CSTR, University of Edinburgh — Veaux, Yamagishi & MacDonald), licensed **CC BY 4.0**. The clips were trimmed and transcoded. These files remain under **CC BY 4.0**. <https://datashare.ed.ac.uk/handle/10283/3443> · <https://creativecommons.org/licenses/by/4.0/>
- **Praat** (Boersma & Weenink) and **praat-parselmouth** (Jadoul, Thompson & de Boer), both **GPLv3-or-later**, power the analysis paths.
- Other dependencies (React, Vite, wavesurfer.js, NumPy, …) retain their own respective licenses.
