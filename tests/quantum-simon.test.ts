/**
 * Simon / Deutsch-Jozsa / Bernstein-Vazirani model must reproduce the NumPy fixture
 * generated from the course solutions (pnpm sync-demos quantum).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DJ_FN_ORDER,
  DEFAULT_BV_S,
  bvFn,
  isSolved,
  measureStep,
  runBV,
  runDJ,
  runSimon,
} from "@/demos/quantum/simon/model";
import { simonCandidates } from "@/demos/quantum/sim/core";

interface SimonFx {
  n: number;
  m: number;
  s: number;
  inputProbs: number[];
  survivors: number[];
  survivorsSatisfyYdotS0: boolean;
  dj: Record<string, number>;
  bv: { s: string; probs: number[] };
}

function fx<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8")) as T;
}

const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(tol);

const f = fx<SimonFx>("quantum-simon.json");

describe("Simon staged runner", () => {
  const run = runSimon(f.n, f.s);

  it("stage after H^n only is uniform over 2^n", () => {
    const expected = 1 / (1 << f.n);
    for (const p of run.uniform) close(p, expected);
    // the oracle stage keeps the same input-register marginal
    for (const p of run.afterOracle) close(p, expected);
  });

  it("final distribution matches the NumPy fixture within 1e-9", () => {
    expect(run.final.length).toBe(f.inputProbs.length);
    for (let i = 0; i < run.final.length; i++) close(run.final[i], f.inputProbs[i]);
  });

  it("survivor set matches the fixture", () => {
    expect(run.survivors).toEqual(f.survivors);
  });

  it("pairs cover every x exactly once via x XOR s", () => {
    const seen = new Set<number>();
    for (const [x, y] of run.pairs) {
      expect(x).toBeLessThan(y);
      expect(x ^ f.s).toBe(y);
      seen.add(x);
      seen.add(y);
    }
    expect(seen.size).toBe(1 << f.n);
  });

  it("solver: feeding all nonzero survivors yields exactly [s]", () => {
    const nonzero = f.survivors.filter((y) => y !== 0);
    expect(simonCandidates(nonzero, f.n)).toEqual([f.s]);
  });

  it("measureStep loop converges to a single candidate using only final-distribution samples", () => {
    // deterministic rand sequence sweeping [0,1) so every outcome gets sampled eventually
    let state = { ys: [] as number[], shots: 0, candidates: simonCandidates([], f.n) };
    let rand = 0;
    let iterations = 0;
    while (!isSolved(state.candidates) && iterations < 10000) {
      state = measureStep(state, f.n, run.final, rand);
      rand = (rand + 0.0137) % 1;
      iterations++;
    }
    expect(state.candidates).toEqual([f.s]);
  });
});

describe("Deutsch-Jozsa runner", () => {
  it("reproduces all four fixture probabilities", () => {
    for (const name of DJ_FN_ORDER) {
      const run = runDJ(name);
      close(run.final[0], f.dj[name]);
      expect(run.verdict).toBe(f.dj[name] > 0.5 ? "constant" : "balanced");
      for (const p of run.uniform) close(p, 1 / 8);
    }
  });
});

describe("Bernstein-Vazirani runner", () => {
  it("reproduces the fixture spike at s=101 (5)", () => {
    const run = runBV(0b101);
    expect(run.s).toBe(5);
    expect(f.bv.s).toBe("101");
    for (let x = 0; x < run.final.length; x++) close(run.final[x], f.bv.probs[x]);
  });

  it("default BV s matches the same worked example", () => {
    expect(DEFAULT_BV_S).toBe(5);
    expect(bvFn(5)(0)).toBe(0);
  });
});
