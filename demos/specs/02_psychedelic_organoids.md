# 02 — Organoids on Psychedelics (Voytek Lab, Jul 2024 – Jun 2025)

Slug: `organoids` · Fake domain: `organoids.davids.net` · Archetype: **B (scrollytelling timeline) + A (interactive panels)**
Status: spec agreed 2026-08-29; **built 2026-09-01** - five chapters live with the polish ramp
(ch1-2 notebook aesthetic, ch4-5 polished); TS port of FOOOF 1.1 (fixed+knee, robust ap fit +
iterative peak search + joint refit) fixture-tested vs the real package; welch matches the
notebooks' actual path (scipy spectrogram, noverlap=nperseg//8); isi/burst/network-event ports
exact-match. 25 curated real figures ship (~30 planned); interactive panels all synthetic +
labeled. CORRECTION: `General_LFP_analysis_functions.py` defines **25** top-level functions,
not 26. `lfp_processing.m` ships as a scrubbed copy (collaborator path redacted) in
demos/organoids_src/.

## Summary

A single long-scroll page that walks the reader **chronologically** through the project,
one chapter per plate, with the analysis getting visibly more sophisticated (and the page
visibly more polished) as you scroll — early chapters look like lab-notebook scratch,
the last chapters look like a finished figure set. Interactive panels run on **synthetic
data** (labeled as such); the **real figures** extracted from the notebooks sit alongside
each panel as "what it actually looked like".

The unifying visual is the **48-well MEA plate (6×8)**: it appears in every chapter,
gaining a dose overlay, then a day slider, then parameter heatmaps, then per-compound
comparisons.

## Source material

From `demos/psychedelic_organoids_raw/`:

| File / group | Date | Role in demo | Notes |
|---|---|---|---|
| `lfp_processing.m`, `LFP_Preprocessing_broadband.m`, `Spike_Processing.m` | Aug 2024 – May 2025 | Chapter 1: MATLAB preprocessing (Axion raw → filtered/downsampled HDF5, spike times) | MATLAB shown as code only; not executed |
| `ds_lfp_07-29-24.ipynb`, `Spike_data_psych_org.ipynb` | Jul–Sep 2024 | Chapter 1 figures: first downsampled LFP traces, first spike rasters | Extract PNGs |
| `A_LFP_analysis_functions.py`, `PlateA/*` | Sep 2024 | Chapter 2: Plate A pre/post-stim — first power spectra, first FOOOF | No dose grid on Plate A |
| `PlateD/PlateD-D-1.ipynb` (516 PNGs), `code_scraped…/PlateD-D{0,1,4,6,8,12,20}.py`, `PlateD/DeviationD.ipynb`, `PlateD_comparison.ipynb` | Oct–Dec 2024 | Chapter 3: Plate D — **5-MeO-DMT** 10 µM / 20 µM / Vehicle, D-1 → D20; windowed analysis; first deviation-from-baseline figures | Extract representative PNGs only |
| `PlateF/PlateF-D-1.ipynb` (572 PNGs), `code_scraped…/PlateF-D{0,1,4,6,8,11,30,60}.py`, `PlateF/Deviation.ipynb`, `PlateF_comparison*.ipynb` | Nov 2024 – Jan 2025 | Chapter 4: Plate F — **psilocybin / LSD / psilocin / Vehicle**, stim vs no-stim rows, D-1 → D60; knee-mode FOOOF; final comparison boxplots | The "nice" chapter |
| `General_LFP_analysis_functions.py` (26 functions, last edit Jun 2025) | Jun 2025 | Chapter 5: the consolidated library — every panel's TS port cites the function it mirrors | Authored "David Brin, 9-10-2024" |
| `code_scraped…/LFP_psych_through_FOOOF.py` (38 cells), `lfp_analysis.py` | — | Reference for the windowed/knee pipeline; Source drawer | Scraped from the 58/76 MB notebooks |

Data files: **none in repo** (unpublished lab data). Interactive panels use a synthetic
generator (below); figures are real.

## Page structure — five chronological chapters (scroll-driven)

