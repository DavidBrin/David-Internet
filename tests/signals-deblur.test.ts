/**
 * Lab 3 (deblurring) must reproduce SciPy on a small synthetic fixture (from
 * scripts/demos/signals_prep.py): blurring `original` with the causal length-n moving-average
 * Toeplitz matrix must match `blurred`, deblurring `blurred` back via forward substitution must
 * match `deblurred` (and hence `original`), and the frequency response must match `freqz`.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { blurImage, deblurImage, freqzMA } from "@/demos/signals/deblur/model";

interface Fixture {
  n: number;
  rows: number;
  cols: number;
  trueN: number;
  original: number[][];
  blurred: number[][];
  deblurred: number[][];
  freqz: { w: number[]; mag: number[] };
}

const fx = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", "signals-lab3.json"), "utf8"),
) as Fixture;

function maxAbsDiff(a: readonly ArrayLike<number>[], b: readonly number[][]): number {
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[i].length; j++) {
      worst = Math.max(worst, Math.abs(a[i][j] - b[i][j]));
    }
  }
  return worst;
}

describe("deblur model against the SciPy fixture", () => {
  it("loads the fixture's shape and true N (sanity)", () => {
    expect(fx.original.length).toBe(fx.rows);
    expect(fx.original[0].length).toBe(fx.cols);
    expect(fx.trueN).toBe(464);
  });

  it("blurs `original` to match `blurred` within 1e-9", () => {
    const got = blurImage(fx.original, fx.n);
    expect(maxAbsDiff(got, fx.blurred)).toBeLessThan(1e-9);
  });

  it("deblurs `blurred` back to match `deblurred` (and hence `original`) within 1e-9", () => {
    const got = deblurImage(fx.blurred, fx.n);
    expect(maxAbsDiff(got, fx.deblurred)).toBeLessThan(1e-9);
    expect(maxAbsDiff(got, fx.original)).toBeLessThan(1e-9);
  });

  it("round-trips: deblurring blurImage(original) also matches original within 1e-9", () => {
    const blurred = blurImage(fx.original, fx.n);
    const recovered = deblurImage(blurred, fx.n);
    expect(maxAbsDiff(recovered, fx.original)).toBeLessThan(1e-9);
  });

  it("computes freqz.mag within 1e-9", () => {
    const { w, mag } = freqzMA(fx.n, fx.freqz.w.length);
    for (let i = 0; i < w.length; i++) {
      expect(Math.abs(w[i] - fx.freqz.w[i])).toBeLessThan(1e-9);
      expect(Math.abs(mag[i] - fx.freqz.mag[i])).toBeLessThan(1e-9);
    }
  });
});
