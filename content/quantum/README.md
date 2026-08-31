# Quantum Playground — demo page

Live at [/demos/quantum](/demos/quantum). This page is a demo built inside David's Internet, not a vendored project: the archive it was made from lives in `demos/quantum_information_qutip_raw/` (the DTU 10384 Quantum Information notebooks and exercise solutions), David's Python in `demos/quantum_src/`, and the build script in `scripts/demos/quantum.ts` + `quantum_prep.py`.

## What is on the page

A hand-written TypeScript state-vector simulator (1–5 qubits, `src/demos/quantum/sim/core.ts`) driving four instruments that follow the course arc:

**Bloch sphere.** An orbitable three.js sphere. θ/φ sliders place the state; X, Y, Z, H, S, T and Rx/Ry/Rz apply as visible rotations — each gate is decomposed into its rotation axis and angle (U = e^{iα}·Rn̂(2β)) and the arrow slerps along the drawn great circle, leaving a fading ghost trail. Live amplitude, ⟨σx⟩/⟨σy⟩/⟨σz⟩, and gate-matrix readouts; a "verify identities" control demonstrates σxσy = iσz cyclically (exercise sheet 8).

**Circuit builder.** 2–3 wires, a gate palette (H, X, Y, Z, S, T, CNOT, CZ, CRZ, SWAP, Toffoli), and a playhead that sweeps the circuit while 2^N amplitude bars morph (height = magnitude, hue = phase). Presets include the intro notebook's exact Bell circuit (SNOT → CNOT → CRZ(−π)) and a GHZ. Full-circuit unitary readout with pen-and-paper 4×4 matching, 1000-shot measurement histogram, and the notebook's Werner-state fidelity curve live under a p slider.

**Simon's algorithm** (Week 10), staged like the derivation: H⊗n spreads the input register, the oracle f(x) = min(x, x⊕s) draws its two-to-one pairing arcs, the final H⊗n collapses every y with y·s = 1 — then a measurement loop feeds a live GF(2) system until the candidate set shrinks to s. Deutsch–Jozsa and Bernstein–Vazirani (Week 9) run in the same visual as extra modes.

**Grover iterator** (the group project). Signed amplitude bars with the mean line drawn: the oracle flips marked bars below the axis, diffusion reflects everything about the mean — the two half-steps are separately animated. Success-probability curve with the ⌊π/4·√(N/M)⌋ optimum marked; auto-run stops at 2× optimal so the over-rotation is visible. The group-project report PDF is linked from the panel.

## What was completed or fixed

- The simulator and panels were written with AI coding tools (2026-08-31) and tested against NumPy fixtures generated from the course solutions (`tests/fixtures/quantum-*.json`; 37 quantum tests): Bell/GHZ states, Simon's exact survivor distribution for s = 0110, all four Deutsch–Jozsa verdict probabilities, Bernstein–Vazirani's spike, Grover curves for four configurations, Bloch vectors, and the Werner fidelities.
- In the raw material, exercise sheet 8's task 4 (the pen-and-paper 4×4 gates) had never been run and Week 9's notebook carried a broken `!pip install qutip.qip.circuit` cell; the checks now live in the fixtures and the circuit panel's known-gate matcher.
- Attribution note: the Grover report's own "who did what" table credits Antoine (algorithm theory, video) and Andrea (practical demonstration/verification, critical analysis, report). The page therefore uses neutral group attribution and links the report rather than making per-person claims.

## Building

```
pnpm sync-demos quantum    # needs py -3.12 with numpy; copies the report PDF + writes fixtures
pnpm test                  # includes the quantum fixture tests
```

Everything on the page is computed client-side; the only shipped asset is the report PDF (~97 KB).

## Attribution

The intro QuTiP notebook is instructor-provided course material (DTU 10384, fall 2025); weekly-sheet solutions are David's, written with AI coding tools. Grover group project with Antoine and Andrea — report PDF © its authors, linked on the page. QuTiP 5 / qutip-qip were the course tools; the page itself runs a hand-written TypeScript simulator.
