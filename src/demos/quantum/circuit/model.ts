/**
 * Circuit builder model: gate placement, per-column state evaluation, full
 * circuit unitary composition, known-4x4-gate matching, and the Werner-state
 * fidelity formula from the intro QuTiP notebook.
 *
 * Convention (matching sim/core.ts): qubit 0 is the top wire / most significant
 * bit. All actual linear algebra is delegated to sim/core.ts; this module only
 * knows how to turn a placed-gate circuit into calls against that simulator.
 */
import {
  GATES,
  type Mat,
  type State,
  applyGate,
  basis,
  cloneState,
  gateUnitary,
  identityMat,
  mat,
  matMul,
  phase as phaseGate,
  probabilities,
  sample,
} from "@/demos/quantum/sim/core";

export const GATE_NAMES = ["H", "X", "Y", "Z", "S", "T", "CNOT", "CZ", "CRZ", "SWAP", "TOFFOLI"] as const;
export type GateName = (typeof GATE_NAMES)[number];

export const NUM_COLS = 8;

export interface PlacedGate {
  id: string;
  col: number;
  name: GateName;
  /** wires the gate's matrix acts on; role order matches sim/core targets convention */
  targets: number[];
  /** control wires (must be |1> for the gate to apply) */
  controls: number[];
  /** CRZ angle in radians (defaults to -pi, the intro notebook's value) */
  arg?: number;
}

export type Circuit = PlacedGate[];

/** How many wires (targets + controls) a gate of this name needs, in placement order. */
export function wireRoles(name: GateName): { targets: number; controls: number } {
  switch (name) {
    case "H":
    case "X":
    case "Y":
    case "Z":
    case "S":
    case "T":
      return { targets: 1, controls: 0 };
    case "CNOT":
    case "CZ":
    case "CRZ":
      return { targets: 1, controls: 1 };
    case "SWAP":
      return { targets: 2, controls: 0 };
    case "TOFFOLI":
      return { targets: 1, controls: 2 };
  }
}

export function totalWires(name: GateName): number {
  const r = wireRoles(name);
  return r.targets + r.controls;
}

/** SWAP as a 4x4 matrix on two targets [a, b] (a = MSB, matching sim/core's target order). */
export const SWAP_MAT: Mat = mat(4, [
  [1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 0],
]);

/** The gate's matrix, independent of which wires it's placed on. */
export function gateMat(g: PlacedGate): Mat {
  switch (g.name) {
    case "H":
      return GATES.H;
    case "X":
      return GATES.X;
    case "Y":
      return GATES.Y;
    case "Z":
      return GATES.Z;
    case "S":
      return GATES.S;
    case "T":
      return GATES.T;
    case "CNOT":
      return GATES.X;
    case "CZ":
      return GATES.Z;
    case "CRZ":
      return phaseGate(g.arg ?? -Math.PI);
    case "TOFFOLI":
      return GATES.X;
    case "SWAP":
      return SWAP_MAT;
  }
}

function gatesInCol(circuit: Circuit, col: number): PlacedGate[] {
  return circuit.filter((g) => g.col === col);
}

/** Product of the (disjoint-wire) gate unitaries placed in one column. */
export function columnUnitary(n: number, gates: PlacedGate[]): Mat {
  let u = identityMat(1 << n);
  for (const g of gates) {
    const gu = gateUnitary(n, gateMat(g), g.targets, g.controls);
    u = matMul(gu, u);
  }
  return u;
}

/** Full 2^n x 2^n unitary of the circuit, columns 0..NUM_COLS-1 left to right. */
export function circuitUnitary(n: number, circuit: Circuit): Mat {
  let full = identityMat(1 << n);
  for (let c = 0; c < NUM_COLS; c++) {
    const gates = gatesInCol(circuit, c);
    if (!gates.length) continue;
    full = matMul(columnUnitary(n, gates), full);
  }
  return full;
}

/** State after |00...0> passes through each column; index 0 = before any gate. */
export function evalColumns(n: number, circuit: Circuit): State[] {
  const states: State[] = [];
  const s = basis(n, 0);
  states.push(cloneState(s));
  for (let c = 0; c < NUM_COLS; c++) {
    for (const g of gatesInCol(circuit, c)) applyGate(s, gateMat(g), g.targets, g.controls);
    states.push(cloneState(s));
  }
  return states;
}

