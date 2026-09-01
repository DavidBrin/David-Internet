# Anatomy of a Spike — demo

Interactive rebuild of David's Voytek Lab spike-parameterization project
(`spike_proj`, 2024), live at `/demos/spikes`.

## What is on the page

- **The spike, dissected** (`#dissect`) — a real marmoset patch-clamp sweep with a
  scrub cursor. Spikes are detected (`find_spike_times` → re-center → dedupe),
  windowed (±5 ms), and fitted in the exact order `spikeparam`'s `Spike.fit`
  computes: LOWESS-smoothed derivative → inflection from two line fits → peak
  calipers → bounded exponential decay, with r² badges and a two-skewed-Gaussian
  alternative model overlay.
- **Parameter → shape sandbox** (`#sandbox`) — the fitted parameters become
  sliders; a waveform regenerates live over a ghosted real spike (ramp +
  exponential model or the 10-parameter skewed-Gaussian model), plus a
  `sim_patch` spike train driven by an ISI slider.
- **Population** (`#population`) — ~2,700 fitted spikes from 10 subjects as a
  brushable scatter with feature pickers; brushing overlays the selected spikes'
  real waveforms (mean ± SD) and highlights group boxplots; a correlation-heatmap
  mode recomputes on the brushed subset. Real figures from
  `stats_from_allMonkeyDFs_filt.ipynb` below.

## Data

Recordings come from the **Primate Cell Type Database**
(https://www.primatedatabase.com/), published as **DANDI:001776** (CC-BY-4.0).
The prep script downloads one NWB file per sampled subject (10 files,
`.cache/spikes_nwb/`, gitignored), converts volts→mV, and runs the *real*
`spikeparam` pipeline with the project's settings
(`Spike(thresh_amp=0, window_length=(5,5), smooth_frac=.01)`), at each file's
true sampling rate (50 kHz). Shipped assets: 4 trimmed sweeps (int16 mV×100),
~1,400 decimated waveforms, the feature table, and subject metadata.

**Honesty note:** the live table is rebuilt (2026-09-01) from the current public
release — all *Callithrix jacchus*. The original 2024 analysis also used macaque
files from a pre-release version of the database, so the shipped figures show
groups (Macaca, LIP) the rebuilt table doesn't contain. The old notebooks'
local file names (`M03_JS_A1_C01.nwb`) predate the dandiset's publication.

## Attribution

`spikeparam` is a **Voytek Lab package** (NIH R01 GM134363) — David is a user of
the package, not an author. David's own code is `spike_functions.py` and the
notebooks (NWB ingestion, per-subject DataFrames, statistics). The statistical
analysis is unpublished: the page describes what was compared, not findings.

## Completed / fixed with AI tools (2026-09-01)

- TypeScript ports of `spikeparam.patch` (LOWESS included) and `skg`, written
  with AI coding tools, fixture-tested against the Python pipeline on the
  shipped sweeps (`tests/spikes-core.test.ts`): spike detection matches
  sample-for-sample; features within tolerance.

## Building

```
pnpm sync-demos spikes   # needs py -3.12 + numpy/scipy/statsmodels/h5py/dandi/Pillow
pnpm test                # includes tests/spikes-core.test.ts
```
