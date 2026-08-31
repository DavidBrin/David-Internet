/**
 * Lab 2 — echo model. A recording with one echo: y[n] = x[n] + alpha*x[n-N] (true N=5000,
 * 227 ms at 22050 Hz; true alpha=0.9). The lab finds N and alpha from the autocorrelation of
 * y — a side peak at lag N, height ratio r = R[N]/R[0] = alpha/(1+alpha^2) — then undoes the
 * echo with the inverse IIR filter yrec[n] = y[n] - alpha*yrec[n-N]. Ported from Lab_2_F23.mlx.
 *
 * Pure, array-in/array-out: no DOM, no canvas, no audio. Feed it R from the shared FFT
 * `autocorr` (src/demos/signals/dsp/fft.ts).
 */

export interface EchoParams {
  N: number;
  alpha: number;
}

export interface EchoEstimate extends EchoParams {
  /** R[N] / R[0] — the raw peak-height ratio the alpha estimate was derived from. */
  r: number;
}

/**
 * r = R[N]/R[0] = alpha/(1+alpha^2) has a maximum of 0.5, reached as alpha -> 1. Quantization
 * in the shipped (int16) signal can push the measured ratio at the true peak just past 0.5,
 * where alpha = (1 - sqrt(1-4r^2))/(2r) would go complex. Clamp just under 0.5 instead, where
 * alpha is just under 1 — i.e. "the echo is almost as loud as the original, filter is nearly
 * unstable" rather than a NaN.
 */
export const MAX_RATIO = 0.499999;

/** alpha from the autocorrelation side-peak height ratio r = R[N]/R[0] (see MAX_RATIO above). */
export function alphaFromRatio(r: number): number {
  const rc = Math.min(Math.abs(r), MAX_RATIO);
  if (rc <= 0) return 0;
  return (1 - Math.sqrt(1 - 4 * rc * rc)) / (2 * rc);
}

/** Inverse of alphaFromRatio, for drawing the alpha slider back onto the ratio/height axis. */
export function ratioFromAlpha(alpha: number): number {
  const a = Math.abs(alpha);
  return a / (1 + a * a);
}

/** Largest R[k] for minLag <= k <= maxLag. Skipping the first `minLag` lags excludes the
 * zero-lag peak and its skirt so the echo's side peak is found instead. */
export function findPeak(R: ArrayLike<number>, minLag = 200, maxLag = R.length - 1): { N: number; Rpeak: number } {
  let best = minLag;
  for (let k = minLag + 1; k <= maxLag; k++) {
    if (R[k] > R[best]) best = k;
  }
  return { N: best, Rpeak: R[best] };
}

/** Estimate N and alpha from a precomputed autocorrelation R[0..maxLag]. */
export function estimateEcho(R: ArrayLike<number>, minLag = 200, maxLag = R.length - 1): EchoEstimate {
  const { N, Rpeak } = findPeak(R, minLag, maxLag);
  const r = Rpeak / R[0];
  return { N, alpha: alphaFromRatio(r), r };
}

/** Inverse IIR filter: yrec[n] = y[n] - alpha*yrec[n-N], i.e. filter(1, [1, 0...0, alpha], y)
 * with the alpha tap N samples back. Unstable (grows without bound) once |alpha| >= 1. */
export function inverseFilter(y: ArrayLike<number>, N: number, alpha: number): Float64Array {
  const out = new Float64Array(y.length);
  for (let n = 0; n < y.length; n++) {
    out[n] = y[n] - (n >= N ? alpha * out[n - N] : 0);
  }
  return out;
}

/** Clamp samples to +-1, for plotting/playback after a possibly-unstable recovery. */
export function clampUnit(x: ArrayLike<number>): Float64Array {
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = Math.max(-1, Math.min(1, x[i]));
  return out;
}

/** Radius of the inverse filter's N poles, evenly spaced on |z| = |alpha|^(1/N). */
export function poleRadius(alpha: number, N: number): number {
  return Math.pow(Math.abs(alpha), 1 / N);
}

/** 1/(1 + alpha*z^-N) is stable iff its poles sit strictly inside the unit circle. */
export function isStable(alpha: number): boolean {
  return Math.abs(alpha) < 1;
}

/** Angles (radians) of a decimated sample of the N poles of 1/(1+alpha*z^-N) for alpha > 0
 * (poles solve z^N = -alpha, i.e. angle = (2k+1)*pi/N). N is typically in the thousands, so
 * `count` picks an evenly-spaced subset to plot instead of every pole. */
export function poleAngles(N: number, count = 240): Float64Array {
  const c = Math.max(1, Math.min(count, N));
  const out = new Float64Array(c);
  for (let i = 0; i < c; i++) {
    const k = Math.round((i * N) / c);
    out[i] = ((2 * k + 1) * Math.PI) / N;
  }
  return out;
}

/** Echo delay in milliseconds at sample rate fs. */
export function delayMs(N: number, fs: number): number {
  return (N / fs) * 1000;
}
