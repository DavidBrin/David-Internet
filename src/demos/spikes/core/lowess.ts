/**
 * LOWESS — port of statsmodels.nonparametric.lowess as spikeparam's
 * diff_spike calls it: local linear fits with tricube weights, `it`
 * robustifying reweightings, delta = 0 (fit at every point), x already sorted.
 *
 * Used to smooth the spike derivative before control-point detection;
 * verified against the Python pipeline through the control-point fixtures.
 */

export function lowess(y: ArrayLike<number>, x: ArrayLike<number>, frac: number, it = 3): Float64Array {
  const n = y.length;
  const k = Math.max(2, Math.floor(frac * n + 1e-10));
  const out = new Float64Array(n);
  const robWeights = new Float64Array(n).fill(1);

  for (let iter = 0; iter <= it; iter++) {
    let left = 0;
    let right = k - 1;
    for (let i = 0; i < n; i++) {
      const xi = x[i] as number;
      // advance the k-point window to the nearest neighbors of xi
      while (right < n - 1 && (x[right + 1] as number) - xi < xi - (x[left] as number)) {
        left += 1;
        right += 1;
      }
      const radius = Math.max(xi - (x[left] as number), (x[right] as number) - xi);
      // weighted linear regression over the window
      let sw = 0, swx = 0, swy = 0, swxx = 0, swxy = 0;
      for (let j = left; j <= right; j++) {
        const d = Math.abs((x[j] as number) - xi);
        let w: number;
        if (radius <= 0) {
          w = 1;
        } else {
          const u = d / radius;
          if (u >= 1) {
            w = 0;
          } else {
            const t = 1 - u * u * u;
            w = t * t * t;
          }
        }
        w *= robWeights[j];
        if (w <= 0) continue;
        const xj = x[j] as number;
        const yj = y[j] as number;
        sw += w;
        swx += w * xj;
        swy += w * yj;
        swxx += w * xj * xj;
        swxy += w * xj * yj;
      }
      const denom = sw * swxx - swx * swx;
      if (sw <= 0) {
        out[i] = y[i] as number;
      } else if (Math.abs(denom) < 1e-300) {
        out[i] = swy / sw;
      } else {
        const slope = (sw * swxy - swx * swy) / denom;
        const intercept = (swy - slope * swx) / sw;
        out[i] = intercept + slope * xi;
      }
    }
    if (iter === it) break;
    // robustifying weights from residuals
    const absRes = new Float64Array(n);
    for (let i = 0; i < n; i++) absRes[i] = Math.abs((y[i] as number) - out[i]);
    const sorted = Array.from(absRes).sort((a, b) => a - b);
    const s =
      n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    if (s <= 0) {
      robWeights.fill(1);
      continue;
    }
    for (let i = 0; i < n; i++) {
      const r = Math.min(1, Math.max(-1, ((y[i] as number) - out[i]) / (6 * s)));
      const t = 1 - r * r;
      robWeights[i] = t * t;
    }
  }
  return out;
}
