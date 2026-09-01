/**
 * TypeScript port of FOOOF 1.1 (fooof / specparam, Voytek Lab) — the exact
 * algorithm the project's notebooks ran, with the same defaults the notebooks
 * used (`set_fm_array`: min_peak_height=0.6, peak_width_limits=(4,15),
 * peak_threshold=0.6, freq_range [2,50], modes "fixed" and "knee").
 *
 * Mirrors fooof.objs.fit.FOOOF.fit():
 *   robust aperiodic fit → flatten → iterative gaussian peak search →
 *   joint gaussian refit → final aperiodic fit on the peak-removed spectrum.
 *
 * Verified against fooof-generated fixtures (tests/organoids-core.test.ts).
 */
import { lmFit } from "./lm";

export type AperiodicMode = "fixed" | "knee";

export interface SpecparamSettings {
  peakWidthLimits: [number, number];
  maxNPeaks: number;
  minPeakHeight: number;
  peakThreshold: number;
  aperiodicMode: AperiodicMode;
}

export const PROJECT_SETTINGS: Omit<SpecparamSettings, "aperiodicMode"> = {
  peakWidthLimits: [4, 15],
  maxNPeaks: Infinity,
  minPeakHeight: 0.6,
  peakThreshold: 0.6,
};

export interface SpecparamResult {
  /** [offset, exponent] (fixed) or [offset, knee, exponent] (knee). */
  aperiodic: number[];
  /** Gaussian params rows [ctr, height, std]. */
  gaussians: number[][];
  /** Peak params rows [CF, PW, BW]. */
  peaks: number[][];
  rSquared: number;
  /** MAE in log10 power. */
  error: number;
  /** Trimmed frequency axis. */
  freqs: number[];
  /** log10 power spectrum (trimmed). */
  logPower: number[];
  /** Full model in log10 space. */
  model: number[];
  /** Aperiodic component in log10 space. */
  apFit: number[];
  /** Flattened spectrum (logPower - apFit). */
  flat: number[];
}

const AP_PERCENTILE_THRESH = 0.025; // percentile (in %), as in FOOOF
const BW_STD_EDGE = 1.0;
const GAUSS_OVERLAP_THRESH = 0.75;
const CF_BOUND = 1.5;

function apModel(mode: AperiodicMode, freqs: number[], p: number[], out: Float64Array): void {
  if (mode === "fixed") {
    const [offset, exp] = p;
    for (let i = 0; i < freqs.length; i++) out[i] = offset - Math.log10(Math.pow(freqs[i], exp));
  } else {
    const [offset, knee, exp] = p;
    for (let i = 0; i < freqs.length; i++) {
      const v = knee + Math.pow(freqs[i], exp);
      out[i] = offset - Math.log10(v > 0 ? v : 1e-300);
    }
  }
}

function gaussianModel(freqs: number[], params: number[], out: Float64Array): void {
  out.fill(0);
  for (let g = 0; g + 2 < params.length + 1; g += 3) {
    const ctr = params[g];
    const hgt = params[g + 1];
    const wid = params[g + 2];
    for (let i = 0; i < freqs.length; i++) {
      const d = freqs[i] - ctr;
      out[i] += hgt * Math.exp((-d * d) / (2 * wid * wid));
    }
  }
}

/** np.percentile with linear interpolation. */
function percentile(values: number[], q: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const pos = (q / 100) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function std(values: ArrayLike<number>): number {
  const n = values.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += values[i] as number;
  mean /= n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = (values[i] as number) - mean;
    s += d * d;
  }
  return Math.sqrt(s / n);
}

function simpleApFit(
  mode: AperiodicMode,
  freqs: number[],
  logPower: ArrayLike<number>,
  guessIn?: number[],
): number[] {
  const offGuess = logPower[0] as number;
  const expGuess = Math.abs(
    ((logPower[logPower.length - 1] as number) - (logPower[0] as number)) /
      (Math.log10(freqs[freqs.length - 1]) - Math.log10(freqs[0])),
  );
  const guess = guessIn ?? (mode === "knee" ? [offGuess, 0, expGuess] : [offGuess, expGuess]);
  return lmFit((p, out) => apModel(mode, freqs, p, out), logPower, guess, { maxIter: 300 });
}

function robustApFit(mode: AperiodicMode, freqs: number[], logPower: number[]): number[] {
  const popt = simpleApFit(mode, freqs, logPower);
  const initial = new Float64Array(freqs.length);
  apModel(mode, freqs, popt, initial);
  const flat = logPower.map((v, i) => Math.max(0, v - initial[i]));
  const thresh = percentile(flat, AP_PERCENTILE_THRESH);
  const fIgn: number[] = [];
  const pIgn: number[] = [];
  for (let i = 0; i < flat.length; i++) {
    if (flat[i] <= thresh) {
      fIgn.push(freqs[i]);
      pIgn.push(logPower[i]);
    }
  }
  return lmFit((p, out) => apModel(mode, fIgn, p, out), pIgn, popt, { maxIter: 300 });
}

