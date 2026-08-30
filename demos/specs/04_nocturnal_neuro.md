# 04 — Nocturnal Neuro: From Board to Brainwave (Nov 2024 – Feb 2025)

Slug: `nocturnal` · Fake domain: `nocturnal.davids.net` · Archetype: **C (gallery/3-D) + A (interactive)** + Venture strip
Status: spec agreed 2026-08-29; **built 2026-08-30** (`/demos/nocturnal`; prep in `scripts/demos/nocturnal.ts` + `nocturnal_prep.py`, assets committed under `public/demos/nocturnal/`, 2.5 MB — EEG shipped at 250 Hz rather than 125 so the downsample step has something to do).

## Summary

The EEG-wearable venture, told as hardware → signal → business. The reader explodes a
real 4-layer PCB apart, hovers parts to see the sourcing decisions, walks the schematic,
then opens a real 25-channel EEG recording (David's own) and runs the DSP notebook's
pipeline on it in the browser. A short venture strip closes with the canvases from the
Basement launch program.

Headline provenance (agreed): **"A rework of the OpenBCI Ganglion (open hardware)."**
David's work = KiCad re-capture/re-layout, BOM re-sourcing with substitutions for
obsolete/expensive parts, the DigiKey order, the DSP pipeline, and the venture framing.

**Cheap-assets rule applies hard here:** no Gerber, KiCad, or raw EEG file ships. Everything
is pre-rendered/re-encoded into small purpose-built assets at build time (see Assets).

## Source material

| File / group | Role in demo | Notes |
|---|---|---|
| `kicad_ganglion_pcb/Ganglion BOM/*.gbr`, `*.drl` (F/B Cu, In1/In2 Cu, F/B mask, paste, silk, edge cuts, PTH/NPTH) | Panel 1 layer stack — rendered to SVG at build time | Derived from OpenBCI open-hardware files |
| `Ganglion_PCB.kicad_pcb` (141 footprints) | Footprint positions/refs for hover hit-areas (parsed at build time) | 1.7 MB — never shipped |
| `Ganglion_PCB.kicad_sch`, `Ganglion_Sensors_01.kicad_sch`, `References.kicad_sch`, `TVS.kicad_sch` | Panel 2 schematic sheets → SVG via `kicad-cli` at build time | Needs KiCad installed on the build machine; fallback = committed SVGs |
| `Ganglion_01_BOM_CSV.csv` (41 rows, substitution notes) + `DigiKey_orderedParts.xlsx` | Panel 1 hover cards; "substituted parts" filter | Substitution notes are David's |
| `signal_analysis/DSP.ipynb` (9 cells) | Panel 3 pipeline: `load_eeg_to_array` (MNE), `compute_functional_coherence` (Welch/coherence), **filter/downsample cell — commented out, unfinished → complete it**, `convert_eeg_to_edf` | David's |
| `eeg_recordings/HELLOworld.{eeg,vhdr,vmrk}` — 25 ch, 500 Hz, 62 s, 10-20 montage | Panel 3 real data | **David's own recording, cleared to ship** (downsampled, no PII in header) |
| `business/*.pdf` (Business Model Canvas, Value Proposition Canvas, Empathy Map; Nov 2024) | Panel 4 flip cards | Rasterized to small PNG/WebP at build time |

## Stage — four panels

### 1. PCB layer explorer (exploding stack)
- Build step renders each Gerber layer to its own SVG (`pcb-stackup` / `@tracespace/core`),
  then **simplifies** (path merging, 2-decimal precision, drop pad-level detail on inner
  layers) so the full stack is ≲ 600 KB total.
- Stage shows the assembled board (top view, realistic mask/silk colors). Drag or scroll
  → the eight layers **explode apart** along a tilted axis (CSS 3-D transforms, ~600 ms,
  staggered), each labeled (F.Silk, F.Mask, F.Cu, In1.Cu, In2.Cu, B.Cu, B.Mask, B.Silk +
  drills). Click a label to isolate it; flip button shows the bottom view.
- Hover/tap a footprint (hit-areas from `.kicad_pcb` positions, 141 parts) → card with
  ref, value, footprint, manufacturer part, and — if substituted — the note from the BOM
  ("obsolete → GRM188… replaced with Kemet C0603C105K3PACTU, direct replacement") plus the
  DigiKey order line/qty. Filter chips: **All · Substituted · Passives · ICs · Connectors**.
- Animation on load: copper traces "route in" (SVG stroke-dashoffset sweep on F.Cu) before
  the board settles into its colored view.

### 2. Schematic tour
- Four sheets exported to SVG by `kicad-cli sch export svg` at build time, cropped and
  simplified; a sheet picker + pan/zoom.
- 5–6 **hotspots** (authored JSON): analog front end / bias & reference (`References`
  sheet), input protection (`TVS` sheet), sensor connectors (`Sensors_01`), MCU/BLE
  block, battery/JST. Each hotspot: 2–3 sentences + "shows up on the board here" link that
  pulses the matching footprints in panel 1.
- KiCad is installed locally (confirmed); still commit the exported SVGs so CI/Vercel
  builds don't need KiCad.

### 3. Brainwave lab (real recording)
- Asset: `HELLOworld` re-encoded at build time → 25 ch × 62 s @ **125 Hz**, int16 with
  per-channel scale (~390 KB gzipped) as `eeg.bin` + `eeg.json` (channel names, fs, scale).
- Left: **head map** (10-20 electrode positions for the 25 channels) — click one or two
  electrodes. Right: a scrolling multichannel viewer (canvas) with a 10 s window playing at
  1×; selected channels highlighted.
- Pipeline toggles (each a TS port of the notebook, in order): raw → **lowpass +
  downsample** (the unfinished cell, completed: `filter_signal(sig, fs, 'lowpass', f_ds/2)`
  then decimate) → notch 50/60 → common-average reference. The trace re-renders live;
  a small "before/after" PSD inset animates the change.
- Two electrodes selected → the **coherence spectrum** draws in from 0–60 Hz
  (`compute_functional_coherence` port: Welch cross/auto-spectra), with the band peaks
  labeled (δ θ α β). Sweep the time window → coherence updates continuously.
- Cognionics → EDF conversion shown as a code excerpt (not run).

### 4. Venture strip
- Three flip cards: Business Model Canvas, Value Proposition Canvas, Empathy Map (front =
  rasterized canvas at ~1200 px WebP; back = 3 bullet takeaways written by David).
- One line on the Basement (UCSD) launch program, Nov 2024.

## Story rail (narrative beats)

1. The idea: nocturnal EEG wearable; why start from OpenBCI's open hardware.
2. Re-capturing the Ganglion in KiCad; what "rework" meant in practice.
3. Sourcing: obsolete parts, substitution rules ("checked equivalent specs"), the DigiKey
   order — and what it cost (optional number).
4. Recording HELLOworld with a Cognionics headset; getting data out of vendor formats.
5. The DSP pipeline; what coherence between channel pairs was meant to reveal for sleep.
6. Business framing from the launch program; where it stopped (no status claim — keep to
   what was built).

## Source drawer

- Tabs: `DSP.ipynb` → `dsp.py` (completed), the TS ports (`eeg/filters.ts`,
  `eeg/coherence.ts`), `Ganglion_01_BOM_CSV.csv` rendered as a table, and a "Hardware
  files" list linking to the `_raw` folder (not shipped).

## Assets to build (`scripts/sync-demos.ts` → `public/demos/nocturnal/`)

| Asset | Source | Target size |
|---|---|---|
| `pcb/*.svg` (8 layers + drills), `pcb/footprints.json` | Gerbers + `.kicad_pcb` | ≲ 600 KB total |
| `sch/*.svg` (4 sheets) + `sch/hotspots.json` | `.kicad_sch` via kicad-cli | ≲ 400 KB |
| `eeg.bin` + `eeg.json` | BrainVision @500 Hz → int16 @125 Hz | ~390 KB gz |
| `bom.json` | BOM CSV + DigiKey xlsx (merged on part number) | < 30 KB |
| `venture/*.webp` (3) | PDFs rasterized | < 150 KB each |

## Tech

- Build-time: `@tracespace/core` for Gerber→SVG, `svgo` for simplification, a small
  `.kicad_pcb` s-expression parser (footprint `at`/`reference` only), `kicad-cli` optional,
  `mne`-free Python (or Node) BrainVision reader for the re-encode, `sharp` for rasters.
- Runtime: CSS 3-D for the stack, canvas for the EEG viewer, Web Worker for Welch/coherence
  (25 ch × 7750 samples — cheap, but keep the UI thread free while scrubbing).
- Tests: TS filters/coherence vs. SciPy outputs on a 5 s slice (fixture generated at build).

## Manifest (`content/nocturnal/site.ts`)

- displayName "Nocturnal Neuro", favicon "🌙", accent `#6366F1`.
- deepLinks: `/demos/nocturnal#board`, `#schematic`, `#eeg`, `#venture`.
- techStack: KiCad 8, Gerber/DFM, DigiKey sourcing, Cognionics EEG, MNE, neurodsp, SciPy,
  BrainVision/EDF.
- knowledgePanel facts: Type (EEG wearable venture) · Hardware (4-layer rework of OpenBCI
  Ganglion, 141 footprints, 41 BOM lines) · Data (25-ch, 500 Hz recording) · Program
  (Basement launch program, Nov 2024).
- images: assembled-board render, exploded-stack still, coherence plot, canvases.
- keywords: EEG, wearable, sleep, OpenBCI, Ganglion, KiCad, PCB, coherence, nocturnal neuro.

## Attribution

- OpenBCI Ganglion: open-source hardware (cite OpenBCI and license as stated in their
  repo). Demo headline says "rework of"; footprint library is OpenBCI's.
- EEG recording: David's own, shared with consent; header contains no personal fields.
- Canvases: David's (program templates are Strategyzer-style; no template branding kept).

## Out of scope

- Full 3-D board model (no STEP/VRML in raw), live Gerber parsing in the browser, sleep
  staging or any clinical claim, hosting the KiCad project itself.

## Resolved questions (2026-08-29)

1. KiCad is installed on the build machine → `kicad-cli` schematic export in `sync-demos`.
2. Solo venture → no teammate credit on the venture strip.
