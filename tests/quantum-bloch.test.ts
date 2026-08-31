/**
 * Bloch panel model tests, against the NumPy fixture in tests/fixtures/quantum-bloch.json.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GATES,
  applyGate,
  mat,
  matMul,
  qubitState,
} from "@/demos/quantum/sim/core";
import {
  axisAngleFromGate,
  blochVector,
  matsApproxEqual,
  pauliIdentities,
  thetaPhiFromState,
} from "@/demos/quantum/bloch/model";

interface BlochFx {
  tests: { theta: number; phi: number; state: number[][]; bloch: number[] }[];
  identities: Record<string, boolean>;
  "gateActionOn_2.0_5.0": Record<string, number[][]>;
}

function fx<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8")) as T;
}

const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(tol);

const f = fx<BlochFx>("quantum-bloch.json");

describe("blochVector", () => {
  it("matches the NumPy bloch vector for every fixture entry", () => {
    for (const t of f.tests) {
      const s = qubitState(t.theta, t.phi);
      const [x, y, z] = blochVector(s);
      close(x, t.bloch[0]);
      close(y, t.bloch[1]);
      close(z, t.bloch[2]);
    }
  });
});

describe("thetaPhiFromState", () => {
  it("round-trips every fixture state through qubitState", () => {
    for (const t of f.tests) {
      const s = qubitState(t.theta, t.phi);
      const { theta, phi } = thetaPhiFromState(s);
      const s2 = qubitState(theta, phi);
      close(s2.re[0], s.re[0]);
      close(s2.im[0], s.im[0]);
      close(s2.re[1], s.re[1]);
      close(s2.im[1], s.im[1]);
      // theta itself should match exactly (unlike phi, it carries no phase gauge freedom)
      close(theta, t.theta);
    }
  });

  it("recovers the same Bloch vector after a gate induces a global phase on the state", () => {
    // H picks up a genuine global phase relative to qubitState's alpha-real-nonneg gauge,
    // so raw amplitudes won't round-trip - but the physical Bloch vector must.
    const s = qubitState(2.0, 5.0);
    applyGate(s, GATES.H, [0]);
    const { theta, phi } = thetaPhiFromState(s);
    const s2 = qubitState(theta, phi);
    const [x1, y1, z1] = blochVector(s);
    const [x2, y2, z2] = blochVector(s2);
    close(x2, x1);
    close(y2, y1);
    close(z2, z1);
  });
});

describe("axisAngleFromGate", () => {
  it("X: axis (1,0,0), angle pi", () => {
    const { axis, angle } = axisAngleFromGate(GATES.X);
    close(axis[0], 1);
    close(axis[1], 0);
    close(axis[2], 0);
    close(angle, Math.PI);
  });

  it("H: axis (1,0,1)/sqrt(2), angle pi", () => {
    const { axis, angle } = axisAngleFromGate(GATES.H);
    const r2 = Math.SQRT1_2;
    close(axis[0], r2);
    close(axis[1], 0);
    close(axis[2], r2);
    close(angle, Math.PI);
  });

  it("decomposition reproduces the gate action on qubit(2.0, 5.0) for every gate in the fixture", () => {
    for (const [name, expected] of Object.entries(f["gateActionOn_2.0_5.0"])) {
      let g;
      if (name === "Rx1.1") {
        const c = Math.cos(0.55);
        const sn = Math.sin(0.55);
        g = mat(2, [[c, 0, 0, -sn], [0, -sn, c, 0]]);
      } else {
        g = GATES[name];
      }
      const { axis, angle, alpha } = axisAngleFromGate(g);
      // rebuild U = e^{i alpha} * Rn(angle) and check it acts the same as the gate itself
      const s = qubitState(2.0, 5.0);
      applyGate(s, g, [0]);
      close(s.re[0], expected[0][0]);
      close(s.im[0], expected[0][1]);
      close(s.re[1], expected[1][0]);
      close(s.im[1], expected[1][1]);

      // reconstruct Rn(angle) = cos(beta) I - i sin(beta) (n.sigma), then e^{i alpha} * that,
      // and confirm it matches the gate matrix itself up to 1e-9.
      const beta = angle / 2;
      const cb = Math.cos(beta);
      const sb = Math.sin(beta);
      const [nx, ny, nz] = axis;
      const rn = mat(2, [
        [cb, -sb * nz, -sb * ny, -sb * nx],
        [sb * ny, -sb * nx, cb, sb * nz],
      ]);
      const ca = Math.cos(alpha);
      const sa = Math.sin(alpha);
      for (let k = 0; k < 4; k++) {
        const uRe = rn.re[k] * ca - rn.im[k] * sa;
        const uIm = rn.re[k] * sa + rn.im[k] * ca;
        close(uRe, g.re[k]);
        close(uIm, g.im[k]);
      }
    }
  });
});

describe("pauliIdentities", () => {
  it("reproduces sigma_x sigma_y = i sigma_z cyclically, matching the fixture", () => {
    const checks = pauliIdentities();
    const byKey = Object.fromEntries(checks.map((c) => [c.key, c]));
    expect(byKey.XY_eq_iZ.ok).toBe(f.identities.XY_eq_iZ);
    expect(byKey.YZ_eq_iX.ok).toBe(f.identities.YZ_eq_iX);
    expect(byKey.ZX_eq_iY.ok).toBe(f.identities.ZX_eq_iY);
    for (const c of checks) {
      expect(c.ok).toBe(true);
      expect(matsApproxEqual(c.composed, c.expected, 1e-12)).toBe(true);
    }
  });

  it("matches a hand-composed matMul(X, Y) against i*Z entrywise", () => {
    const xy = matMul(GATES.X, GATES.Y);
    // i * Z = diag(i, -i)
    close(xy.re[0], 0, 1e-12);
    close(xy.im[0], 1, 1e-12);
    close(xy.re[3], 0, 1e-12);
    close(xy.im[3], -1, 1e-12);
  });
});
