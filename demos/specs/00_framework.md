# Demos framework — site-wide spec

Status: **agreed 2026-08-29** (planning phase; nothing built yet).

## Decision

Each demo is a **route inside this repo** (`/demos/<slug>`), registered with a
`content/<slug>/site.ts` manifest exactly like the seven replicas, so it surfaces in
search as `<slug>.davids.net`, gets a knowledge panel, images tab, and deep links.
No separate deployments, no backend — everything runs client-side in the static export.

## Shared plumbing (build once, before the first demo)

- `src/app/demos/[slug]/page.tsx` — statically generated from the manifest list.
- `src/components/demo/DemoLayout.tsx` — chrome only: title, one-line "what/why/when"
  header, a **"Story"** rail (the learning narrative), the interactive stage, and a
  **"Source"** drawer with the original code (syntax-highlighted, read-only) and links
  to raw files / PDFs. The stage content is 100% per-demo.
- `src/components/demo/CodeBlock.tsx` — shiki at build time (no client bundle).
- `src/lib/demos.ts` — registry: slug → lazy-loaded stage component (`next/dynamic`,
  `ssr:false` where canvas/WebGL is involved) so demo bundles don't bloat the SERP.
- Manifest additions: optional `kind: "demo"` field on `SiteManifest` (non-breaking)
  and `liveUrl` pointing at the internal route so `resolveHref` works unchanged.
- `demos/<slug>_raw/` stays as the archive; anything a demo needs at runtime (figures,
  small datasets, GLB/STL) is copied to `public/demos/<slug>/` by a `scripts/sync-demos.ts`
  step, mirroring `sync-content.ts`.

## Archetypes (a demo may combine several)

| Code | Archetype | Notes |
|---|---|---|
| A | Interactive widget | Algorithm ported to TypeScript; sliders/canvas; original Python beside it |
| B | Story page | Scrollytelling: narrative + extracted figures + code excerpts |
| C | Gallery | Image/render grid; optional 3D viewer (three.js / model-viewer) |
| D | Pyodide notebook | Real Python in-browser (numpy/scipy/matplotlib only; ~10 MB load, opt-in click) |

## Rules from the user

1. **Each demo is unique and tailored to its content** — no generic "notebook viewer"
   template; the stage must *look like* the subject (Bloch sphere for quantum, MEA well
   plate for organoids, oscilloscope traces for RTL, etc.).
2. **Complete incomplete code** found in the raw material as part of the port; note in the
   Story rail what was unfinished and what was completed.
3. **Animate.** Every demo has at least one animation that shows what the code *does*,
   not just its output.
4. Attribution and scrubbing per `demos/README.md` → "Before turning any of these into demos".
5. Repo rule: nothing >50 MB; large media hosted externally.
6. **Ship cheap demo assets, not the originals.** A demo never needs the full fidelity of
   the source file: downsample recordings, simplify/vectorize board and CAD geometry,
   crop schematics to the interesting sheet, subsample tables, pre-render at build time.
   Recreate or reformat big files into small purpose-built ones (`public/demos/<slug>/`)
   so pages are fast to build and to view. The `_raw` folder keeps the originals.

## Per-demo spec format

`demos/specs/NN_<slug>.md` with: Summary · Source material (files used, what's third-party,
what was incomplete) · Stage (panels, interactions, animations) · Story rail (narrative
beats) · Source drawer · Data/assets to sync · Tech · Manifest fields · Attribution ·
Out of scope · Open/Resolved questions.

## Spec index (planning complete 2026-08-30)

| # | Spec | Slug | Covers raw folders | Open items for David |
|---|---|---|---|---|
| 01 | Quantum Playground | `quantum` | quantum_information_qutip_raw | none |
| 02 | Organoids on Psychedelics | `organoids` | psychedelic_organoids_raw | none |
| 03 | Anatomy of a Spike | `spikes` | spike_proj_raw, spikeparam_raw | none |
| 04 | Nocturnal Neuro | `nocturnal` | nocturnal_neuro_raw | none |
| 05 | HardHack Break-in Simulator | `hardhack` | hardhack2026_intrusion_system_raw | resolved: simple schematic house; iteration unnamed |
| 06 | Verilog | `verilog` | viterbi_decoder_fpga_raw, ece111_rtl_library_raw | **built 2026-08-30** — all presets simulated, 17/17 module benches pass |
| 07 | ESP32 Thermal TinyML | `esp32` | tinyml_esp32_raw, esp32_iot_fastapi_raw | none |
| 08 | Cross-Teaching Segmentation | `crossteach` | cross_teaching_segmentation_raw, dtu_deep_learning_notebooks_raw | resolved: retrain if no checkpoints on disk/GitHub; micro-CT when cleared; bbox skipped |
| 09 | arXiv Semantic Graph | `arxiv` | arxiv_semantic_graph_raw | resolved: try group repo, else arXiv/Kaggle; no per-person split |
| 10 | SQL Playground | `sql` | dtu_databases_raw | none |
| 11 | Computer Vision | `vision` | computer_vision_cse152_raw | none |
| 12 | P300 Speller | `p300` | p300_speller_bci_raw | resolved: illustrative filters; "ML team, not UI" |
| 13 | Signals & Systems Lab | `signals` | signals_systems_matlab_raw | none |
| 14 | Early 3D Modeling | `modeling` | inventor_cad_raw, vexcode_vr_raw | none |
| 15 | Early Code | `earlycode` | cpp_2021_raw, java_servers_raw, misc_snippets_raw | resolved: CSE 12 added; card dataset checked at build |

Build order suggestion: shared plumbing → 01 → 13 → 06 → 05 → 07 → 02 → 03 → 04 → 11 →
09 → 08 → 12 → 10 → 14 → 15 (roughly: most self-contained and highest-impact first;
08/09 last among the big ones because they need one-time offline builds).

Build-machine prerequisites collected across specs: Icarus Verilog (06), KiCad CLI (04,
present), Python with scipy/h5py (13, 02, 03), PyTorch + TFDS for a one-time run (08),
TF Hub + hnswlib for a one-time run (09), sql.js at runtime (10).
