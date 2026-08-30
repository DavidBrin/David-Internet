# 12 — P300 Speller (Triton Neurotech, ML team)

Slug: `p300` · Fake domain: `p300.davids.net` · Archetype: **A** (live speller sim) + precomputed model panels
Status: spec agreed 2026-08-30; **not built**.

## Summary

The BCI speller as an experience: a 6×6 character matrix flashes rows and columns at the
real cadence (100 ms on / 75 ms off, 12 flashes × 15 repetitions per character) while a
synthetic EEG trace scrolls beneath; every flash of the attended row/column carries a
P300 bump that only becomes visible as epochs average — the reader watches the ERP
emerge and the classifier's row/column scores converge on the letter. Then the model
family from the project (CNN1, CNN2a/b/c, CNN3, MCNN1–3) is compared on the real BCI
Competition III results.

Credit: **Triton Neurotech team**; David on the ML team (decided 2026-08-30). No other
names.

## Source material

`demos/p300_speller_bci_raw/`:

| File | Role |
|---|---|
| `README.md` (illustrated: experiment procedure, CNN family definitions, results) | Story text + architecture table; `images/{p300-experiment.jpg, cnn-architecture.png, speller-system.png}` reused (compressed) |
| `notebook-scripts/{CNN1, CNN2b, CNN2c, CNN3, MCNN1, MCNN2, MCNN3, P300speller}.ipynb`, `workflows/CNN2a.ipynb`, `magician/cnn2a.py` | Model definitions (1-D CNN, 5 layers; 64 vs 8 channels; spatial-filter variants; multi-classifier ensembles) and the character-decoding logic; results tables extracted for panel 3 |
| BCI Competition III dataset II (`.rar`, excluded) | **Not shipped**; the sim uses synthetic EEG; real results quoted from the notebooks |

## Stage

### 1. The speller (live)
- 6×6 matrix (A–Z, 1–9, _) with the 12 row/column flashes in random order at 100 ms /
  75 ms; a **target letter** picker (or "let the demo choose"); a scrolling **8-channel
  synthetic EEG** (Fz, Cz, Pz, P3, P4, PO7, PO8, Oz — the CNN2a set) with a P300
  (positive deflection ~300 ms post-flash) injected on target flashes at a chosen SNR.
- **ERP averaging animation:** two stacked traces — "target flashes" and "non-target
  flashes" — accumulate epoch by epoch (650 ms windows, the project's window length);
  the P300 rises out of the noise on the target trace as N grows (1 → 15 repetitions).
- **Decoding:** per-flash score (a simple template/LDA-style scorer in TS — *not* the
  CNN) accumulates per row and per column; bars grow; the letter is chosen when both
  argmaxes are stable; show "repetitions needed" vs SNR slider. Type a word; the
  speller spells it.

### 2. From a window to a classifier
- The 650 ms × 64-channel window as an image; the 1-D CNN's first layer drawn as
  **spatial filters** over the 10-20 head map (the CNN3 "one spatial filter" idea):
  hover a filter → weights on the head map. Weights are synthetic/illustrative unless
  a trained model's first-layer weights are available (see Open questions).
- Electrode-subset toggles (all 64 · CNN2a's 8 · CNN2b's learned 8 · lobes F/C/P/O/LT/RT
  from CNN2c) re-highlight the head map.

### 3. Model family results (precomputed)
- Table + bar chart from the notebooks: per-model accuracy / character-recognition rate
  vs repetitions for subjects A and B; MCNN ensembles vs single CNNs. Values are read out
  of the notebook outputs at build (no retraining).

## Story rail

1. Triton Neurotech and the ML team's goal (assistive communication via P300).
2. The experiment (from the README) and why averaging works.
3. The CNN family: what each variation tests (channels, spatial filters, ensembles).
4. What the results said (subjects A/B, repetitions vs accuracy).
5. David's part: the ML side (models/decoding), not the UI — kept deliberately brief.

## Assets (`public/demos/p300/`)

- README images (WebP, ≤ 150 KB each), `results.json`, optional `cnn1_layer1.json`
  (first-layer weights if a checkpoint exists).

## Tech

- TS: flash scheduler with exact timings, synthetic EEG (1/f noise + alpha + P300
  template), epoching, averaging, row/column scorer; canvas for traces; DOM for the
  matrix (CSS flash).
- Reduced-motion: flashes become highlights with no strobe; a warning about flashing
  is shown before the animation starts (photosensitivity).

## Manifest (`content/p300/site.ts`)

- displayName "P300 Speller", favicon "🧠", accent `#A855F7`.
- deepLinks: `/demos/p300#speller`, `#classifier`, `#results`.
- techStack: Python, PyTorch/Keras (as in notebooks), NumPy, BCI Competition III, TypeScript.
- knowledgePanel facts: Team (Triton Neurotech) · Role (ML team) · Data (BCI Competition
  III dataset II, 2 subjects) · Models (8 variants) · Live speller sim.
- keywords: p300, bci, brain computer interface, speller, erp, eeg, cnn, triton neurotech.

## Attribution

- Team project (Triton Neurotech); dataset credited to BCI Competition III (Wadsworth).
- Sim data is synthetic; results are the team's notebook outputs.

## Out of scope

- Running the CNNs in-browser; real EEG.

## Resolved questions (2026-08-30)

1. No checkpoint on hand → first-layer spatial filters are illustrative (labeled).
2. David's piece: keep it vague — "on the ML team; did not work on the UI." Story beat 5
   becomes that one line.
