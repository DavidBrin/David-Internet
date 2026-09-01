# 03 — Anatomy of a Spike (spike_proj + spikeparam, Voytek Lab, 2024)

Slug: `spikes` · Fake domain: `spikes.davids.net` · Archetype: **A** (interactive) + Story rail
Status: spec agreed 2026-08-29; **built 2026-09-01**. CORRECTIONS found at build time: the
dandiset IDs below (000014/000245/000502) were wrong - the data is the **Primate Cell Type
Database** (primatedatabase.com), published as **DANDI:001776** (CC-BY-4.0); the current
release is all-marmoset (Callithrix jacchus) with renamed files (sub-M03G/...), so the live
feature table (10 files, 2,676 spikes, 4 shipped sweeps) has subject-level metadata only
(subject/sex/age/weight), while the 2024 figures show macaque/LIP groups from a pre-release
copy - disclosed on the page. Also: fs is 50 kHz in these files (the notebooks hardcoded
20 kHz), and pvc-6_param_means.npy holds piecewise-poly params, not SKG params - the SKG
sandbox defaults were fit at build to the dataset mean spike (r2=0.9997). TS ports (LOWESS,
control points, bounded exp fit) match Python detection sample-for-sample on the shipped
sweeps.

## Summary

One page, three panels, on **real public data**: a primate patch-clamp action potential is
detected, windowed, and fitted piece by piece in front of the reader (the `spikeparam`
model), then the fitted parameters become sliders that regenerate a waveform, then the
whole cross-monkey feature table becomes a brushable scatter that pulls up the matching
real waveforms. The Story is "I learned a lab's package well enough to run a full
analysis with it."

Attribution framing (agreed): `spikeparam` is a **Voytek Lab package** (Blanca Martin et
al., NIH R01 GM134363); David used it. The original work demoed here is `spike_proj` — the
NWB ingestion, per-subject DataFrames, and statistics.

## Source material

| File | Role in demo | Notes |
|---|---|---|
| `spike_proj_raw/spike_functions.py` | Panel 1 windowing/detection flow, panel 3 (`plot_correlation_heatmaps`, `boxplots_by_Param`, `plot_waveform`, `get_spike_arrays`) | David's code |
| `spike_proj_raw/nwd_Download.ipynb` | Data provenance: DANDI dandisets **000014, 000245, 000502** (primate patch-clamp NWB) | Public data → real waveforms can ship |
| `spike_proj_raw/Parametrizing PatchClamp primate data.ipynb`, `Create_df_and_dict.ipynb`, `LoadMetaData.ipynb` | Story beats: first fit, "MEGA dataframe", metadata join (Species, brainOrigin, SomaLayerLoc, Sex, dendriticType, Age) | Extract a few PNGs |
| `spike_proj_raw/stats_from_allMonkeyDFs_filt.ipynb` (70 figures) | Panel 3 real figures: boxplots by metadata, overlapped average waveforms by group, ANOVA | Extract ~8 PNGs |
| `spikeparam_raw/spikeparam/patch/fit/fit.py` (`Spike.fit`, `gen_fit`), `patch/features/intra.py` (`compute_ramp_features`, `compute_peak_features`, `compute_decay_features`, `fit_exp_nonlinear`), `patch/gen/gen.py`, `patch/window/window.py` | The model panel 1 animates and panel 2 inverts | **Lab code** — shown in drawer under a "spikeparam (Voytek Lab)" header |
| `spikeparam_raw/spikeparam/skg/fit.py` (`sim_gaussian_spike`, `SKG`) | Panel 1 alternative model overlay; panel 2 second mode | Lab code |
| `spikeparam_raw/docs/tutorials/SkewedGaussians.ipynb` ("r² = 0.999 as sum of two skewed Gaussians", pvc-6) | Story beat + one figure | Lab tutorial |
| `spikeparam_raw/params/pvc-6_*.npy` | Seed values for panel 2 slider defaults (skewed-Gaussian mode) | Lab-fitted params |

Data to ship (all public, `public/demos/spikes/`):
- `sweeps.json` — 3–5 raw patch-clamp sweeps (≈1–2 s each at recording fs, float16 → ~100–300 KB
  each) exported from the DANDI NWB files, with dandiset/asset IDs for citation.
- `features.csv` — the filtered cross-monkey feature table (`allMonkey_df_filt`): ramp_amp,
  inflection_time/amp, peak_amp/width/sharpness, exp_amp/lambda/const, r², ISI + metadata
  columns. Few hundred–few thousand rows; anonymized subject IDs.
- `waveforms.json` — the windowed spikes (20 ms each) referenced by `features.csv` rows,
  float16, capped at ~2 MB (subsample if needed).

## Stage — three panels

### 1. The spike, dissected (detection → fit animation)
- Top: a full raw sweep (real) with a **scrub cursor**. As the cursor crosses the
  `thresh_amp` line a spike is detected (`find_spike_times`), the ±10 ms window
  (`window_spike`) snaps out into the big axis below.
