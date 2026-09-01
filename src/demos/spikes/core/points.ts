/**
 * Control points — port of spikeparam.patch.points: LOWESS-smoothed
 * derivative, inflection via the intersection of two line fits, peak
 * mid-points, and the exponential-decay window.
 */
import { lowess } from "./lowess";

export interface ControlIndices {
  rampStart: number;
  inflection: number;
  rise: number;
  peak: number;
  decay: number;
  expStart: number;
  expEnd: number;
}

/** np.polyfit(x, y, 1) — ordinary least squares line, returns [slope, intercept]. */
export function polyfit1(x: ArrayLike<number>, y: ArrayLike<number>): [number, number] {
  const n = x.length;
  if (n < 2) throw new Error("polyfit needs >= 2 points");
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i] as number;
    const yi = y[i] as number;
    sx += xi; sy += yi; sxx += xi * xi; sxy += xi * yi;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-300) throw new Error("singular polyfit");
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return [slope, intercept];
}

function stdPop(arr: ArrayLike<number>, lo: number, hi: number): number {
  const n = hi - lo;
  if (n <= 0) return 0;
  let mean = 0;
  for (let i = lo; i < hi; i++) mean += arr[i] as number;
  mean /= n;
  let s = 0;
  for (let i = lo; i < hi; i++) {
    const d = (arr[i] as number) - mean;
    s += d * d;
  }
  return Math.sqrt(s / n);
}

/** diff_spike: smoothed derivative of a spike (lowess of np.diff over times[1:]). */
export function diffSpike(spike: ArrayLike<number>, fs: number, smoothFrac = 0.008): Float64Array {
  const n = spike.length;
  const dy = new Float64Array(n - 1);
  const dx = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    dy[i] = (spike[i + 1] as number) - (spike[i] as number);
    dx[i] = (i + 1) / fs;
  }
  return lowess(dy, dx, smoothFrac, 3);
}

/** inflection(): returns [idx_ramp_start, idx_inflection]. */
export function inflectionPoints(
  d: Float64Array,
  fs: number,
  peakInd: number,
  prePeakMs: [number, number] = [-4, -1],
  preInflectionMs = 1,
): [number, number] {
  const oneMs = Math.trunc(fs / 1000);

  let dPeakInd = peakInd - oneMs;
  {
    const lo = Math.max(0, peakInd - oneMs);
    const hi = Math.min(d.length, peakInd + oneMs);
    if (hi <= lo) throw new Error("empty derivative window");
    let best = lo;
    for (let i = lo + 1; i < hi; i++) if (d[i] > d[best]) best = i;
    dPeakInd = best;
  }

  // rising half-max of derivative: first reversed index where d <= std(d[:dPeakInd])
  const sd = stdPop(d, 0, dPeakInd);
  let found = -1;
  for (let j = dPeakInd - 1; j >= 0; j--) {
    if (d[j] <= sd) {
      found = dPeakInd - 1 - j; // position in the reversed array
      break;
    }
  }
  let indRise = found === -1 ? 1 : found + 1;
  indRise = dPeakInd - indRise;

  let startRamp = Math.trunc(dPeakInd + prePeakMs[0] * oneMs);
  let endRamp = Math.trunc(dPeakInd + prePeakMs[1] * oneMs);
  if (startRamp < 0) startRamp = 0;
  if (endRamp > indRise) endRamp = indRise;

  const xs0: number[] = [];
  const ys0: number[] = [];
  for (let i = startRamp; i < endRamp; i++) { xs0.push(i); ys0.push(d[i]); }
  const xs1: number[] = [];
  const ys1: number[] = [];
  for (let i = indRise; i < dPeakInd; i++) { xs1.push(i); ys1.push(d[i]); }
  const p0 = polyfit1(xs0, ys0);
  const p1 = polyfit1(xs1, ys1);

  // root of (p0 - p1): (a0-a1)x + (b0-b1) = 0
  const da = p0[0] - p1[0];
  const db = p0[1] - p1[1];
  if (Math.abs(da) < 1e-300) throw new Error("parallel line fits");
  const idxInflection = Math.trunc(-db / da);

  let idxRampStart = idxInflection - Math.trunc(preInflectionMs * oneMs);
  if (idxRampStart < 0) idxRampStart = 0;
  return [idxRampStart, idxInflection];
}

/** control_points(): the seven indices, exactly as spikeparam computes them. */
export function controlPoints(
  spike: ArrayLike<number>,
  fs: number,
  opts: {
    prePeakMs?: [number, number];
    preInflectionMs?: number;
    smoothFrac?: number;
    expShiftRight?: number;
    expDuration?: number;
    peakInd?: number;
  } = {},
): { indices: ControlIndices; dSmoothed: Float64Array } {
  const prePeakMs = opts.prePeakMs ?? [-4, -1];
  const preInflectionMs = opts.preInflectionMs ?? 1;
  const smoothFrac = opts.smoothFrac ?? 0.008;
  const expShiftRight = opts.expShiftRight ?? 2;
  const expDuration = opts.expDuration ?? 5;

  const d = diffSpike(spike, fs, smoothFrac);

  let idxPeak: number;
  if (opts.peakInd != null) {
    idxPeak = opts.peakInd;
  } else {
    idxPeak = 0;
    for (let i = 1; i < spike.length; i++) if ((spike[i] as number) > (spike[idxPeak] as number)) idxPeak = i;
  }

  const [idxRampStart, idxInflection] = inflectionPoints(d, fs, idxPeak, prePeakMs, preInflectionMs);

  const midAmp = ((spike[idxInflection] as number) + (spike[idxPeak] as number)) / 2;

  // rise: first index (scanning back from the peak) where spike - midAmp <= 0
  let riseOff = -1;
  for (let j = Math.trunc(idxPeak) - 1; j >= 0; j--) {
    if ((spike[j] as number) - midAmp <= 0) {
      riseOff = Math.trunc(idxPeak) - 1 - j;
      break;
    }
  }
  if (riseOff === -1) throw new Error("no rise midpoint");
  const idxRise = idxPeak - riseOff;

  let decayOff = -1;
  for (let j = Math.trunc(idxPeak); j < spike.length; j++) {
    if ((spike[j] as number) - midAmp <= 0) {
      decayOff = j - Math.trunc(idxPeak);
      break;
    }
  }
  if (decayOff === -1) throw new Error("no decay midpoint");
  const idxDecay = idxPeak + decayOff;

  const oneMs = Math.trunc(fs / 1000);
  const decayCurveShift = Math.trunc(oneMs / expShiftRight);
  const decayCurveFloor = Math.trunc(oneMs * expDuration);
  const idxExpStart = idxPeak + decayCurveShift;
  let idxExpEnd = idxExpStart + decayCurveFloor;
  if (idxExpEnd > spike.length) idxExpEnd = spike.length - 1;

  return {
    indices: {
      rampStart: idxRampStart,
      inflection: idxInflection,
      rise: idxRise,
      peak: idxPeak,
      decay: idxDecay,
      expStart: idxExpStart,
      expEnd: idxExpEnd,
    },
    dSmoothed: d,
  };
}
