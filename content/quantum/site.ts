import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "quantum",
  kind: "demo",
  displayName: "Quantum Playground",
  fakeDomain: "quantum.davids.net",
  liveUrl: "/demos/quantum",
  tagline: "The algorithms studied at DTU, re-implemented so you can watch them run.",
  description:
    "A browser state-vector simulator (1-5 qubits) following the DTU Quantum Information course arc: an orbitable Bloch sphere where every gate is a visible rotation, a drag-and-drop circuit builder whose amplitude bars morph as a playhead sweeps the wires, Simon's algorithm staged like the textbook derivation (superposition, oracle pairing, interference, and a live GF(2) solver narrowing the hidden string), and a Grover iterator where the oracle flips the marked amplitude and the diffusion operator reflects everything about the mean. Deutsch-Jozsa and Bernstein-Vazirani included. All linear algebra hand-written in TypeScript and tested against NumPy fixtures.",
  accentColor: "#7C3AED",
  favicon: "⚛️",
  techStack: ["TypeScript", "three.js", "QuTiP 5 / qutip-qip (studied)", "NumPy"],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#bloch",
      title: "Bloch sphere — single-qubit geometry",
      snippet:
        "An orbitable 3D Bloch sphere: set theta and phi, apply X, Y, Z, H, S, T or parameterized rotations, and watch the state slerp along the rotation axis. Live amplitudes and Pauli expectation values.",
      keywords: ["bloch sphere", "qubit", "pauli", "quantum gates", "three.js"],
    },
    {
      path: "#circuit",
      title: "Circuit builder — 2-3 qubits",
      snippet:
        "Drag gates onto wires, then sweep the playhead: the 2^N amplitude bars morph at every column, phase as hue. Presets include the course's Bell-state circuit; measurement runs 1000 shots.",
      keywords: ["quantum circuit", "cnot", "bell state", "toffoli", "amplitudes"],
    },
    {
      path: "#simon",
      title: "Simon's algorithm — plus Deutsch-Jozsa and Bernstein-Vazirani",
      snippet:
        "Pick a hidden string s: the oracle pairs x with x XOR s, the final Hadamard cancels every y with odd y.s, and each measured y feeds a live GF(2) solver until only s remains.",
      keywords: ["simon's algorithm", "deutsch-jozsa", "bernstein-vazirani", "oracle", "gf(2)"],
    },
    {
      path: "#grover",
      title: "Grover iterator — amplitude amplification",
      snippet:
        "Watch the two moves of each Grover iteration - oracle flip below the axis, reflection about the mean - and see the success probability peak at the optimal iteration count, then over-rotate past it.",
      keywords: ["grover", "amplitude amplification", "quantum search", "diffusion operator"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "qutip",
    "quantum",
    "quantum computing",
    "quantum information",
    "bloch sphere",
    "grover",
    "grover's algorithm",
    "simon's algorithm",
    "deutsch-jozsa",
    "bernstein-vazirani",
    "quantum circuit",
    "state vector simulator",
    "dtu",
    "denmark",
    "qubit",
  ],
  knowledgePanel: {
    type: "Interactive demo",
    facts: {
      Course: "Quantum Information (DTU 10384, fall 2025)",
      "Max qubits": "5 (32-dimensional state vector, simulated live in TypeScript)",
      Algorithms: "Deutsch-Jozsa, Bernstein-Vazirani, Simon, Grover",
      Verified: "TS simulator tested against NumPy fixtures from the course solutions",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