- Big axis: the fit animates **in the order `Spike.fit` computes it**:
  1. pre-peak **ramp** region highlighted (`pre_peak_ms`), polynomial draws in
     (`compute_ramp_features` / `gen_fit_ramp`), `ramp_amp` ticks in;
  2. **inflection** point found (`pre_inflection_ms`), marker + `inflection_time/amp`;
  3. **peak** calipers open to `peak_width`, `peak_sharpness` shown as curvature arc;
  4. **decay** exponential fits down the tail (`fit_exp_nonlinear` / `gen_fit_exp`),
     `exp_lambda` ticks in, r² badges appear (ramp, exp);
  5. toggle **"skewed-Gaussian model"** → two skewed Gaussians (`sim_gaussian_spike`)
     fade in separately, then sum; r² badge.
- "Next spike" steps through detected spikes; "Auto" plays the whole sweep and the
  feature table fills row by row (this *is* `gen_df_features`).
- Chip on each stage: "mirrors `spikeparam.patch.features.intra.compute_peak_features`".

### 2. Parameter → shape sandbox (the generative direction)
- Sliders for the fitted params: ramp slope/amp, peak amp/width, `exp_amp`, `exp_lambda`,
  `exp_const`; a second mode with the 10 skewed-Gaussian params (defaults from
  `pvc-6_param_means.npy`).
- The waveform regenerates live (`gen_fit_ramp` + `gen_fit_exp`, or `sim_gaussian_spike`);
  a ghost of the real spike from panel 1 stays underneath so you can match it by hand.
  "Snap to fit" animates the sliders to the fitted values.
- Mini ISI sim: `sim_patch(spikes, isi, tau)` port — set an ISI and watch a train.

### 3. Population (real feature table, brushing)
- Scatter with axis pickers (any two features; default `peak_width` × `exp_lambda`),
  colored by a metadata picker (Species / brainOrigin / SomaLayerLoc / Sex /
  dendriticType / Age).
- **Brush** a region → the matching real windowed waveforms overlay on a side axis with
  mean ± SD shading (the `plot_waveform(..., Overlapped=True)` look), and the group
  boxplots (`boxplots_by_Param`) highlight the selected rows.
- Correlation-heatmap mode: `plot_correlation_heatmaps` recomputed on the brushed subset,
  cells animating between values.
- Real figures from `stats_from_allMonkeyDFs_filt` shown in a strip under the panel.

## Story rail (narrative beats)

1. Joining the Voytek Lab; what patch-clamp APs are and why parameterize them.
2. Learning `spikeparam`: the ramp/peak/decay model and the skewed-Gaussian alternative
   (credit the lab; link the repo).
3. Getting data: DANDI, NWB/HDF5, the `extract_data` sweep loader.
4. The "MEGA dataframe" era → `monkey_df` / `monkey_dict` → metadata join.
5. Statistics by metadata (boxplots, overlapped waveforms, ANOVA) — describe what was
   compared, not what was concluded (unpublished analysis).
6. (Dropped 2026-08-29: no claim about contributions to spikeparam — David is credited as
   a user of the package only.)

## Source drawer

- Tabs: `spike_functions.py` (David) · `spikeparam/patch/fit/fit.py` and
  `features/intra.py` (Voytek Lab — header says so) · `skg/fit.py` (lab) · the TS port.
- Data citation block: DANDI dandiset IDs + the pvc-6 (CRCNS) credit for the tutorial figure.

## Tech

- TS ports: threshold spike detection, windowing, polynomial least squares (ramp), 1-D
  Gauss–Newton/LM for the exponential and skewed-Gaussian fits (small; 20 ms windows), r².
- Rendering: SVG for waveforms/scatter (few thousand points OK); canvas fallback if
  `features.csv` > 5k rows. Brushing via pointer events; d3-scale/d3-brush only if it
  earns its bytes.
- Tests: TS fit on the shipped sweeps reproduces `features.csv` values within tolerance
  for the same spike indices.

## Manifest (`content/spikes/site.ts`)

- displayName "Anatomy of a Spike", favicon "⚡", accent `#F59E0B`.
- deepLinks: `/demos/spikes#dissect`, `#sandbox`, `#population`.
- techStack: Python, NumPy/SciPy, pandas, h5py/NWB, DANDI, neurodsp, spikeparam (Voytek Lab).
- knowledgePanel facts: Lab · Data (DANDI 000014/000245/000502, primate patch-clamp) ·
  Model (ramp → peak → exponential decay; sum of two skewed Gaussians) · Features (11) ·
  Package credit (spikeparam — Voytek Lab, NIH R01 GM134363).
- keywords: spike, action potential, patch clamp, spikeparam, NWB, DANDI, primate, voytek.

## Attribution

- `spikeparam`: Voytek Lab package; David = **user only** (no contribution claims). Never
  "I wrote spikeparam".
- Data: DANDI dandisets (cite IDs and license as recorded on DANDI at build time).
- Analysis results are unpublished: describe methods, not findings.

## Out of scope

- The Ray-parallelized MEG `spec_decomp_and_param.py` (different project; could be a
  footnote), `SpikeGroup`/`PolySpikeGroup` batch APIs, Pyodide.

## Resolved questions (2026-08-29)

1. No contribution claims about spikeparam.
2. Ship anonymized subject metadata columns (public on DANDI).
