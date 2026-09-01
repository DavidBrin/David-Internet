/**
 * Small stats / scale / color helpers for the population panel. No dependencies (no d3) —
 * hand-rolled percentile, quartiles, Pearson correlation, a coolwarm-ish diverging colormap,
 * a categorical palette, and a deterministic per-index jitter source.
 */

/** Linear-interpolated percentile (0..100) over an ascending-sorted array. */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

export interface Quartiles {
  q1: number;
  median: number;
  q3: number;
}

/** Sorts a copy of `values` and returns Q1/median/Q3. */
export function quartiles(values: number[]): Quartiles {
  const s = [...values].sort((a, b) => a - b);
  return { q1: percentile(s, 25), median: percentile(s, 50), q3: percentile(s, 75) };
}

/** Pearson correlation coefficient over paired samples; NaN if undefined (n<2 or zero variance). */
export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return NaN;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return NaN;
  return cov / Math.sqrt(vx * vy);
}

/** coolwarm-ish diverging colormap: blue (-1) -> white (0) -> red (+1). */
export function coolwarm(t: number): string {
  const c = Math.max(-1, Math.min(1, isFinite(t) ? t : 0));
  const blue: [number, number, number] = [33, 102, 172];
  const white: [number, number, number] = [247, 247, 247];
  const red: [number, number, number] = [178, 24, 43];
  const [a, b, f] = c <= 0 ? [blue, white, c + 1] : [white, red, c];
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bch = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgb(${r},${g},${bch})`;
}

/** Qualitative categorical palette — accent (#F59E0B) first, then a warm/cool spread. */
export const CATEGORICAL_PALETTE = [
  "#F59E0B",
  "#2563EB",
  "#DC2626",
  "#059669",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#65A30D",
  "#EA580C",
  "#4338CA",
  "#0D9488",
  "#B91C1C",
];

/** "Nice" round-number tick step, evenly spaced in a linear domain. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!isFinite(min) || !isFinite(max) || min === max) return isFinite(min) ? [min] : [];
  const span = max - min;
  const rawStep = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step: number;
  if (norm < 1.5) step = mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-6; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

/** Adaptive fixed-point formatting for axis labels / cell values. */
export function formatNum(v: number): string {
  if (!isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a === 0) return "0";
  if (a >= 1000) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(3);
  return v.toExponential(1);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Value -> [0,1] within a domain (optionally log10, floored at 1e-6 to stay finite). */
export function makeScale(domain: [number, number], log: boolean): (v: number) => number {
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  return (v: number) => {
    const val = log ? Math.log10(Math.max(v, 1e-6)) : v;
    return clamp01((val - lo) / span);
  };
}

/** Deterministic pseudo-random value in [0,1) from an integer seed — used for boxplot jitter. */
export function hash01(i: number): number {
  let x = (i ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}
