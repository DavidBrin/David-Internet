/**
 * Grover iterator — model.
 *
 * The shared simulator (`@/demos/quantum/sim/core`) keeps textbook Grover's
 * amplitudes real and exposes `groverIterate` as one atomic step (oracle flip
 * then reflect-about-mean). For the panel's half-step animation we need the
 * two reflections separately, so they're implemented here — `oracleFlip` and
 * `diffuse` compose to exactly the same result as `groverIterate`.
 */
import { groverOptimalIterations as coreOptimalIterations, sample } from "@/demos/quantum/sim/core";

/** Oracle reflection: flip the sign of every marked amplitude, in place. */
export function oracleFlip(amps: Float64Array, marked: Set<number>): void {
  for (const m of marked) amps[m] = -amps[m];
}

/** Diffusion reflection: reflect every amplitude about the mean, in place. */
export function diffuse(amps: Float64Array): void {
  let mean = 0;
  for (let i = 0; i < amps.length; i++) mean += amps[i];
  mean /= amps.length;
  for (let i = 0; i < amps.length; i++) amps[i] = 2 * mean - amps[i];
}

export function mean(amps: Float64Array): number {
  let m = 0;
  for (let i = 0; i < amps.length; i++) m += amps[i];
  return m / amps.length;
}

export function successProbability(amps: Float64Array, marked: Set<number>): number {
  let p = 0;
  for (const m of marked) p += amps[m] * amps[m];
  return p;
}

export function initialAmplitudes(n: number): Float64Array {
  const N = 1 << n;
  return new Float64Array(N).fill(1 / Math.sqrt(N));
}

export function groverOptimalIterations(N: number, M: number): number {
  return coreOptimalIterations(N, M);
}

/** Immutable running state for the panel: current amplitudes, half-step flag, history of P(marked). */
export interface RunState {
  n: number;
  marked: Set<number>;
  N: number;
  M: number;
  optimal: number;
  amps: Float64Array;
  /** true right after the oracle flip, before diffusion completes the iteration. */
  oraclePending: boolean;
  /** completed full iterations. */
  iteration: number;
  /** P(marked) after each completed iteration; history[0] is the pre-iteration (uniform) state. */
  history: number[];
}

export function createRun(n: number, marked: Set<number>): RunState {
  const N = 1 << n;
  const amps = initialAmplitudes(n);
  const M = marked.size;
  return {
    n,
    marked: new Set(marked),
    N,
    M,
    optimal: groverOptimalIterations(N, M),
    amps,
    oraclePending: false,
    iteration: 0,
    history: [successProbability(amps, marked)],
  };
}

/** Apply the oracle half-step. No-op if already pending (call diffuse first). */
export function stepOracle(run: RunState): RunState {
  if (run.oraclePending) return run;
  const amps = run.amps.slice();
  oracleFlip(amps, run.marked);
  return { ...run, amps, oraclePending: true };
}

/** Apply the diffusion half-step, completing one full iteration. */
export function stepDiffuse(run: RunState): RunState {
  const amps = run.amps.slice();
  diffuse(amps);
  const p = successProbability(amps, run.marked);
  return {
    ...run,
    amps,
    oraclePending: false,
    iteration: run.iteration + 1,
    history: [...run.history, p],
  };
}

/** Full iteration: oracle then diffuse. */
export function stepIterate(run: RunState): RunState {
  return stepDiffuse(stepOracle(run));
}

export interface MeasureResult {
  index: number;
  hit: boolean;
}

/** Sample one basis index from |amp|^2. rand in [0,1). */
export function measure(run: RunState, rand: number): MeasureResult {
  const probs = new Float64Array(run.N);
  for (let i = 0; i < run.N; i++) probs[i] = run.amps[i] * run.amps[i];
  const index = sample(probs, rand);
  return { index, hit: run.marked.has(index) };
}
