/**
 * Circuit builder model: fixture reproduction (Bell preset from the intro
 * notebook, GHZ preset) and the Werner-state fidelity curve, both generated
 * from the course's NumPy solutions (pnpm sync-demos quantum).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRESET_BELL,
  PRESET_GHZ,
  circuitUnitary,
  finalState,
  measureOnce,
  wernerFidelity,
} from "@/demos/quantum/circuit/model";

function fx<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8")) as T;
}

const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe("circuit model — Bell preset (intro notebook)", () => {
  interface CircuitFx {
    bellCircuit: { state: number[][]; unitaryCol0: number[][] };
    ghz: number[][];
  }
  const f = fx<CircuitFx>("quantum-circuit.json");

  it("evaluates the Bell preset's final state", () => {
    const s = finalState(2, PRESET_BELL);
    for (let i = 0; i < 4; i++) {
      close(s.re[i], f.bellCircuit.state[i][0]);
      close(s.im[i], f.bellCircuit.state[i][1]);
    }
  });

  it("composes a full circuit unitary whose column 0 matches the fixture", () => {
    const u = circuitUnitary(2, PRESET_BELL);
    // column 0 of U is U|00>, i.e. exactly the final state (since the circuit starts at |00>)
    for (let r = 0; r < 4; r++) {
      close(u.re[r * 4 + 0], f.bellCircuit.unitaryCol0[r][0]);
      close(u.im[r * 4 + 0], f.bellCircuit.unitaryCol0[r][1]);
    }
  });

  it("evaluates the GHZ preset", () => {
    const s = finalState(3, PRESET_GHZ);
    for (let i = 0; i < 8; i++) {
      close(s.re[i], f.ghz[i][0]);
      close(s.im[i], f.ghz[i][1]);
    }
  });
});

describe("Werner fidelity (intro notebook plot)", () => {
  interface WernerFx {
    p: number[];
    fidelity: number[];
  }
  const f = fx<WernerFx>("quantum-werner.json");

  it("matches the NumPy fidelity curve at all 21 points", () => {
    for (let i = 0; i < f.p.length; i++) {
      close(wernerFidelity(f.p[i]), f.fidelity[i]);
    }
  });
});

describe("measure()", () => {
  it("samples the expected basis index from a stubbed RNG", () => {
    // Bell preset final state has probabilities [0.5, 0, 0, 0.5] over |00>..|11>.
    expect(measureOnce(2, PRESET_BELL, 0.1)).toBe(0);
    expect(measureOnce(2, PRESET_BELL, 0.9)).toBe(3);
  });
});
