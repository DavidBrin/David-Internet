/**
 * The hand-written TS state-vector simulator must reproduce the NumPy fixtures
 * generated from the course solutions (pnpm sync-demos quantum).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GATES,
  applyGate,
  applyUnitary,
  basis,
  groverCurve,
  groverOptimalIterations,
  marginalTop,
  mat,
  oracleUf,
  pauliExpectation,
  qubitState,
  simonCandidates,
  simonF,
  zeros,
} from "@/demos/quantum/sim/core";

function fx<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8")) as T;
}

const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe("bloch fixture", () => {
  interface BlochFx {
    tests: { theta: number; phi: number; state: number[][]; bloch: number[] }[];
    identities: Record<string, boolean>;
    "gateActionOn_2.0_5.0": Record<string, number[][]>;
  }
  const f = fx<BlochFx>("quantum-bloch.json");

  it("qubit(theta, phi) matches NumPy", () => {
    for (const t of f.tests) {
      const s = qubitState(t.theta, t.phi);
      for (let i = 0; i < 2; i++) {
        close(s.re[i], t.state[i][0]);
        close(s.im[i], t.state[i][1]);
      }
      close(pauliExpectation(s, 0, "x"), t.bloch[0]);
      close(pauliExpectation(s, 0, "y"), t.bloch[1]);
      close(pauliExpectation(s, 0, "z"), t.bloch[2]);
    }
  });

  it("gate actions on qubit(2.0, 5.0) match NumPy", () => {
    for (const [name, expected] of Object.entries(f["gateActionOn_2.0_5.0"])) {
      const s = qubitState(2.0, 5.0);
      if (name === "Rx1.1") {
        const c = Math.cos(0.55);
        const sn = Math.sin(0.55);
        applyGate(s, mat(2, [[c, 0, 0, -sn], [0, -sn, c, 0]]), [0]);
      } else {
        applyGate(s, GATES[name], [0]);
      }
      for (let i = 0; i < 2; i++) {
        close(s.re[i], expected[i][0]);
        close(s.im[i], expected[i][1]);
      }
    }
  });
});

describe("circuit fixture (intro notebook Bell + GHZ)", () => {
  interface CircuitFx {
    bellCircuit: { state: number[][] };
    ghz: number[][];
  }
  const f = fx<CircuitFx>("quantum-circuit.json");

  it("H q1, CNOT c1->t0, CRZ c0->t1(-pi) on |00> matches", () => {
    const s = basis(2, 0);
    applyGate(s, GATES.H, [1]);
    applyGate(s, GATES.X, [0], [1]);
    applyGate(s, mat(2, [[1, 0, 0, 0], [0, 0, Math.cos(-Math.PI), Math.sin(-Math.PI)]]), [1], [0]);
    for (let i = 0; i < 4; i++) {
      close(s.re[i], f.bellCircuit.state[i][0]);
      close(s.im[i], f.bellCircuit.state[i][1]);
    }
  });

  it("GHZ via H(0), CNOT(0->1), CNOT(1->2) matches", () => {
    const s = basis(3, 0);
    applyGate(s, GATES.H, [0]);
    applyGate(s, GATES.X, [1], [0]);
    applyGate(s, GATES.X, [2], [1]);
    for (let i = 0; i < 8; i++) {
      close(s.re[i], f.ghz[i][0]);
      close(s.im[i], f.ghz[i][1]);
    }
  });
});

describe("simon / dj / bv fixture", () => {
  interface SimonFx {
    n: number;
    m: number;
    s: number;
    inputProbs: number[];
    survivors: number[];
    dj: Record<string, number>;
    bv: { s: string; probs: number[] };
  }
  const f = fx<SimonFx>("quantum-simon.json");

  function hadamardTop(s: ReturnType<typeof zeros>, k: number) {
    for (let q = 0; q < k; q++) applyGate(s, GATES.H, [q]);
  }

  it("Simon input-register probabilities match the Week 10 run", () => {
    const { n, m } = f;
    const s = basis(n + m, 0);
    hadamardTop(s, n);
    applyUnitary(s, oracleUf(simonF(f.s), n, m));
    hadamardTop(s, n);
    const probs = marginalTop(s, n);
    for (let i = 0; i < probs.length; i++) close(probs[i], f.inputProbs[i]);
    const survivors = [...probs.keys()].filter((y) => probs[y] > 1e-12);
    expect(survivors).toEqual(f.survivors);
  });

  it("GF(2) candidates from all survivors are exactly {s}", () => {
    const nonzero = f.survivors.filter((y) => y !== 0);
    expect(simonCandidates(nonzero, f.n)).toEqual([f.s]);
  });

  it("Deutsch-Jozsa probabilities match Week 9", () => {
    const n = 3;
    const fns: Record<string, (x: number) => number> = {
      constant0: () => 0,
      constant1: () => 1,
      bit0: (x) => (x >> 2) & 1,
      xor01: (x) => (((x >> 2) & 1) ^ ((x >> 1) & 1)),
    };
    for (const [name, fn] of Object.entries(fns)) {
      const s = basis(n + 1, 1); // |0^n>|1>
      for (let q = 0; q <= n; q++) applyGate(s, GATES.H, [q]);
      applyUnitary(s, oracleUf(fn, n, 1));
      for (let q = 0; q < n; q++) applyGate(s, GATES.H, [q]);
      const probs = marginalTop(s, n);
      close(probs[0], f.dj[name]);
    }
  });

  it("Bernstein-Vazirani peaks at s=101", () => {
    const n = 3;
    const sBits = [1, 0, 1];
    const fn = (x: number) => (((x >> 2) & 1) & sBits[0]) ^ (((x >> 1) & 1) & sBits[1]) ^ ((x & 1) & sBits[2]);
    const s = basis(n + 1, 1);
    for (let q = 0; q <= n; q++) applyGate(s, GATES.H, [q]);
    applyUnitary(s, oracleUf(fn, n, 1));
    for (let q = 0; q < n; q++) applyGate(s, GATES.H, [q]);
    const probs = marginalTop(s, n);
    for (let x = 0; x < 8; x++) close(probs[x], f.bv.probs[x]);
  });
});

describe("grover fixture", () => {
  interface GroverFx {
    cases: { n: number; marked: number[]; optimal: number; curve: number[] }[];
  }
  const f = fx<GroverFx>("quantum-grover.json");

  it("success curves and optimal iteration counts match NumPy", () => {
    for (const c of f.cases) {
      expect(groverOptimalIterations(1 << c.n, c.marked.length)).toBe(c.optimal);
      const curve = groverCurve(c.n, new Set(c.marked), c.curve.length - 1);
      for (let i = 0; i < c.curve.length; i++) close(curve[i], c.curve[i]);
    }
  });
});
