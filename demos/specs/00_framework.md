# Demos framework — site-wide spec

Status: **agreed 2026-08-29**; built so far: 04 Nocturnal, 06 Verilog, 13 Signals, 01 Quantum, 05 HardHack, 07 ESP32 (2026-08-31), 02 Organoids, 03 Spikes, 11 Vision, 09 arXiv (2026-09-01), 08 Cross-Teaching (2026-09-01).

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
| 01 | Quantum Playground | `quantum` | quantum_information_qutip_raw | **built 2026-08-31** - TS simulator + 4 panels; NOTE: report's who-did-what table omits David (see spec 01) - neutral attribution used, confirm with David |
| 02 | Organoids on Psychedelics | `organoids` | psychedelic_organoids_raw | **built 2026-09-01** - 5 chapters, TS FOOOF 1.1 port fixture-tested (fixed+knee); synthetic panels labeled, 25 real figures ship; library has 25 fns (spec said 26) |
| 03 | Anatomy of a Spike | `spikes` | spike_proj_raw, spikeparam_raw | **built 2026-09-01** - data is DANDI:001776 (spec's dandiset IDs 000014/000245/000502 were wrong); current release all-marmoset, 2024 figures include pre-release macaques (disclosed) |
| 04 | Nocturnal Neuro | `nocturnal` | nocturnal_neuro_raw | **built 2026-08-30** — kicad-cli layer/sheet exports, EEG at 250 Hz, canvases; DSP cell completed |
| 05 | HardHack Break-in Simulator | `hardhack` | hardhack2026_intrusion_system_raw | **built 2026-08-31** - page-wide sim, 13 table tests; scrubbed sources in demos/hardhack_src/ |
| 06 | Verilog | `verilog` | viterbi_decoder_fpga_raw, ece111_rtl_library_raw | **built 2026-08-30** — all presets simulated, 17/17 module benches pass |
| 07 | ESP32 Thermal TinyML | `esp32` | tinyml_esp32_raw, esp32_iot_fastapi_raw | **built 2026-08-31** - 76 features (spec said 65 - documents won), int8 kernels bit-faithful vs TFLite |
| 08 | Cross-Teaching Segmentation | `crossteach` | cross_teaching_segmentation_raw, dtu_deep_learning_notebooks_raw | **built 2026-09-01** - NO retraining: real checkpoints found in DavidBrin/Semi-supervised-image-model (Git LFS) + committed per-epoch metrics; repo config differs from local raw copy (labeled 20%, image-level gate 0.75, weight 0.05, warmup 2, 8 epochs - documents won); micro-CT slices are public in DavidBrin/Semi-supervised-Microtomography-Segmentation (shipped 3); the bbox to-do exists as never-run CrossDetection.py (shown, not run) |
| 09 | arXiv Semantic Graph | `arxiv` | arxiv_semantic_graph_raw | **built 2026-09-01** - group repo recovered (full package src); real filters were 2024/200-words -> 148,477 papers; report tau=0.27 vs modularity argmax 0.19 is the story; brute-force k-NN + t-SNE disclosed |
| 10 | SQL Playground | `sql` | dtu_databases_raw | none |
| 11 | Computer Vision | `vision` | computer_vision_cse152_raw | **built 2026-09-01** - stereo inputs re-rendered from facedata (data.pickle never archived; original lights recovered from notebook prints); HW4 curves extracted from archived run, not re-trained; corner_detect mode="full" quirk kept |
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
- TFLite INT8 fixtures (07): FC weights are quantized **per output channel** -
  `tensor_details["quantization"]` returns only the first scale; read
  `quantization_parameters["scales"]` (one per row, symmetric zp=0). And create the
  interpreter with `experimental_op_resolver_type=BUILTIN_WITHOUT_DEFAULT_DELEGATES` when
  using `experimental_preserve_all_tensors` - with XNNPACK active the intermediate tensors
  come back unfilled (cost one debugging round).
- This machine's `py -3.12`: TensorFlow 2.21 + numpy 2.5 live in the *user* site-packages
  (`pip install --user`; plain install hits system-dir permission errors). The stale system
  pandas/scipy break under user numpy - keep pandas/scipy/sklearn/pillow user-site too.
  Same class of breakage hit statsmodels + matplotlib on 02/03 (fixed by user-site
  reinstall; matplotlib needed a manual `rm -rf` of the orphaned package dir first) and
  neurodsp (old system copy imported the removed scipy.signal.morlet - `pip install --user
  -U neurodsp`). fooof/neurodsp import matplotlib at import time, so a broken matplotlib
  breaks them too.
- Welch trap (02): neurodsp's `compute_spectrum(..., method='welch')` does NOT call
  scipy.signal.welch - it calls scipy.signal.spectrogram, whose default `noverlap` is
  nperseg//8 (welch's is nperseg//2), then averages segments itself. A "welch port" must
  match the spectrogram path or PSDs are ~1-2% off at low frequencies.
- Verify spec claims against live sources before shipping numbers (02/03): the 03 spec's
  DANDI IDs didn't exist - the real dataset (Primate Cell Type Database) had moved to
  DANDI:001776 with renamed files and different species coverage; the 02 spec said "26
  functions" but the file defines 25. Documents/upstream win; disclose drift on the page.
- Panel agents sharing one Playwright MCP browser fight over the "current tab" - screenshots
  land on a sibling's page mid-run. Tell agents to re-check `location.href` (or target
  their `Page` via `context().pages()`) before trusting any capture, and to expect
  transient module-not-found/CSS-chunk dropouts from siblings' HMR churn (final dev-server
  restart clears it).
- Two panel agents ended their turn "waiting for a background notification" that can never
  arrive (subagents aren't woken by others' tasks). Prompt agents to verify immediately and
  never wait; if one stops early anyway, a SendMessage nudge resumes it with context intact.
- Source-drawer entries must NEVER point at .ipynb files (11): the demo page reads and
  shiki-highlights every source inline, so a notebook with embedded figures ballooned
  /demos/vision to 17 MB of HTML and broke hydration (server stream vs client mismatch in
  DemoLayout). Extract code cells to demos/<slug>_src/*_extract.py at prep (vision and
  arxiv preps both have a prep_sources step) and point meta.sources there. Symptom to
  watch: `curl | wc -c` per demo page - all should be under ~2 MB.
- Panels that need a button press to show anything open as dead grey/black boxes in the
  page screenshot - auto-run the first solve/animation on load (guarded by a ref) and keep
  the button as a re-run (11's stereo panel).

