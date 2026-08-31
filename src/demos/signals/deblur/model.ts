/**
 * Lab 3 — deblurring model. The lab's mystery image was blurred by a horizontal, causal,
 * length-N moving average: each row y = H*x with H the L x L lower-triangular banded Toeplitz
 * matrix h[k] = 1/N for k = 0..N-1 (i.e. y[j] = (1/N) * sum_{i=0..N-1} x[j-i], terms with
 * j-i < 0 simply absent — H has no wraparound). Deblurring is forward substitution on that
 * same triangular system, row by row. True blur length for the shipped lab image: N = 464,
 * the unique length whose inverse lands every pixel back in [0,1]. Ported from deblur.m, but
 * corrected: deblur.m used MATLAB's one-argument toeplitz(), which builds a SYMMETRIC matrix,
 * while the lab's own blur equation is causal — that mismatch is why David's original
 * reconstructions kept faint ghosts.
 *
 * Pure, array-in/array-out: no DOM, no canvas. Rows are plain number[] (or Float64Array),
 * pixel values in [0,1].
 */

export type Row = ArrayLike<number>;

/** Causal length-N moving-average blur of a single row: y[j] = (1/N) * sum_{i=0}^{min(N,j+1)-1} x[j-i]. */
export function blurRow(x: Row, N: number): Float64Array {
  const L = x.length;
  const out = new Float64Array(L);
  for (let j = 0; j < L; j++) {
    let s = 0;
    const iMax = Math.min(N, j + 1) - 1; // i = 0..iMax
    for (let i = 0; i <= iMax; i++) s += x[j - i];
    out[j] = s / N;
  }
  return out;
}

/** Blur every row of an image (array of rows) with blurRow. */
export function blurImage(rows: readonly Row[], N: number): Float64Array[] {
  return rows.map((row) => blurRow(row, N));
}

/**
 * Deblur a single row: forward substitution on y = H*x, H lower-triangular banded Toeplitz
 * with h[k] = 1/N, k = 0..N-1. Since y[j] = (1/N)*(x[j] + sum_{i=1}^{min(N,j+1)-1} x[j-i]),
 * x[j] = N*y[j] - sum_{i=1}^{min(N,j+1)-1} x[j-i]. O(L*N) per row.
 */
export function deblurRow(y: Row, N: number): Float64Array {
  const L = y.length;
  const x = new Float64Array(L);
  for (let j = 0; j < L; j++) {
    let s = 0;
    const iMax = Math.min(N, j + 1) - 1; // i = 1..iMax
    for (let i = 1; i <= iMax; i++) s += x[j - i];
    x[j] = N * y[j] - s;
  }
  return x;
}

/** Deblur every row of an image with deblurRow. */
export function deblurImage(rows: readonly Row[], N: number): Float64Array[] {
  return rows.map((row) => deblurRow(row, N));
}

/**
 * Deblur a single row incrementally, resuming from a given row of an in-progress solve
 * (forward substitution only ever looks left/back within the row, so rows are independent —
 * this lets the panel sweep the animation down the image without recomputing finished rows).
 * Returns the same array `x` mutated in place, for convenience when animating.
 */
export function deblurRowInto(y: Row, N: number, x: Float64Array): Float64Array {
  const L = y.length;
  for (let j = 0; j < L; j++) {
    let s = 0;
    const iMax = Math.min(N, j + 1) - 1;
    for (let i = 1; i <= iMax; i++) s += x[j - i];
    x[j] = N * y[j] - s;
  }
  return x;
}

/** Clamp values to [0,1] (for display / checking whether an inverse "worked"). */
export function clamp01(x: Row): Float64Array {
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = Math.max(0, Math.min(1, x[i]));
  return out;
}

/** Fraction of samples that land outside [0,1] before clamping — a proxy for "did N recover a
 * plausible image", used to find the true blur length by search. */
export function outOfRangeFraction(rows: readonly Row[]): number {
  let bad = 0;
  let total = 0;
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      total++;
      if (row[i] < 0 || row[i] > 1) bad++;
    }
  }
  return total === 0 ? 0 : bad / total;
}

export interface Freqz {
  w: Float64Array;
  mag: Float64Array;
}

/**
 * |H(e^jw)| for the length-N causal moving average, at `count` points evenly spaced over
 * [0, 2*pi) (w[m] = 2*pi*m/count). H(e^jw) = (1/N) * sum_{k=0}^{N-1} e^{-j*w*k}.
 */
export function freqzMA(N: number, count = 64): Freqz {
  const w = new Float64Array(count);
  const mag = new Float64Array(count);
  for (let m = 0; m < count; m++) {
    const wm = (2 * Math.PI * m) / count;
    w[m] = wm;
    let re = 0;
    let im = 0;
    for (let k = 0; k < N; k++) {
      re += Math.cos(-wm * k);
      im += Math.sin(-wm * k);
    }
    mag[m] = Math.sqrt(re * re + im * im) / N;
  }
  return { w, mag };
}

/** Null frequencies of the length-N MA's response within [0, 2*pi): omega = 2*pi*k/N, k=1..N-1. */
export function freqzNulls(N: number): Float64Array {
  const out = new Float64Array(Math.max(0, N - 1));
  for (let k = 1; k < N; k++) out[k - 1] = (2 * Math.PI * k) / N;
  return out;
}

/** Simple seeded PRNG (mulberry32) so noise is reproducible without relying on Math.random. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller standard normal generator built on a uniform() source in [0,1). */
export function gaussianSource(uniform: () => number): () => number {
  let spare: number | null = null;
  return function () {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = uniform();
    while (v === 0) v = uniform();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
}

/**
 * Lab 3 Problem 2 — the two first-order recursive systems: y[n] - 0.8*y[n-1] = x[n] (System 1,
 * lowpass, pole at z=+0.8) and y[n] + 0.8*y[n-1] = x[n] (System 2, highpass, pole at z=-0.8,
 * impulse response alternates sign). Both are H(z) = 1/(1 - pole*z^-1) with pole = +-0.8.
 */

/** Impulse response h[n] = pole^n, n = 0..length-1, of H(z) = 1/(1 - pole*z^-1). */
export function firstOrderImpulse(pole: number, length: number): Float64Array {
  const out = new Float64Array(length);
  let v = 1;
  for (let n = 0; n < length; n++) {
    out[n] = v;
    v *= pole;
  }
  return out;
}

/** |H(e^jw)| = 1/|1 - pole*e^-jw| at the given frequencies, for H(z) = 1/(1 - pole*z^-1). */
export function firstOrderFreqzMag(pole: number, w: ArrayLike<number>): Float64Array {
  const out = new Float64Array(w.length);
  for (let i = 0; i < w.length; i++) {
    const wi = w[i];
    const re = 1 - pole * Math.cos(wi);
    const im = pole * Math.sin(wi);
    out[i] = 1 / Math.sqrt(re * re + im * im);
  }
  return out;
}

/** Add fixed-seed Gaussian noise (std sigma) to every row of an image, returning a new array. */
export function addNoise(rows: readonly Row[], sigma: number, seed = 20240): Float64Array[] {
  const gauss = gaussianSource(mulberry32(seed));
  return rows.map((row) => {
    const out = new Float64Array(row.length);
    for (let i = 0; i < row.length; i++) out[i] = row[i] + sigma * gauss();
    return out;
  });
}
