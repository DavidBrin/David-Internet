/**
 * Spike detection + windowing — ports of spikeparam.patch.window
 * (`find_spike_times` via scipy.signal.find_peaks, `window_spike`) plus the
 * peak re-centering / dedup step from Spike.fit.
 */

/** Python/numpy slice semantics: sig[a:b] with negative wrap + clamping. */
function pySlice(n: number, a: number, b: number): [number, number] {
  let lo = a < 0 ? n + a : a;
  let hi = b < 0 ? n + b : b;
  lo = Math.min(Math.max(lo, 0), n);
  hi = Math.min(Math.max(hi, 0), n);
  return [lo, Math.max(lo, hi)];
}

/**
 * scipy.signal.find_peaks(sig, height=..., distance=...): plateau-aware local
 * maxima, height filter, then greedy distance filter from tallest down.
 */
export function findPeaks(sig: ArrayLike<number>, height: number, distance: number): number[] {
  const n = sig.length;
  const midpoints: number[] = [];
  let i = 1;
  const iMax = n - 1;
  while (i < iMax) {
    if ((sig[i - 1] as number) < (sig[i] as number)) {
      let iAhead = i + 1;
      while (iAhead < iMax && (sig[iAhead] as number) === (sig[i] as number)) iAhead += 1;
      if ((sig[iAhead] as number) < (sig[i] as number)) {
        const leftEdge = i;
        const rightEdge = iAhead - 1;
        midpoints.push(Math.floor((leftEdge + rightEdge) / 2));
        i = iAhead;
      }
    }
    i += 1;
  }
  let peaks = midpoints.filter((p) => (sig[p] as number) >= height);
  if (distance > 1 && peaks.length > 1) {
    const dist = Math.ceil(distance);
    const order = peaks
      .map((p, idx) => ({ p, idx, h: sig[p] as number }))
      .sort((a, b) => a.h - b.h || a.idx - b.idx); // ascending; process from tallest
    const keep = new Array(peaks.length).fill(true);
    for (let oi = order.length - 1; oi >= 0; oi--) {
      const { idx } = order[oi];
      if (!keep[idx]) continue;
      let k = idx - 1;
      while (k >= 0 && peaks[idx] - peaks[k] < dist) {
        keep[k] = false;
        k -= 1;
      }
      k = idx + 1;
      while (k < peaks.length && peaks[k] - peaks[idx] < dist) {
        keep[k] = false;
        k += 1;
      }
    }
    peaks = peaks.filter((_, idx) => keep[idx]);
  }
  return peaks;
}

/**
 * The detection flow of Spike.fit: find_peaks → re-center each peak on the
 * true argmax within ±pad/2 → drop duplicates (keep first).
 */
export function detectSpikes(
  sig: ArrayLike<number>,
  fs: number,
  threshAmp: number,
  threshMs: number,
  windowLength: [number, number],
): number[] {
  const inds = findPeaks(sig, threshAmp, threshMs * 1000);
  let pad = Math.floor((windowLength[0] + windowLength[1]) * fs / 1000) + 1;
  pad = Math.floor(pad / 5);
  const half = Math.floor(pad / 2);
  const n = sig.length;
  const recentered = inds.map((ind) => {
    const [lo, hi] = pySlice(n, ind - half, ind + half);
    if (hi <= lo) throw new Error("empty argmax window");
    let best = lo;
    for (let j = lo + 1; j < hi; j++) if ((sig[j] as number) > (sig[best] as number)) best = j;
    return ind - half + (best - lo);
  });
  const seen = new Set<number>();
  const unique: number[] = [];
  for (const v of recentered) {
    if (!seen.has(v)) {
      seen.add(v);
      unique.push(v);
    }
  }
  return unique;
}

export interface Windowed {
  spikes: Float64Array[];
  /** Which input indices survived the full-window check. */
  keptInds: number[];
}

/** window_spike: ±window_length ms around each peak (skips clipped windows). */
export function windowSpikes(
  sig: ArrayLike<number>,
  fs: number,
  spikeInds: number[],
  windowLength: [number, number] = [10, 10],
): Windowed {
  const nSamples = fs / 1000;
  const pre = nSamples * windowLength[0];
  const post = nSamples * windowLength[1];
  const spikes: Float64Array[] = [];
  const keptInds: number[] = [];
  for (const ind of spikeInds) {
    const a = Math.trunc(ind - pre);
    const b = Math.trunc(ind + post) + 1;
    if (a < 0 || b > sig.length) continue;
    const w = new Float64Array(b - a);
    for (let j = a; j < b; j++) w[j - a] = sig[j] as number;
    spikes.push(w);
    keptInds.push(ind);
  }
  return { spikes, keptInds };
}
