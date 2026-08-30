/**
 * Welch spectra and magnitude-squared coherence — a port of the notebook's
 * `compute_functional_coherence`, which is one call:
 *
 *   f, Cxy = scipy.signal.coherence(eeg_data[ch1], eeg_data[ch2], fs=fs, nperseg=1024)
 *
 * SciPy's defaults, reproduced here: Hann window (periodic), 50 % overlap, per-segment
 * constant detrend, 'density' scaling, one-sided spectrum, segments averaged with a plain
 * mean.  Cxy = |Pxy|² / (Pxx · Pyy).  Everything is checked against SciPy in
 * tests/nocturnal-eeg.test.ts.
 */
import { fft, isPowerOfTwo } from "./fft";

export interface Spectrum {
  /** Frequency bins, 0 … fs/2 (nperseg/2 + 1 of them). */
  f: Float64Array;
  /** Power spectral density, units²/Hz. */
  p: Float64Array;
}

export interface CrossSpectrum {
  f: Float64Array;
  re: Float64Array;
  im: Float64Array;
}

/** Periodic Hann window — scipy.signal.get_window('hann', N) (fftbins=True). */
export function hann(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

/** Scratch buffers reused across calls so scrubbing doesn't churn the allocator. */
interface Scratch {
  n: number;
  win: Float64Array;
  scale: number;
  xr: Float64Array;
  xi: Float64Array;
  yr: Float64Array;
  yi: Float64Array;
}
const scratchByN = new Map<number, Scratch>();

function scratchFor(nperseg: number, fs: number): Scratch {
  let s = scratchByN.get(nperseg);
  if (!s) {
    const win = hann(nperseg);
    let ss = 0;
    for (let i = 0; i < nperseg; i++) ss += win[i] * win[i];
    s = {
      n: nperseg,
      win,
      scale: 1 / ss, // multiplied by 1/fs below, so the cache doesn't depend on fs
      xr: new Float64Array(nperseg),
      xi: new Float64Array(nperseg),
      yr: new Float64Array(nperseg),
      yi: new Float64Array(nperseg),
    };
    scratchByN.set(nperseg, s);
  }
  return { ...s, scale: s.scale / fs };
}

/** Copy one segment into the FFT buffers: subtract its mean, apply the window, zero the imaginary part. */
function loadSegment(src: ArrayLike<number>, start: number, win: Float64Array, re: Float64Array, im: Float64Array) {
  const n = win.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += src[start + i];
  mean /= n;
  for (let i = 0; i < n; i++) {
    re[i] = (src[start + i] - mean) * win[i];
    im[i] = 0;
  }
}

/**
 * Core of scipy.signal._spectral_helper for two signals (y may be x): returns the averaged
 * one-sided cross spectrum conj(X)·Y with density scaling.  When x === y that is Pxx.
 */
export function csd(x: ArrayLike<number>, y: ArrayLike<number>, fs: number, nperseg: number): CrossSpectrum {
  if (!isPowerOfTwo(nperseg)) throw new Error("csd: nperseg must be a power of two");
  if (x.length !== y.length) throw new Error("csd: x and y must have the same length");
  if (x.length < nperseg) throw new Error("csd: signal shorter than nperseg");
  const { win, scale, xr, xi, yr, yi } = scratchFor(nperseg, fs);
  const nBins = nperseg / 2 + 1;
  const step = nperseg / 2; // noverlap = nperseg // 2
  const re = new Float64Array(nBins);
  const im = new Float64Array(nBins);
  const same = x === y;

  let nSeg = 0;
  for (let start = 0; start + nperseg <= x.length; start += step) {
    loadSegment(x, start, win, xr, xi);
    fft(xr, xi);
    if (!same) {
      loadSegment(y, start, win, yr, yi);
      fft(yr, yi);
    }
    const ar = xr;
    const ai = xi;
    const br = same ? xr : yr;
    const bi = same ? xi : yi;
    for (let k = 0; k < nBins; k++) {
      // conj(A) * B
      re[k] += ar[k] * br[k] + ai[k] * bi[k];
      im[k] += ar[k] * bi[k] - ai[k] * br[k];
    }
    nSeg++;
  }

  // density scaling; one-sided doubles every bin except DC and Nyquist
  for (let k = 0; k < nBins; k++) {
    const g = (scale / nSeg) * (k === 0 || k === nBins - 1 ? 1 : 2);
    re[k] *= g;
    im[k] *= g;
  }

  const f = new Float64Array(nBins);
  for (let k = 0; k < nBins; k++) f[k] = (k * fs) / nperseg;
  return { f, re, im };
}

/** scipy.signal.welch(x, fs, nperseg=nperseg) with the defaults listed at the top of the file. */
export function welch(x: ArrayLike<number>, fs: number, nperseg: number): Spectrum {
  const { f, re } = csd(x, x, fs, nperseg);
  return { f, p: re };
}

/**
 * scipy.signal.coherence(x, y, fs, nperseg=nperseg): Cxy = |Pxy|² / (Pxx · Pyy), in [0, 1].
 * The scaling cancels, so the result only depends on how the segments are windowed and
 * averaged — which is exactly what the tests pin down.
 */
export function coherence(x: ArrayLike<number>, y: ArrayLike<number>, fs: number, nperseg: number): { f: Float64Array; cxy: Float64Array } {
  const pxx = csd(x, x, fs, nperseg).re;
  const pyy = csd(y, y, fs, nperseg).re;
  const { f, re, im } = csd(x, y, fs, nperseg);
  const cxy = new Float64Array(f.length);
  for (let k = 0; k < f.length; k++) {
    const denom = pxx[k] * pyy[k];
    cxy[k] = denom > 0 ? (re[k] * re[k] + im[k] * im[k]) / denom : 0;
  }
  return { f, cxy };
}

/** EEG bands used for the annotations on the coherence panel. */
export const BANDS: { key: string; label: string; lo: number; hi: number }[] = [
  { key: "delta", label: "δ", lo: 0.5, hi: 4 },
  { key: "theta", label: "θ", lo: 4, hi: 8 },
  { key: "alpha", label: "α", lo: 8, hi: 13 },
  { key: "beta", label: "β", lo: 13, hi: 30 },
];

/** Peak of `cxy` inside each band: frequency and value (null when no bin falls in the band). */
export function bandPeaks(f: Float64Array, cxy: Float64Array) {
  return BANDS.map((b) => {
    let best = -1;
    let bestF = 0;
    for (let k = 0; k < f.length; k++) {
      if (f[k] >= b.lo && f[k] < b.hi && cxy[k] > best) {
        best = cxy[k];
        bestF = f[k];
      }
    }
    return { ...b, peak: best < 0 ? null : { f: bestF, value: best } };
  });
}
