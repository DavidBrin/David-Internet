/**
 * Grover iterator model — reproduces the NumPy fixture curves via the
 * half-step oracleFlip/diffuse (which must compose to the shared simulator's
 * groverIterate), and checks both reflections are involutions.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { diffuse, groverOptimalIterations, oracleFlip, successProbability } from "@/demos/quantum/grover/model";
import { groverIterate } from "@/demos/quantum/sim/core";

interface GroverFx {
  cases: { n: number; marked: number[]; optimal: number; curve: number[] }[];
}

function fx<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8")) as T;
}

const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(tol);

const f = fx<GroverFx>("quantum-grover.json");

describe("grover model — fixture reproduction", () => {
  it("oracleFlip + diffuse reproduce the NumPy curve within 1e-9", () => {
    for (const c of f.cases) {
      const N = 1 << c.n;
      const marked = new Set(c.marked);
      const amps = new Float64Array(N).fill(1 / Math.sqrt(N));
      const curve = [successProbability(amps, marked)];
      const iters = c.curve.length - 1;
      for (let k = 0; k < iters; k++) {
        oracleFlip(amps, marked);
        diffuse(amps);
        curve.push(successProbability(amps, marked));
      }
      for (let i = 0; i < c.curve.length; i++) close(curve[i], c.curve[i]);
    }
  });

  it("groverOptimalIterations matches the fixture's optimal k*", () => {
    for (const c of f.cases) {
      expect(groverOptimalIterations(1 << c.n, c.marked.length)).toBe(c.optimal);
    }
  });

  it("the curve's max over the computed range sits at k = optimal (or P(optimal) >= 0.94 * max)", () => {
    // "The computed range" mirrors what auto-run actually shows: it stops at
    // 2x optimal (see the UI spec), and fixture curves run well past that —
    // sampling further out can land closer to a later sin^2 peak than the
    // first one by pure discretization luck, which isn't the property under
    // test here.
    for (const c of f.cases) {
      const range = c.curve.slice(0, Math.min(c.curve.length, 2 * c.optimal + 1));
      const max = Math.max(...range);
      const argmax = range.indexOf(max);
      const atOptimal = c.curve[c.optimal];
      if (argmax !== c.optimal) {
        // allow the max to land on a neighbor for edge cases, as long as
        // optimal is still close to the peak
        expect(Math.abs(argmax - c.optimal)).toBeLessThanOrEqual(2);
        expect(atOptimal).toBeGreaterThanOrEqual(0.94 * max);
      } else {
        expect(atOptimal).toBe(max);
      }
    }
  });

  it("oracleFlip + diffuse compose to exactly groverIterate from the shared core", () => {
    for (const c of f.cases) {
      const N = 1 << c.n;
      const marked = new Set(c.marked);
      const a = new Float64Array(N).fill(1 / Math.sqrt(N));
      const b = a.slice();
      for (let k = 0; k < 5; k++) {
        oracleFlip(a, marked);
        diffuse(a);
        groverIterate(b, marked);
        for (let i = 0; i < N; i++) close(a[i], b[i], 1e-12);
      }
    }
  });
});

describe("grover model — involutions", () => {
  it("oracleFlip twice is identity", () => {
    for (const c of f.cases) {
      const N = 1 << c.n;
      const marked = new Set(c.marked);
      const amps = new Float64Array(N).map((_, i) => Math.sin(i + 1) / Math.sqrt(N)); // arbitrary nonzero state
      const original = amps.slice();
      oracleFlip(amps, marked);
      oracleFlip(amps, marked);
      for (let i = 0; i < N; i++) close(amps[i], original[i], 1e-12);
    }
  });

  it("diffuse twice is identity", () => {
    for (const c of f.cases) {
      const N = 1 << c.n;
      const amps = new Float64Array(N).map((_, i) => Math.cos(i + 1) / Math.sqrt(N)); // arbitrary nonzero state
      const original = amps.slice();
      diffuse(amps);
      diffuse(amps);
      for (let i = 0; i < N; i++) close(amps[i], original[i], 1e-12);
    }
  });
});
