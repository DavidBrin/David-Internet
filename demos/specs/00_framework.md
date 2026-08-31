# Demos framework — site-wide spec

Status: **agreed 2026-08-29**; built so far: 04 Nocturnal, 06 Verilog, 13 Signals (2026-08-30).

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
| 04 | Nocturnal Neuro | `nocturnal` | nocturnal_neuro_raw | **built 2026-08-30** — kicad-cli layer/sheet exports, EEG at 250 Hz, canvases; DSP cell completed |
| 05 | HardHack Break-in Simulator | `hardhack` | hardhack2026_intrusion_system_raw | resolved: simple schematic house; iteration unnamed |
| 06 | Verilog | `verilog` | viterbi_decoder_fpga_raw, ece111_rtl_library_raw | **built 2026-08-30** — all presets simulated, 17/17 module benches pass |
| 07 | ESP32 Thermal TinyML | `esp32` | tinyml_esp32_raw, esp32_iot_fastapi_raw | none |
| 08 | Cross-Teaching Segmentation | `crossteach` | cross_teaching_segmentation_raw, dtu_deep_learning_notebooks_raw | resolved: retrain if no checkpoints on disk/GitHub; micro-CT when cleared; bbox skipped |
| 09 | arXiv Semantic Graph | `arxiv` | arxiv_semantic_graph_raw | resolved: try group repo, else arXiv/Kaggle; no per-person split |
| 10 | SQL Playground | `sql` | dtu_databases_raw | none |
| 11 | Computer Vision | `vision` | computer_vision_cse152_raw | none |
| 12 | P300 Speller | `p300` | p300_speller_bci_raw | resolved: illustrative filters; "ML team, not UI" |
| 13 | Signals & Systems Lab | `signals` | signals_systems_matlab_raw | **built 2026-08-30** - blur N=464 (causal); TS MT19937 randperm; 5 panels, SciPy-fixture tests |
| 14 | Early 3D Modeling | `modeling` | inventor_cad_raw, vexcode_vr_raw | none |
| 15 | Early Code | `earlycode` | cpp_2021_raw, java_servers_raw, misc_snippets_raw | resolved: CSE 12 added; card dataset checked at build |

Build order suggestion: shared plumbing → 01 → 13 → 06 → 05 → 07 → 02 → 03 → 04 → 11 →
09 → 08 → 12 → 10 → 14 → 15 (roughly: most self-contained and highest-impact first;
08/09 last among the big ones because they need one-time offline builds).

Build-machine prerequisites collected across specs: Icarus Verilog (06), KiCad CLI (04,
present), Python with scipy/h5py (13, 02, 03), PyTorch + TFDS for a one-time run (08),
TF Hub + hnswlib for a one-time run (09), sql.js at runtime (10).

## Build playbook - lessons from 06 (Verilog) and 04 (Nocturnal Neuro)

Read this before building each demo; it is the source of truth for process and design
directives (memory points here).

### Wiring checklist for a new demo `<slug>`

1. `scripts/demos/<slug>.ts` prep module (+ optional `<slug>_prep.py` for numpy/scipy work,
   spawned with `py -3.12`); `pnpm sync-demos <slug>` writes committed assets to
   `public/demos/<slug>/`. Tool paths get env overrides (`IVERILOG_BIN`, `KICAD_CLI`).
   Log output sizes. ASCII-only prints (console is cp1252).
2. `content/<slug>/site.ts` (`kind: "demo"`, `liveUrl: "/demos/<slug>"`) + `README.md`
   (what is on the page, what was completed/fixed, building, attribution).
3. `src/demos/<slug>/{meta.ts, Stage.tsx, <slug>.css}`; completed source copies (if any)
   under `demos/<slug>_src/`.
4. Register in `src/lib/demos.ts`, `src/lib/manifests.ts`, `src/components/demo/DemoStage.tsx`.
   The `/demos` index page lists registered demos automatically (stopgap until a wiki page).
5. Tests: TS ports of any math verified against a build-generated fixture in
   `tests/fixtures/<slug>-*.json` (this caught a real RTL bug in 06 - keep doing it).
6. Update the spec status line, this index table, and `demos/README.md` if facts changed.

### Design directives (user-set)

- **Page tint per project vibe** via `meta.theme = { bg, panel }`: Verilog = solder-mask
  green (#eef4ee / #e4eee4), Nocturnal = night indigo (#eef0fa / #e5e8f6). Pick tints that
  match the project (gray for 3D/CAD, warm amber for thermal, etc.); panels stay white,
  accent color comes from the manifest.
- **Never scroll the page from an animation or effect.** `scrollIntoView` scrolls *every*
  scrollable ancestor including the document - an animation driving it makes the page
  "glitch" (user feedback on 06, fixed there). Auto-follow may only move an internal
  `overflow: auto` container via its own `scrollTop`/`scrollTo`; page-level scrolling only
  on an explicit user click (e.g. "Show on the board").
- Demos reachable from the home page: `Demos` gbtn + top-nav link -> `/demos`.
- Honesty on the page: story text uses the real measured numbers; anything completed or
  fixed with AI tools is disclosed in a story beat and the README, dated.

### Process lessons

- **Agent fan-out**: write `Stage.tsx` + stub components with fixed prop contracts first,
  give each agent its own directory + CSS class prefix, start one dev server on :3000 that
  all agents share for Playwright verification; agents run `tsc --noEmit`/`vitest` but never
  `next build`/`next dev`. Integrator kills the dev server before `next build` (shared
  `.next`), then commits and pushes. Keep the user's review dev server alive - run the
  production build later if it would kill it, and say so.
- `suppressHydrationWarning` is already on `<html>/<body>` (browser extensions inject attrs).
- Playwright MCP screenshots land in the user's home directory - Read them to actually look
  at the page, delete them afterwards.
- Big source SVG/JSON assets: strip invisible text, merge stroke-font segments, round to
  0.01 units, drop per-cycle payloads the page never shows - 2-3x smaller before gzip.
- Verify derived data before building UI on it: overlay-render parsed geometry over the real
  export in a throwaway HTML page and screenshot it (caught coordinate-space assumptions in
  04); run any completed notebook/script end-to-end once.
- Many agents editing panels under one dev server can corrupt its HMR CSS state (all
  panel styles vanish at runtime; curl of the linked page.css proves nothing - dynamic-chunk
  CSS is injected at runtime). Fix: restart the dev server. And canvas-fitting hooks must set
  `canvas.style.display = "block"` imperatively + skip sub-2px resizes: with CSS missing, an
  inline canvas's baseline gap feeds a ResizeObserver resize loop that grows the canvas
  unboundedly and jams the tab (hit on 13's deblur panel).
- Raw material can contradict the spec (04's canvases framed the venture as bipolar/MDD
  diagnosis, not sleep) - the documents win; rewrite story text to match them.

