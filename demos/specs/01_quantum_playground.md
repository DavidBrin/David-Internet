# 01 — Quantum Playground (DTU Quantum Information, fall 2025)

Slug: `quantum` · Fake domain: `quantum.davids.net` · Archetype: **A** (interactive) + Story rail
Status: spec agreed 2026-08-29; **not built**.

## Summary

A browser state-vector simulator (TypeScript, 1–5 qubits) with four panels that follow the
course arc: single-qubit geometry → gates on multiple wires → an oracle algorithm from the
exercises (Simon's) → amplitude amplification (Grover, the group project). Everything is
animated: state vectors move, amplitudes morph, measurements accumulate.

Framing (agreed): "the algorithms I studied at DTU, re-implemented so you can watch them
run." The Source drawer shows the **TypeScript simulator** as the primary source and cites
the weekly exercise sheets; the Python solutions are David's implementation, written with
AI coding tools — acknowledged with a small embedded note in the drawer, **not** a Story beat.

## Source material

From `demos/quantum_information_qutip_raw/`:

| File | Role in demo | Notes |
|---|---|---|
| `QI-introducing_QuTiP.ipynb` | Reference for panel 2 (QubitCircuit: SNOT → CNOT → CRZ preparing a Bell state; Werner-state fidelity plot) | **Instructor-provided** intro notebook — cite, don't claim |
| `Exercises_QI-08.ipynb` | Panel 1: Pauli identities, `qubit(θ,φ)`, CNOT via `kron` | Ex. 4 (4×4 gates from the pen-and-paper set) never run → **complete it** |
| `Week 9.ipynb`, `Exercises- QI9.py` | Deutsch–Jozsa + Bernstein–Vazirani simulations (`Uf_n_to_m`, `run_deutsch_jozsa`, `run_bv`) | Broken `!pip install qutip.qip.circuit` cell + empty cell → **fix**. Bonus modes in panel 3 |
| `Exercises- QI10.py` | Panel 3: Simon's algorithm (`Uf_for_s`, GF(2) solver `solve_gf2`, readout probabilities) | Core of panel 3 |
| `grover_group_project/Report of Grover's Algorithm Analysis.pdf` | Panel 4 + link | Group project; presentation video (138 MB) hosted externally (YouTube/Drive), link in Story rail |
| `pyproject.toml` | Tech-stack facts for knowledge panel | — |
| Bell / Acín / QAOA PDFs | Not shipped | Third-party |

## Stage — four panels (tabs, each with its own animation)

### 1. Bloch sphere
- three.js sphere (decided: real 3D, orbitable, lazy chunk) with |0⟩/|1⟩ poles,
  the state vector as an arrow, and trailing ghost arrows for the last N moves.
- Controls: θ/φ sliders (the `qubit(θ,φ)` function from Ex. 2) and gate buttons
  X · Y · Z · H · S · T · Rx/Ry/Rz(angle).
- **Animation:** gate application is a slerp along the rotation axis (250 ms), with the
  rotation axis drawn as a faint great circle while animating.
- Side readout: amplitudes α, β; ⟨σx⟩, ⟨σy⟩, ⟨σz⟩ (live `expect` values); the 2×2 gate matrix.
- "Verify identities" button: animates σxσy, σyσz, σzσx and shows them equal iσz, iσx, iσy
  (Ex. 1).

### 2. Circuit builder (2–3 qubits)
- Wire diagram; drag gates from a palette (H, X, Y, Z, S, T, CNOT, CZ, CRZ(φ), SWAP,
  Toffoli when N=3) onto time slots. Presets: the intro notebook's Bell-state circuit and
  the CNOT-from-`kron` check (Ex. 3/4).
- **Animation:** a playhead sweeps left→right; at each column the amplitude bar chart
  (2^N bars, magnitude as height, phase as hue) morphs to the new state. "Measure" samples
  1000 shots with a bar-fill animation.
- Readout: the full 2^N×2^N unitary of the circuit (`gate_sequence_product` equivalent)
  with a "which pen-and-paper gate is this?" label for the Ex. 4 4×4 matrices.

### 3. Simon's algorithm (Week 10) — plus DJ / BV modes
- Choose n (2–4) and hidden string s (bit toggles). Oracle built as in `Uf_for_s`
  (f(x) = min(x, x⊕s)).
- **Animation, staged like the textbook derivation:** (a) H⊗n spreads the input register
  into a uniform superposition; (b) the oracle "pairs" x with x⊕s — draw arcs between the
  paired basis states; (c) final H⊗n: bars for y with y·s ≠ 0 (mod 2) visibly cancel to
  zero, survivors remain.
- Then a "Measure" loop: each shot appends a row y to a GF(2) system on the right; the
  solver (`solve_gf2`) runs live and the candidate set for s shrinks until one remains.
- Mode switch to Deutsch–Jozsa (constant vs balanced f, one-shot verdict) and
  Bernstein–Vazirani (read s out in a single query) reusing the same visual.

### 4. Grover iterator (group project)
- N = 2^n items (n = 2–5), pick the marked item(s). Amplitudes as bars.
- **Animation:** each iteration is two moves — oracle flips the marked bar below the axis,
  diffusion reflects everything about the mean (draw the mean line). Iteration counter vs
  the optimal ⌊π/4·√(N/M)⌋ from the report; success-probability curve fills in per step,
  and over-rotation is visible if you keep going.
- Story rail text uses the report's "verification of the iteration formula" section.

## Story rail (narrative beats)

1. Why DTU / why this course (one line from David).
2. "First contact with QuTiP" — the Qobj/tensor mental model; Werner-state fidelity plot
   reproduced live (p slider).
3. Exercises: what the weekly sheets asked; note which parts were unfinished in the raw
   files and were completed here (Ex. 4 gates; the broken pip cell).
4. Simon's algorithm: the punchline (exponential separation) in two sentences.
5. Grover group project: David did the **implementation (code) and the theory/analysis**;
   teammates Antoine (video) and Andrea (report) credited by first name; link to PDF + video.
6. What I'd do next (the QAOA paper is in the folder — one line).

## Source drawer

- Primary tabs: the TS simulator modules (`simulator.ts`, `simon.ts`, `grover.ts`).
- Secondary "Original Python" tab: `QI-08.py`, `QI9.py`, `QI10.py` (completed versions,
  diff-style marker on the lines added to finish them) with a one-line footnote:
  "Written for the DTU weekly sheets using AI coding tools; implementation and
  verification are mine." Small, inline, not a headline.
- Link to the Grover report PDF (copied to `public/demos/quantum/`).

## Data / assets to sync

- `public/demos/quantum/grover_report.pdf` (<50 MB).
- No datasets; everything is computed client-side.

## Tech

- Simulator: hand-written complex-number linear algebra in TS (`Complex`, `kron`, `apply`,
  `measure`); 2^4 = 16-dim max in panels 1–3, 2^5 = 32 in Grover — trivially fast.
- Rendering: SVG + CSS transitions for bars/arcs; three.js only for the Bloch sphere
  (lazy-loaded chunk). `prefers-reduced-motion` honored.
- Tests: vitest unit tests that the TS simulator reproduces the Python outputs (Bell state
  from the intro circuit; Simon survivors satisfy y·s = 0; Grover optimal-iteration
  success probabilities).

## Manifest (`content/quantum/site.ts`)

- displayName "Quantum Playground", favicon "⚛️", accent `#7C3AED`.
- deepLinks: `/demos/quantum#bloch`, `#circuit`, `#simon`, `#grover`.
- techStack: TypeScript, three.js, QuTiP 5 / qutip-qip (studied), NumPy.
- knowledgePanel facts: Course (DTU, Quantum Information, fall 2025) · Max qubits ·
  Algorithms (Deutsch–Jozsa, Bernstein–Vazirani, Simon, Grover) · Group project (Grover,
  with names).
- keywords: qutip, quantum, bloch sphere, grover, simon's algorithm, denmark, dtu.

## Attribution

- Intro notebook is course material (instructor). Say so in the Source drawer header.
- Week 9/10 one-cell solutions were written with AI coding tools (`/mnt/data/` paths);
  the implementation is David's. Footnote in the drawer only (see Source drawer).
- Grover report: teammates Antoine and Andrea are named in its "who did what" table;
  David's role = code/implementation + theory/analysis (stated by David, 2026-08-29).

## Out of scope

- Noise models, density-matrix simulation beyond the Werner-state plot, >5 qubits, Pyodide.
- Hosting the 138 MB video in-repo.

## Resolved questions (2026-08-29)

1. Grover role → code/implementation + theory/analysis.
2. AI-assisted exercise solutions → TS port is primary; Python kept under an "Original
   Python" tab with a small footnote (not a Story beat).
3. Bloch sphere → three.js.