export function fitSpecparam(
  freqsIn: ArrayLike<number>,
  powerIn: ArrayLike<number>,
  freqRange: [number, number],
  settings: SpecparamSettings,
): SpecparamResult {
  // trim + log, as FOOOF.add_data does
  const freqs: number[] = [];
  const logPower: number[] = [];
  for (let i = 0; i < freqsIn.length; i++) {
    const f = freqsIn[i] as number;
    if (f >= freqRange[0] && f <= freqRange[1]) {
      freqs.push(f);
      logPower.push(Math.log10(powerIn[i] as number));
    }
  }
  const n = freqs.length;
  const freqRes = freqs[1] - freqs[0];
  const stdLimits: [number, number] = [settings.peakWidthLimits[0] / 2, settings.peakWidthLimits[1] / 2];
  const mode = settings.aperiodicMode;

  // 1. robust aperiodic fit + flatten
  let apParams = robustApFit(mode, freqs, logPower);
  const apFitArr = new Float64Array(n);
  apModel(mode, freqs, apParams, apFitArr);
  let flatIter = logPower.map((v, i) => v - apFitArr[i]);
  const flatSpec = flatIter.slice();

  // 2. iterative peak search (on a copy that gets peaks subtracted)
  const guesses: number[][] = [];
  while (guesses.length < settings.maxNPeaks) {
    let maxInd = 0;
    for (let i = 1; i < n; i++) if (flatIter[i] > flatIter[maxInd]) maxInd = i;
    const maxHeight = flatIter[maxInd];
    if (maxHeight <= settings.peakThreshold * std(flatIter)) break;
    const guessFreq = freqs[maxInd];
    const guessHeight = maxHeight;
    if (!(guessHeight > settings.minPeakHeight)) break;

    // data-driven std guess from the shortest half-height side
    const half = 0.5 * maxHeight;
    let le: number | null = null;
    for (let v = maxInd - 1; v > 0; v--) if (flatIter[v] <= half) { le = v; break; }
    let ri: number | null = null;
    for (let v = maxInd + 1; v < n; v++) if (flatIter[v] <= half) { ri = v; break; }
    let guessStd: number;
    const sides = [le, ri].filter((v): v is number => v !== null).map((v) => Math.abs(v - maxInd));
    if (sides.length > 0) {
      const fwhm = Math.min(...sides) * 2 * freqRes;
      guessStd = fwhm / (2 * Math.sqrt(2 * Math.log(2)));
    } else {
      guessStd = (settings.peakWidthLimits[0] + settings.peakWidthLimits[1]) / 2;
    }
    if (guessStd < stdLimits[0]) guessStd = stdLimits[0];
    if (guessStd > stdLimits[1]) guessStd = stdLimits[1];

    guesses.push([guessFreq, guessHeight, guessStd]);
    for (let i = 0; i < n; i++) {
      const d = freqs[i] - guessFreq;
      flatIter[i] -= guessHeight * Math.exp((-d * d) / (2 * guessStd * guessStd));
    }
  }

  // 3. drop edge + overlap violations
  let kept = guesses.filter((g) => {
    const bw = g[2] * BW_STD_EDGE;
    return Math.abs(g[0] - freqRange[0]) > bw && Math.abs(g[0] - freqRange[1]) > bw;
  });
  kept = kept.slice().sort((a, b) => a[0] - b[0]);
  if (kept.length > 1) {
    const bounds = kept.map((g) => [g[0] - g[2] * GAUSS_OVERLAP_THRESH, g[0] + g[2] * GAUSS_OVERLAP_THRESH]);
    const drop = new Set<number>();
    for (let i = 0; i < bounds.length - 1; i++) {
      if (bounds[i][1] > bounds[i + 1][0]) {
        drop.add(kept[i][1] < kept[i + 1][1] ? i : i + 1);
      }
    }
    kept = kept.filter((_, i) => !drop.has(i));
  }

  // 4. joint gaussian refit against the flattened spectrum
  let gaussians: number[][] = [];
  if (kept.length > 0) {
    const p0: number[] = [];
    const lower: number[] = [];
    const upper: number[] = [];
    for (const g of kept) {
      p0.push(g[0], g[1], g[2]);
      lower.push(Math.max(freqRange[0], g[0] - 2 * CF_BOUND * g[2]), 0, stdLimits[0]);
      upper.push(Math.min(freqRange[1], g[0] + 2 * CF_BOUND * g[2]), Infinity, stdLimits[1]);
    }
    const fitted = lmFit(
      (p, out) => gaussianModel(freqs, p, out),
      flatSpec,
      p0,
      { lower, upper, maxIter: 400 },
    );
    for (let g = 0; g < fitted.length; g += 3) gaussians.push([fitted[g], fitted[g + 1], fitted[g + 2]]);
    gaussians.sort((a, b) => a[0] - b[0]);
  }

  // 5. peak fit array; final aperiodic refit on peak-removed spectrum
  const peakFit = new Float64Array(n);
  gaussianModel(freqs, gaussians.flat(), peakFit);
  const peakRm = logPower.map((v, i) => v - peakFit[i]);
  apParams = simpleApFit(mode, freqs, peakRm, apParams);
  apModel(mode, freqs, apParams, apFitArr);
  const flat = logPower.map((v, i) => v - apFitArr[i]);
  const model = Array.from(peakFit, (v, i) => v + apFitArr[i]);

  // peak params [CF, PW, BW]
  const peaks = gaussians.map((g) => {
    let ind = 0;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(freqs[i] - g[0]);
      if (d < best) { best = d; ind = i; }
    }
    return [g[0], model[ind] - apFitArr[ind], g[2] * 2];
  });

  // r² + MAE
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += logPower[i]; my += model[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0, mae = 0;
  for (let i = 0; i < n; i++) {
    const dx = logPower[i] - mx;
    const dy = model[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    mae += Math.abs(logPower[i] - model[i]);
  }
  const r = sxy / Math.sqrt(sxx * syy);

  return {
    aperiodic: apParams,
    gaussians,
    peaks,
    rSquared: r * r,
    error: mae / n,
    freqs,
    logPower,
    model,
    apFit: Array.from(apFitArr),
    flat,
  };
}
