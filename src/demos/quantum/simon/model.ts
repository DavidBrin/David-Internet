/**
 * Simon's algorithm, Deutsch-Jozsa, and Bernstein-Vazirani — staged runs on top of the
 * shared state-vector simulator (`@/demos/quantum/sim/core`), matching the DTU Week 9/10
 * course conventions (qubit 0 = MSB, oracle input register in the high bits).
 *
 * Tested against tests/fixtures/quantum-simon.json in tests/quantum-simon.test.ts.
 */
import {
  GATES,
  applyGate,
  applyUnitary,
  basis,
  marginalTop,
  oracleUf,
  sample,
  simonCandidates,
  simonF,
} from "@/demos/quantum/sim/core";

// ---------------------------------------------------------------- shared helpers

export const SIMON_N_OPTIONS = [2, 3, 4] as const;
export type SimonN = (typeof SIMON_N_OPTIONS)[number];

export const DEFAULT_N: SimonN = 4;
export const DEFAULT_S = 0b0110; // 6 — the course's worked Week 10 example

/** Clamp a candidate hidden string to a valid, nonzero n-bit value. */
export function clampSimonS(n: number, s: number): number {
  const max = (1 << n) - 1;
  const v = Math.max(0, Math.min(max, Math.round(s)));
  return v === 0 ? 1 : v;
}

/** popcount parity of a & b — the GF(2) dot product a.b mod 2. */
export function dotMod2(a: number, b: number): number {
  let x = a & b;
  let p = 0;
  while (x) {
    p ^= x & 1;
    x >>= 1;
  }
  return p;
}

export function toBits(x: number, n: number): string {
  return x.toString(2).padStart(n, "0");
}

// ---------------------------------------------------------------- Simon's algorithm

export interface SimonRun {
  n: number;
  s: number;
  /** Input-register probabilities after H^n — uniform 1/2^n. */
  uniform: number[];
  /** Input-register probabilities right after the oracle query (same marginal as
   *  `uniform` — the oracle only permutes the output register), kept as its own
   *  stage so the pairing arcs can be shown against a settled bar chart. */
  afterOracle: number[];
  /** x < x^s pairs — the two-to-one structure the oracle draws on top of the bars. */
  pairs: [number, number][];
  /** Input-register probabilities after the final H^n. */
  final: number[];
  /** y with nonzero probability in `final` — exactly the y with y.s = 0 (mod 2). */
  survivors: number[];
}

/** Full Simon run for hidden string s over n qubits (oracle f(x) = min(x, x^s)). */
export function runSimon(n: number, s: number): SimonRun {
  const m = n;
  const state = basis(n + m, 0);
  for (let q = 0; q < n; q++) applyGate(state, GATES.H, [q]);
  const uniform = Array.from(marginalTop(state, n));

  applyUnitary(state, oracleUf(simonF(s), n, m));
  const afterOracle = Array.from(marginalTop(state, n));

  for (let q = 0; q < n; q++) applyGate(state, GATES.H, [q]);
  const final = Array.from(marginalTop(state, n));

  const pairs: [number, number][] = [];
  for (let x = 0; x < 1 << n; x++) {
    const y = x ^ s;
    if (x < y) pairs.push([x, y]);
  }

  const survivors: number[] = [];
  for (let y = 0; y < final.length; y++) if (final[y] > 1e-9) survivors.push(y);

  return { n, s, uniform, afterOracle, pairs, final, survivors };
}

// ---------------------------------------------------------------- Simon measure/solve loop

export interface MeasureState {
  /** Distinct nonzero y's collected so far, in the order they were measured. */
  ys: number[];
  /** Total "Measure" clicks so far (including any trivial y = 0 outcomes). */
  shots: number;
  /** All s' != 0 consistent with every collected equation y.s' = 0 (mod 2). */
  candidates: number[];
}

export function initMeasure(n: number): MeasureState {
  return { ys: [], shots: 0, candidates: simonCandidates([], n) };
}

/** Sample one y from the final distribution and fold it into the equation table. */
export function measureStep(state: MeasureState, n: number, finalProbs: number[], rand: number): MeasureState {
  const y = sample(Float64Array.from(finalProbs), rand);
  const shots = state.shots + 1;
  if (y === 0 || state.ys.includes(y)) return { ...state, shots };
  const ys = [...state.ys, y];
  return { ys, shots, candidates: simonCandidates(ys, n) };
}

export function isSolved(candidates: number[]): boolean {
  return candidates.length === 1;
}

// ---------------------------------------------------------------- Deutsch-Jozsa

export const DJ_N = 3;

export type DJFnName = "constant0" | "constant1" | "bit0" | "xor01";

export const DJ_FN_ORDER: DJFnName[] = ["constant0", "constant1", "bit0", "xor01"];

export const DJ_FUNCS: Record<DJFnName, (x: number) => number> = {
  constant0: () => 0,
  constant1: () => 1,
  bit0: (x) => (x >> (DJ_N - 1)) & 1,
  xor01: (x) => ((x >> (DJ_N - 1)) & 1) ^ ((x >> (DJ_N - 2)) & 1),
};

export const DJ_LABELS: Record<DJFnName, string> = {
  constant0: "constant₀: f(x) = 0",
  constant1: "constant₁: f(x) = 1",
  bit0: "balanced: f(x) = x₀",
  xor01: "balanced: f(x) = x₀⊕x₁",
};

export interface DJRun {
  fnName: DJFnName;
  /** Input-register probabilities after H^n (before the oracle) — uniform. */
  uniform: number[];
  /** (-1)^f(x) per x — the phase kicked back onto each x branch by the oracle. */
  signs: number[];
  /** Input-register probabilities after the oracle + final H^n. */
  final: number[];
  verdict: "constant" | "balanced";
}

export function runDJ(fnName: DJFnName): DJRun {
  const n = DJ_N;
  const fn = DJ_FUNCS[fnName];
  const state = basis(n + 1, 1); // |0^n>|1>
  for (let q = 0; q <= n; q++) applyGate(state, GATES.H, [q]);
  const uniform = Array.from(marginalTop(state, n));

  applyUnitary(state, oracleUf(fn, n, 1));
  const signs: number[] = [];
  for (let x = 0; x < 1 << n; x++) signs.push(fn(x) === 0 ? 1 : -1);

  for (let q = 0; q < n; q++) applyGate(state, GATES.H, [q]);
  const final = Array.from(marginalTop(state, n));

  const verdict: "constant" | "balanced" = final[0] > 0.5 ? "constant" : "balanced";
  return { fnName, uniform, signs, final, verdict };
}

// ---------------------------------------------------------------- Bernstein-Vazirani

export const BV_N = 3;
export const DEFAULT_BV_S = 0b101; // 5 — the course's worked Week 9 example

export function bvFn(s: number): (x: number) => number {
  return (x) => dotMod2(x, s);
}

export interface BVRun {
  s: number;
  /** Input-register probabilities after H^n (before the oracle) — uniform. */
  uniform: number[];
  /** Input-register probabilities after the oracle + final H^n — a single spike at s. */
  final: number[];
}

export function runBV(s: number): BVRun {
  const n = BV_N;
  const state = basis(n + 1, 1); // |0^n>|1>
  for (let q = 0; q <= n; q++) applyGate(state, GATES.H, [q]);
  const uniform = Array.from(marginalTop(state, n));

  applyUnitary(state, oracleUf(bvFn(s), n, 1));
  for (let q = 0; q < n; q++) applyGate(state, GATES.H, [q]);
  const final = Array.from(marginalTop(state, n));

  return { s, uniform, final };
}