A sticky progress rail on the left shows the timeline (Jul 2024 → Jun 2025) with the
current chapter highlighted; the plate graphic in the hero morphs as you scroll.
Visual polish intentionally ramps: ch. 1–2 use a monospace/"notebook" aesthetic with
matplotlib-default colors; ch. 3 introduces the dose palette; ch. 4–5 use the full
design language (smooth transitions, annotated axes, dark figure backgrounds).

### Chapter 1 — "Raw voltage" (Jul–Aug 2024)
- Panel: a single well's **LFP trace** streaming left→right on a canvas at 100 Hz (synthetic
  1/f + oscillatory bursts), with the MATLAB preprocessing chain drawn as a pipeline:
  Axion raw (12.5 kHz) → bandpass → downsample → HDF5. Toggling each stage changes the
  trace live (raw noise → filtered → downsampled dots).
- Real figures: first LFP plots from `ds_lfp_07-29-24.ipynb`.
- Text: MATLAB-first because Axion tooling is MATLAB; the pain that motivated moving to Python.

### Chapter 2 — "What's in a spectrum" (Sep 2024, Plate A)
- Panel: **FOOOF decomposition animation.** Click any well on the plate → its power
  spectrum draws in (log-log), then the aperiodic 1/f fit slides underneath, then
  Gaussian peaks pop out one at a time and get subtracted (mirrors
  `plot_annotated_peak_search` / `fooof_all_pspectra`). Readout: offset, exponent, peak
  (CF, PW, BW) values counting up. Toggle "fixed" vs "knee" aperiodic mode to preview why
  knee mode wins later.
- Real figures: Plate A `plot_all_pspectra` 6×8 grid, pre vs post stim.
- Text: first contact with FOOOF/specparam; the 6×8 grid habit begins.

### Chapter 3 — "Dose and time" (Oct–Dec 2024, Plate D · 5-MeO-DMT)
- Panel: **the plate gets a dose overlay** (Vehicle / 10 µM / 20 µM tint) and a **day
  slider** D-1 → D20. Each well shows a mini spectrum; a mode switch flips the plate to a
  **parameter heatmap** (`param_heatmap`: offset / exponent / peak power) whose colors
  tween as you scrub days — the headline animation.
- Second panel: **windowed analysis** — a time axis split into windows (`ds_power_windows`,
  `fooof_on_windows`); scrubbing highlights the window and updates its FOOOF params.
- Real figures: `DeviationD.ipynb` deviation-from-baseline plots; `PlateD_comparison`
  figures.
- Text: why per-well-per-day notebooks exploded to 39 MB each and what that taught you.

### Chapter 4 — "Four compounds, sixty days" (Nov 2024 – Jan 2025, Plate F)
- Panel: plate with the **Plate F layout** — columns psilocybin / LSD / psilocin / vehicle,
  rows stim vs no-stim; day slider D-1 → D60.
- Panel: **spike raster + burst / network-event detection.** 48-well raster (synthetic
  Poisson-with-bursts spikes); a cursor sweeps time, `isi_array` → `burst_rate` →
  `network_events` fire visibly (bursts glow per well, network events draw a vertical band
  across wells when ≥ N wells burst within the ISI threshold). Sliders: ISI threshold,
  min spikes.
- Panel: **dose-response boxplots** (interactive port of `plot_aperiodic_boxplot` /
  `plot_peak_boxplot2`): pick parameter × day, points animate into boxes grouped by
  compound; "stim" toggle. Real Plate F comparison figures beside it.
- Text: knee-mode FOOOF; comparing compounds; what did and didn't move.

### Chapter 5 — "The library" (Jun 2025)
- Panel: an **animated dependency map** of `General_LFP_analysis_functions.py` — 26 nodes
  (load → spectra → FOOOF → windows → spikes → bursts → heatmaps/boxplots), edges light up
  in the order a per-day notebook calls them. Clicking a node opens that function in the
  Source drawer and scrolls the page to the chapter where its panel lives.
- Text: consolidation from `A_LFP_…` to `General_LFP_…`; what you'd change next
  (batching, caching, a CLI).

## Story rail beats (interleaved with chapters)

