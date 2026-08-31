import type { DemoMeta } from "@/lib/demos";

const Q = "demos/quantum_src";

const meta: DemoMeta = {
  slug: "quantum",
  theme: { bg: "#f4f1fb", panel: "#eae5f6" }, // soft violet — the quantum page
  what: "a 1–5 qubit state-vector simulator with four instruments following the course arc",
  why: "quantum algorithms make sense when you can watch the amplitudes interfere",
  when: "DTU (Danmarks Tekniske Universitet), fall 2025",
  story: [
    {
      title: "Copenhagen, quantum information",
      body:
        "An exchange semester at DTU included 10384 Quantum Information — weekly exercise sheets worked in Python, first with raw NumPy matrices, then with QuTiP 5 and qutip-qip. Everything on this page is those algorithms, re-implemented in TypeScript so you can watch them run.",
    },
    {
      title: "First contact with QuTiP",
      body:
        "The course's intro notebook builds the mental model: states and gates are Qobj matrices, multi-qubit systems are tensor products, and a three-gate QubitCircuit (Hadamard, CNOT, controlled-RZ) prepares a Bell state. The circuit builder's Bell preset is that exact circuit, and the Werner-state fidelity curve it plots is reproduced live in the panel.",
      anchor: "#circuit",
    },
    {
      title: "One qubit is a sphere",
      body:
        "Exercise sheet 8: verify the Pauli identities σxσy = iσz (cyclic), write qubit(θ, φ), and build two-qubit gates with kron. The Bloch panel is that sheet made tangible — θ and φ place the arrow, every gate is a rotation about some axis, and the identities can be checked by watching three quarter-turns compose.",
      anchor: "#bloch",
    },
    {
      title: "Oracles and one-query tricks",
      body:
        "Week 9 builds U_f |x⟩|y⟩ = |x⟩|y ⊕ f(x)⟩ as a permutation matrix and runs Deutsch–Jozsa — constant functions send the input register back to |0…0⟩ with probability exactly 1, balanced ones with probability exactly 0 — and Bernstein–Vazirani, which reads a hidden dot-product string in a single query.",
      anchor: "#simon",
    },
    {
      title: "Simon's algorithm — the exponential separation",
      body:
        "Week 10's oracle hides a string s inside a two-to-one function f(x) = min(x, x⊕s). One query plus a Hadamard leaves only outcomes y with y·s = 0 (mod 2): each measurement is one linear equation over GF(2), and about n of them pin s down. Classically you'd need exponentially many queries — this is the course's first exponential quantum win.",
      anchor: "#simon",
    },
    {
      title: "Amplitude amplification",
      body:
        "The course closed with Grover's algorithm — theory plus a small-scale implementation verifying the ⌊π/4·√(N/M)⌋ iteration formula. The iterator panel shows the two moves: the oracle flips the marked amplitude, the diffusion operator reflects everything about the mean — and if you keep going past the optimum, the amplitude rotates right back out.",
      anchor: "#grover",
    },
    {
      title: "Rebuilt for this page (2026-08-31)",
      body:
        "The simulator is hand-written TypeScript (complex kron, gate application, permutation oracles, GF(2) elimination), tested against NumPy fixtures generated from the course solutions. The weekly-sheet Python was written with AI coding tools during the course; sheet 8's exercise 4 (the 4×4 pen-and-paper gates) was never run in the raw notebook and Week 9's broken pip cell never fixed — both completed here. A QAOA paper sits in the same folder: that's the next thing to build.",
    },
  ],
  sources: [
    { name: "core.ts", path: "src/demos/quantum/sim/core.ts", lang: "ts", note: "The state-vector simulator: complex kron, k-qubit gate application, course-convention oracles, GF(2) solver, Grover iterate. Primary source of this page." },
    { name: "bloch model", path: "src/demos/quantum/bloch/model.ts", lang: "ts", note: "Bloch-vector geometry and gate rotation axes for the sphere." },
    { name: "circuit model", path: "src/demos/quantum/circuit/model.ts", lang: "ts", note: "Circuit evaluation, per-column states, and the full-circuit unitary readout." },
    { name: "simon model", path: "src/demos/quantum/simon/model.ts", lang: "ts", note: "Simon / Deutsch–Jozsa / Bernstein–Vazirani staged runs." },
    { name: "grover model", path: "src/demos/quantum/grover/model.ts", lang: "ts", note: "Grover amplitudes, success curve, and the optimal-iteration formula." },
    { name: "qi08.py", path: `${Q}/qi08.py`, lang: "python", note: "Original Python — sheet 8 (Pauli identities, qubit(θ,φ), kron, two-qubit gates). Written for the DTU weekly sheets with AI coding tools; implementation and verification are David's." },
    { name: "qi09.py", path: `${Q}/qi09.py`, lang: "python", note: "Original Python — Week 9 (U_f construction, Deutsch–Jozsa, Bernstein–Vazirani). Same footnote as qi08.py." },
    { name: "qi10.py", path: `${Q}/qi10.py`, lang: "python", note: "Original Python — Week 10 (Simon's oracle Uf_for_s, readout probabilities, solve_gf2). Same footnote as qi08.py." },
    { name: "prep script", path: "scripts/demos/quantum_prep.py", lang: "python", note: "Build-time prep: NumPy fixtures the TS simulator is tested against." },
  ],
  sourceFooter:
    "Course material: the intro QuTiP notebook is instructor-provided (DTU 10384); exercise solutions are David's, written with AI coding tools. Grover's algorithm was studied as part of the course.",
};

export default meta;
