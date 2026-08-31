/**
 * Lab 2 (echo cancellation) must reproduce SciPy on the shipped, quantized recording
 * (fixture from scripts/demos/signals_prep.py): the autocorrelation-based estimator finds the
 * true N and alpha, and the inverse IIR filter reproduces a reference slice of recovered audio.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { autocorr } from "@/demos/signals/dsp/fft";
import { estimateEcho, inverseFilter, isStable, poleRadius, delayMs, alphaFromRatio } from "@/demos/signals/echo/model";

interface Lab2Header {
  fs: number;
  n: number;
  alpha: number;
  N: number;
  signal: { file: string; n: number; fs: number; scale: number };
}

interface Fixture {
  fs: number;
  trueN: number;
  trueAlpha: number;
  R0: number;
  Rpeak: number;
  estN: number;
  /** SciPy's un-clamped formula sqrt(1-4r^2) goes complex here (quantization pushes r just past
   * 0.5 at the true peak) and comes back as NaN — written literally as `NaN` in the JSON, which
   * is why this fixture can't go through a plain JSON.parse. It's the reason the model clamps
   * (see MAX_RATIO in model.ts): a correct estimator must NOT reproduce that NaN. */
  estAlpha: number;
  recoveredSlice: { from: number; x: number[] };
}

function readFixture(): Fixture {
  const raw = fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", "signals-lab2.json"), "utf8");
  return JSON.parse(raw.replace(/\bNaN\b/g, '"__NaN__"'), (_key, value) => (value === "__NaN__" ? NaN : value)) as Fixture;
}

const fx = readFixture();
const header = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "public", "demos", "signals", "lab2.json"), "utf8"),
) as Lab2Header;

function loadSignal(): Float64Array {
  const buf = fs.readFileSync(path.join(process.cwd(), "public", "demos", "signals", header.signal.file));
  const int16 = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
  const out = new Float64Array(int16.length);
  for (let i = 0; i < int16.length; i++) out[i] = int16[i] / header.signal.scale;
  return out;
}

function relDiff(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
}

describe("echo model against the shipped signal", () => {
  const y = loadSignal();
  const R = autocorr(y, 20000);

  it("loads the fixture's true parameters (sanity)", () => {
    expect(fx.trueN).toBe(header.N);
    expect(fx.trueAlpha).toBe(header.alpha);
    expect(y.length).toBe(header.n);
  });

  it("matches the shared autocorr's R[0] and R[trueN] within relative 1e-6", () => {
    expect(relDiff(R[0], fx.R0)).toBeLessThan(1e-6);
    expect(relDiff(R[fx.trueN], fx.Rpeak)).toBeLessThan(1e-6);
  });

  it("estimates N exactly", () => {
    const est = estimateEcho(R);
    expect(est.N).toBe(fx.estN);
    expect(est.N).toBe(header.N);
  });

  it("clamps the height ratio instead of reproducing SciPy's NaN, landing just under alpha=1", () => {
    expect(Number.isFinite(fx.estAlpha)).toBe(true); // prep clamps r just under 0.5 (raw ratio 0.5021) // documents the quantization edge case above
    const est = estimateEcho(R);
    expect(Number.isFinite(est.alpha)).toBe(true);
    expect(est.alpha).toBeLessThan(1);
    expect(est.alpha).toBeGreaterThan(0.99);
    // and directly: the measured ratio at the true peak is (just) at/over the r=0.5 ceiling
    expect(est.r).toBeGreaterThanOrEqual(0.5);
    expect(alphaFromRatio(est.r)).toBeCloseTo(est.alpha, 12);
  });

  it("reproduces the reference recovered-audio slice with the true N, alpha within 1e-9", () => {
    const yrec = inverseFilter(y, fx.trueN, fx.trueAlpha);
    const { from, x } = fx.recoveredSlice;
    for (let i = 0; i < x.length; i++) {
      expect(Math.abs(yrec[from + i] - x[i])).toBeLessThan(1e-9);
    }
  });
});

describe("echo model — pure math", () => {
  it("alphaFromRatio inverts r = alpha/(1+alpha^2) for alpha in (0,1)", () => {
    for (const alpha of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const r = alpha / (1 + alpha * alpha);
      expect(alphaFromRatio(r)).toBeCloseTo(alpha, 9);
    }
  });

  it("clamps ratios at/above the r=0.5 ceiling instead of going complex", () => {
    expect(Number.isFinite(alphaFromRatio(0.5))).toBe(true);
    expect(Number.isFinite(alphaFromRatio(0.6))).toBe(true);
    expect(alphaFromRatio(0.5)).toBeGreaterThan(0.99);
    expect(alphaFromRatio(0.5)).toBeLessThan(1);
  });

  it("inverseFilter undoes a synthetic single echo exactly", () => {
    const n = 20000;
    const N = 5000;
    const alpha = 0.9;
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = Math.sin(i * 0.01) * 0.3 + (i % 37 === 0 ? 0.2 : 0);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) y[i] = x[i] + (i >= N ? alpha * x[i - N] : 0);
    const yrec = inverseFilter(y, N, alpha);
    for (let i = 0; i < n; i++) expect(Math.abs(yrec[i] - x[i])).toBeLessThan(1e-9);
  });

  it("pole radius and stability flip together at |alpha| = 1", () => {
    expect(poleRadius(0.9, 5000)).toBeLessThan(1);
    expect(isStable(0.9)).toBe(true);
    expect(poleRadius(1.2, 5000)).toBeGreaterThan(1);
    expect(isStable(1.2)).toBe(false);
    expect(isStable(1)).toBe(false);
  });

  it("delayMs converts the true N/fs to ~227 ms", () => {
    expect(delayMs(5000, 22050)).toBeCloseTo(226.757, 2);
  });
});
