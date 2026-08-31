import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { closedLoopPoles, makeDerivative, rk4, type State2 } from "@/demos/signals/cartpole/model";

interface Fixture {
  g: number;
  L: number;
  k1: number;
  k2: number;
  dt: number;
  t: number[];
  analytic: number[];
  rk4: number[];
  openLoopPoles: [number, number];
}

const fixture = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", "signals-lab5.json"), "utf8"),
) as Fixture;

describe("cartpole model against the SciPy fixture", () => {
  it("RK4 (dt=0.05, x=0, state0=[0,1]) reproduces fixture.rk4 within 1e-9", () => {
    const deriv = makeDerivative(fixture.k1, fixture.k2, { g: fixture.g, L: fixture.L });
    let state: State2 = [0, 1];
    const got: number[] = [state[0]];
    for (let i = 1; i < fixture.t.length; i++) {
      state = rk4(deriv, state, 0, fixture.dt);
      got.push(state[0]);
    }
    expect(got.length).toBe(fixture.rk4.length);
    for (let i = 0; i < got.length; i++) {
      expect(Math.abs(got[i] - fixture.rk4[i])).toBeLessThan(1e-9);
    }
  });

  it("matches the analytic impulse response t*e^(-4t) within 1e-4", () => {
    const deriv = makeDerivative(fixture.k1, fixture.k2, { g: fixture.g, L: fixture.L });
    let state: State2 = [0, 1];
    const got: number[] = [state[0]];
    for (let i = 1; i < fixture.t.length; i++) {
      state = rk4(deriv, state, 0, fixture.dt);
      got.push(state[0]);
    }
    for (let i = 0; i < got.length; i++) {
      expect(Math.abs(got[i] - fixture.analytic[i])).toBeLessThan(1e-4);
    }
  });

  it("David's PD preset (k1=-25.8, k2=-8) gives a double pole at -4", () => {
    const [p1, p2] = closedLoopPoles(fixture.k1, fixture.k2, fixture.g, fixture.L);
    expect(Math.abs(p1.re - -4)).toBeLessThan(1e-9);
    expect(Math.abs(p1.im)).toBeLessThan(1e-9);
    expect(Math.abs(p2.re - -4)).toBeLessThan(1e-9);
    expect(Math.abs(p2.im)).toBeLessThan(1e-9);
  });

  it("open loop (k1=k2=0) gives poles at +-sqrt(g/L), matching fixture.openLoopPoles", () => {
    const [p1, p2] = closedLoopPoles(0, 0, fixture.g, fixture.L);
    const got = [p1.re, p2.re].sort((a, b) => b - a);
    const want = [...fixture.openLoopPoles].sort((a, b) => b - a);
    expect(Math.abs(got[0] - want[0])).toBeLessThan(1e-9);
    expect(Math.abs(got[1] - want[1])).toBeLessThan(1e-9);
    expect(p1.im).toBe(0);
    expect(p2.im).toBe(0);
  });

  it("P-only feedback (k1=-25, k2=0) gives purely imaginary poles", () => {
    const [p1, p2] = closedLoopPoles(-25, 0, fixture.g, fixture.L);
    expect(p1.re).toBeCloseTo(0, 9);
    expect(p2.re).toBeCloseTo(0, 9);
    expect(Math.abs(p1.im)).toBeGreaterThan(0);
    expect(p1.im).toBeCloseTo(-p2.im, 9);
  });
});