1. Joining the Voytek Lab; organoids + MEA + psychedelics in one sentence.
2. MATLAB → Python migration (ch. 1→2).
3. FOOOF as the analytical lens; fixed vs knee.
4. Experimental design: plates, doses, stim rows, D-1 baseline.
5. The per-day-notebook era and the refactor into a library.
6. (No status statement — decided 2026-08-29: the page presents the work without
   commenting on publication status.)

## Synthetic data generator (TS, `organoids/synth.ts`)

- LFP: colored noise with exponent χ (drawn per well from a dose-conditioned distribution),
  optional knee, 1–2 Gaussian peaks (θ/β), plus stim-evoked bursts on stim rows.
- Spikes: Poisson baseline + burst epochs; network events = correlated bursts across wells.
- Dose/day effects are parameterized so heatmaps *trend* (e.g. exponent drifts with dose
  over days) — **clearly labeled "illustrative, not real data"** in every panel header.
- Seeded PRNG so the page is deterministic.

## Ports required (TS)

- Simplified specparam: log-log aperiodic fit (fixed and knee via least squares), iterative
  Gaussian peak extraction (peak_threshold, max_n_peaks), matching `set_fm_array` outputs.
- Welch PSD (`compute_spectrum` equivalent).
- `isi_array`, `burst_rate`, `network_events` — direct ports.
- Heatmap/boxplot stats (`param_heatmap`, `plot_variability`).

## Real figures to extract (`scripts/sync-demos.ts` → `public/demos/organoids/`)

- `jupyter nbconvert --to markdown` on: `ds_lfp_07-29-24`, `Spike_data_psych_org`,
  `PlateA-prestim`, `PlateA_comparison`, `DeviationD`, `PlateD_comparison`, `Deviation`,
  `PlateF_comparison`, `PlateF_comparison-knee`. From the two 37/39 MB per-day notebooks,
  pull only the 6×8 grid figures (≤ 6 images).
- Curate to ~30 PNGs total, optimized (<300 KB each). Full sets stay in `_raw`.

## Source drawer

- Tabs per chapter: MATLAB (`lfp_processing.m`, `Spike_Processing.m`), Plate A
  (`A_LFP_analysis_functions.py`), per-day pipeline (`PlateF-D30.py` as representative),
  comparison (`LFP_psych_through_FOOOF.py`), library (`General_LFP_analysis_functions.py`).
- Each interactive panel has a "mirrors `function_name()`" chip that jumps to that function.

## Manifest (`content/organoids/site.ts`)

- displayName "Organoids on Psychedelics", favicon "🧫", accent `#EC4899`.
- deepLinks: `/demos/organoids#raw`, `#spectrum`, `#dose`, `#compounds`, `#library`.
- techStack: Python, NumPy/SciPy, neurodsp, FOOOF/specparam, MATLAB, HDF5, Axion MEA.
- knowledgePanel facts: Lab (Voytek Lab, UCSD) · Model (cortical organoids on 48-well MEA)
  · Compounds (5-MeO-DMT; psilocybin, LSD, psilocin; vehicle) · Timeline (D-1 → D60) ·
  Method (FOOOF aperiodic/periodic parameterization, burst & network-event detection).
- images: the curated real figures (Images tab).
- keywords: organoid, MEA, psychedelic, FOOOF, specparam, LFP, 5-MeO-DMT, psilocybin,
  LSD, voytek.

## Attribution / safety

- Data is unpublished Voytek Lab work: **no raw data shipped**; figures are David's own
  rendered analysis outputs. No efficacy or scientific claims beyond "here is what the
  analysis produced"; Story rail avoids interpreting drug effects.
- Credit line: "organoid culture, recordings and experimental design by Voytek Lab
  collaborators" (generic, no names — decided 2026-08-29); David's part = preprocessing +
  analysis pipeline + figures.
- Every synthetic panel carries the "illustrative data" label.

## Out of scope

- Re-running the real analysis in-browser (no data), Pyodide, MATLAB execution.
- Shipping any per-day notebook.

## Resolved questions (2026-08-29)

1. Credit → generic "Voytek Lab collaborators".
2. Status → say nothing.
3. Chapter 1 keeps a hook for a real trace if one is ever cleared for release.
