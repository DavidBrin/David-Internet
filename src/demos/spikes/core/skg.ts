/**
 * Skewed-gaussian spike model — port of spikeparam.skg.fit.sim_gaussian_spike
 * built on neurodsp's sim_skewed_gaussian_cycle (gaussian × skew-normal CDF,
 * renormalized to unit height).
 */

/** Abramowitz & Stegun 7.1.26 erf approximation (|err| < 1.5e-7). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** neurodsp sim_gaussian_cycle over n samples (xs = linspace(0,1,n)). */
export function simGaussianCycle(n: number, std: number, center: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : i / (n - 1);
    out[i] = Math.exp(-((x - center) ** 2) / (2 * std * std));
  }
  return out;
}

/** neurodsp sim_skewed_gaussian_cycle (height = 1). */
export function simSkewedGaussianCycle(n: number, center: number, std: number, alpha: number): Float64Array {
  const cycle = simGaussianCycle(n, std, center);
  let max = 0;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? -1 : -1 + (2 * i) / (n - 1);
    const cdf = normCdf((alpha * (t - (center * 2 - 1))) / std);
    out[i] = cycle[i] * cdf;
    if (out[i] > max) max = out[i];
  }
  if (max > 0) for (let i = 0; i < n; i++) out[i] /= max;
  return out;
}

export interface SkgParams {
  aCtr: number; aStd: number; aAlpha: number; aScale: number;
  bCtr: number; bStd: number; bAlpha: number; bScale: number;
  scale: number; offset: number;
}

export function skgFromArray(p: ArrayLike<number>): SkgParams {
  return {
    aCtr: p[0] as number, aStd: p[1] as number, aAlpha: p[2] as number, aScale: p[3] as number,
    bCtr: p[4] as number, bStd: p[5] as number, bAlpha: p[6] as number, bScale: p[7] as number,
    scale: p[8] as number, offset: p[9] as number,
  };
}

/** sim_gaussian_spike: sum of two skewed gaussians, scaled and offset. */
export function simGaussianSpike(n: number, p: SkgParams): { total: Float64Array; a: Float64Array; b: Float64Array } {
  const ga = simSkewedGaussianCycle(n, p.aCtr, p.aStd, p.aAlpha);
  const gb = simSkewedGaussianCycle(n, p.bCtr, p.bStd, p.bAlpha);
  const a = new Float64Array(n);
  const b = new Float64Array(n);
  const total = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    a[i] = ga[i] * p.aScale * p.scale + p.offset / 2;
    b[i] = gb[i] * p.bScale * p.scale + p.offset / 2;
    total[i] = a[i] + b[i];
  }
  return { total, a, b };
}
