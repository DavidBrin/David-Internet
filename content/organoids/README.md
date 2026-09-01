# Organoids on Psychedelics — demo

Scroll-through rebuild of David's Voytek Lab organoid-electrophysiology
analysis year (Jul 2024 – Jun 2025), live at `/demos/organoids`.

## What is on the page

Five chronological chapters; the page's polish intentionally ramps with the
analysis (chapters 1–2 look like lab-notebook scratch, 4–5 use the full design
language):

1. **Raw voltage** (`#raw`) — a well's LFP streaming at 100 Hz with the MATLAB
   preprocessing chain (Axion raw 12.5 kHz → bandpass → downsample → HDF5)
   toggleable stage by stage.
2. **What's in a spectrum** (`#spectrum`) — FOOOF decomposition animated: the
   aperiodic 1/f fit slides under the spectrum, then Gaussian peaks pop out one
   at a time; fixed vs knee toggle.
3. **Dose and time** (`#dose`) — Plate D (5-MeO-DMT 10/20 µM vs methanol/blank),
   D-1→D20 day slider, per-well mini spectra, and the parameter-heatmap mode;
   windowed analysis (`ds_power_windows` / `fooof_on_windows`).
4. **Four compounds, sixty days** (`#compounds`) — Plate F (psilocybin / LSD /
   psilocin / vehicle, stim vs no-stim), 48-well spike raster with
   `isi_array` → `burst_rate` → `network_events` firing visibly, and
   dose-response boxplots with a stim toggle.
5. **The library** (`#library`) — animated dependency map of the 25 functions in
   `General_LFP_analysis_functions.py` (the planning spec said 26 — the file
   defines 25 top-level functions); node cards link back to the chapters.

## Data honesty

**No lab data ships with this page.** Every interactive panel runs on seeded
synthetic signals (colored noise with dose-conditioned spectral parameters,
`core/synth.ts`) and carries an "illustrative data" label. The real figures
beside each panel are David's own rendered analysis outputs, extracted from the
notebooks at build time (~25 curated images). The page makes no claims about
drug effects and says nothing about publication status.

## Attribution

Organoid culture, recordings, and experimental design by Voytek Lab
collaborators; preprocessing, analysis pipeline, and figures by David.
FOOOF/specparam is Voytek Lab software. A collaborator's machine path in
`lfp_processing.m` is redacted in the shipped copy (`demos/organoids_src/`).

## Completed / fixed with AI tools (2026-09-01)

- TypeScript port of FOOOF 1.1's fit algorithm (`core/specparam.ts`) — robust
  aperiodic fit, iterative peak search, joint gaussian refit — fixture-tested
  against the Python package in fixed and knee modes
  (`tests/organoids-core.test.ts`); `welch.ts` reproduces the notebooks' exact
  PSD path (scipy `spectrogram`, noverlap = nperseg//8, mean average).
- `bursts.ts` is an exact port of `isi_array` / `burst_rate` / `network_events`.

## Building

```
pnpm sync-demos organoids   # needs py -3.12 + numpy/neurodsp/fooof/Pillow
pnpm test                   # includes tests/organoids-core.test.ts
```