export function finalState(n: number, circuit: Circuit): State {
  const states = evalColumns(n, circuit);
  return states[states.length - 1];
}

// ---------------------------------------------------------------- presets

export const PRESET_BELL: Circuit = [
  { id: "bell-h", col: 0, name: "H", targets: [1], controls: [] },
  { id: "bell-cnot", col: 1, name: "CNOT", targets: [0], controls: [1] },
  { id: "bell-crz", col: 2, name: "CRZ", targets: [1], controls: [0], arg: -Math.PI },
];

export const PRESET_GHZ: Circuit = [
  { id: "ghz-h", col: 0, name: "H", targets: [0], controls: [] },
  { id: "ghz-cnot0", col: 1, name: "CNOT", targets: [1], controls: [0] },
  { id: "ghz-cnot1", col: 2, name: "CNOT", targets: [2], controls: [1] },
];

// ---------------------------------------------------------------- known 4x4 gates

interface KnownGate {
  label: string;
  mat: Mat;
}

let knownGatesCache: KnownGate[] | null = null;

function knownGates(): KnownGate[] {
  if (knownGatesCache) return knownGatesCache;
  knownGatesCache = [
    { label: "I", mat: identityMat(4) },
    { label: "CNOT", mat: gateUnitary(2, GATES.X, [1], [0]) },
    { label: "I ⊗ X", mat: gateUnitary(2, GATES.X, [1]) },
    { label: "X ⊗ I", mat: gateUnitary(2, GATES.X, [0]) },
    { label: "CZ", mat: gateUnitary(2, GATES.Z, [1], [0]) },
    { label: "SWAP", mat: gateUnitary(2, SWAP_MAT, [0, 1]) },
  ];
  return knownGatesCache;
}

/**
 * If `u` (4x4) equals a known pen-and-paper gate up to a global phase (within
 * 1e-9), return its label; else null. Uses the Frobenius overlap trick: for
 * unitary U, K, |sum conj(U_ij) K_ij| = d iff U = e^{i theta} K exactly.
 */
export function matchKnownGate(u: Mat, tol = 1e-9): string | null {
  if (u.d !== 4) return null;
  for (const k of knownGates()) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < u.re.length; i++) {
      re += u.re[i] * k.mat.re[i] + u.im[i] * k.mat.im[i];
      im += u.re[i] * k.mat.im[i] - u.im[i] * k.mat.re[i];
    }
    const mag = Math.hypot(re, im);
    if (Math.abs(mag - u.d) < tol * u.d) return k.label;
  }
  return null;
}

// ---------------------------------------------------------------- measurement

/** Single sample from the circuit's final-state distribution given rand in [0,1). */
export function measureOnce(n: number, circuit: Circuit, rand: number): number {
  const probs = probabilities(finalState(n, circuit));
  return sample(probs, rand);
}

/** `shots` samples, returned as basis-index -> count. */
export function measureShots(n: number, circuit: Circuit, shots: number, rand: () => number): number[] {
  const probs = probabilities(finalState(n, circuit));
  const counts = new Array(probs.length).fill(0) as number[];
  for (let i = 0; i < shots; i++) counts[sample(probs, rand())]++;
  return counts;
}

// ---------------------------------------------------------------- display helpers

export function basisLabel(n: number, idx: number): string {
  return `|${idx.toString(2).padStart(n, "0")}⟩`;
}

/** Phase angle of a complex amplitude, in degrees [0, 360), for hue mapping. */
export function phaseDeg(re: number, im: number): number {
  const deg = (Math.atan2(im, re) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

// ---------------------------------------------------------------- Werner mixed state

/**
 * Fidelity of the Werner state W(p) = p/4 * I4 + (1-p) |Psi-><Psi-| to the
 * singlet |Psi-> = (|01> - |10>)/sqrt2, from the intro notebook: since
 * <Psi-|Psi-> = 1 and <Psi-|I|Psi-> = 1, F = sqrt(<Psi-|W(p)|Psi->)
 * = sqrt((1-p) + p/4).
 */
export function wernerFidelity(p: number): number {
  return Math.sqrt(1 - p + p / 4);
}
