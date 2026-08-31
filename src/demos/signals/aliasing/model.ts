/**
 * Lab 4 — aliasing. Pure math: sampling, sinc (bandlimited) reconstruction, the
 * fold-back / apparent-frequency formula, and a chirp + its STFT spectrogram.
 * Tested against a SciPy fixture in tests/signals-aliasing.test.ts.
 */

import { fft } from "@/demos/signals/dsp/fft";

/** Base sample rate the lab records the "continuous" signal at. */
export const FS = 8192;

/** Undersample factors the M slider snaps to. */
export const M_OPTIONS = [1, 2, 4, 8, 16] as const;
export type MFactor = (typeof M_OPTIONS)[number];

/** Undersampled rate for a given factor M. */
export function fs2Of(M: number): number {
  return FS / M;
}

/** Undersampled sample period T2 = M / FS. */
export function t2Of(M: number): number {
  return M / FS;
}

/** sinc(x) = sin(pi x) / (pi x), sinc(0) = 1. */
export function sinc(x: number): number {
  if (x === 0) return 1;
  const px = Math.PI * x;
  return Math.sin(px) / px;
}

// ---------------------------------------------------------------------------
// Sinusoid mode
// ---------------------------------------------------------------------------

/** x[n] = sin(2*pi*f0*n/fs2) — the undersampled tone, sampled at rate fs2. */
export function sampleAt(f0: number, fs2: number, n: number): number {
  return Math.sin((2 * Math.PI * f0 * n) / fs2);
}

/** count consecutive undersampled values x[nStart..nStart+count-1] at rate fs2Of(M). */
export function generateUndersampled(f0: number, M: number, nStart: number, count: number): Float64Array {
  const fs2 = fs2Of(M);
  const out = new Float64Array(count);
  for (let i = 0; i < count; i++) out[i] = sampleAt(f0, fs2, nStart + i);
  return out;
}

/** The "continuous" original sinusoid sin(2*pi*f0*t), evaluated at arbitrary times. */
export function continuousSineAt(f0: number, tArray: ArrayLike<number>): Float64Array {
  const out = new Float64Array(tArray.length);
  for (let i = 0; i < tArray.length; i++) out[i] = Math.sin(2 * Math.PI * f0 * tArray[i]);
  return out;
}

/**
 * Bandlimited (sinc) reconstruction at one instant t from samples[0..N-1], where
 * samples[i] is understood to sit at time (n0 + i) * T2:
 *   x_r(t) = sum_i samples[i] * sinc((t - (n0+i)*T2) / T2)
 */
export function sincReconstructAt(samples: ArrayLike<number>, T2: number, n0: number, t: number): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * sinc((t - (n0 + i) * T2) / T2);
  }
  return sum;
}

/** sincReconstructAt evaluated over an array of times. */
export function sincReconstruct(samples: ArrayLike<number>, T2: number, n0: number, tArray: ArrayLike<number>): Float64Array {
  const out = new Float64Array(tArray.length);
  for (let j = 0; j < tArray.length; j++) out[j] = sincReconstructAt(samples, T2, n0, tArray[j]);
  return out;
}

/** Apparent (folded) frequency once f0 is sampled at fs2: |f0 - fs2*round(f0/fs2)|. */
export function apparentFrequency(f0: number, fs2: number): number {
  return Math.abs(f0 - fs2 * Math.round(f0 / fs2));
}

/** A spectral copy in the DTFT picture: a line at k*fs2 (+/-) f0. */
export interface AliasLine {
  freq: number;
  k: number;
  sign: 1 | -1;
  /** true for the single copy that lands inside baseband [0, fs2/2] — what you actually hear. */
  isBaseband: boolean;
}

/** Spectral copies of f0 (real signal: +/-f0 lines repeated every fs2) within [0, maxFreq]. */
export function aliasLines(f0: number, fs2: number, maxFreq: number): AliasLine[] {
  const lines: AliasLine[] = [];
  const nyq = fs2 / 2;
  const maxK = Math.ceil(maxFreq / fs2) + 1;
  for (let k = -maxK; k <= maxK; k++) {
    for (const sign of [1, -1] as const) {
      const freq = k * fs2 + sign * f0;
      if (freq >= 0 && freq <= maxFreq) {
        lines.push({ freq, k, sign, isBaseband: freq <= nyq + 1e-9 });
      }
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Chirp mode
// ---------------------------------------------------------------------------

/** Chirp duration in seconds — long enough to see (and hear) the Nyquist bounce. */
export const CHIRP_DURATION = 8;
/** Instantaneous frequency at t = CHIRP_DURATION, sweeping up from 0 Hz. */
export const CHIRP_F_END = 4400;
/** Sweep rate in Hz/s: f(t) = CHIRP_SLOPE * t. */
export const CHIRP_SLOPE = CHIRP_F_END / CHIRP_DURATION;

/** Instantaneous frequency of the chirp at time t (seconds), in Hz. */
export function chirpInstFreq(t: number): number {
  return CHIRP_SLOPE * t;
}

/** Phase Omega0*t + 0.5*beta*t^2 with Omega0 = 0, beta = 2*pi*CHIRP_SLOPE. */
export function chirpPhase(t: number): number {
  return Math.PI * CHIRP_SLOPE * t * t;
}

export function chirpSampleAt(t: number): number {
  return Math.sin(chirpPhase(t));
}

/** The chirp sampled at fs (default FS) for `duration` seconds. */
export function generateChirpBase(fs: number = FS, duration: number = CHIRP_DURATION): Float64Array {
  const n = Math.round(fs * duration);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = chirpSampleAt(i / fs);
  return out;
}

/**
 * The chirp undersampled by factor M: x[n] = chirp(n * T2), T2 = M/FS. This is the
 * signal actually played back at fs2 = FS/M — aliasing above fs2/2 is baked into the
 * samples themselves, which is why its own spectrogram already shows the fold.
 */
export function generateChirpUndersampled(M: number, duration: number = CHIRP_DURATION): Float64Array {
  const fs2 = fs2Of(M);
  const n = Math.round(fs2 * duration);
  const out = new Float64Array(n);
  const T2 = t2Of(M);
  for (let i = 0; i < n; i++) out[i] = chirpSampleAt(i * T2);
  return out;
}

export interface Spectrogram {
  /** frames[t] is a magnitude spectrum, length nfft/2+1. */
  frames: Float64Array[];
  hop: number;
  nfft: number;
  /** sample rate the signal (and therefore this spectrogram) was computed at. */
  fs: number;
}

/** Hann-windowed STFT magnitude spectrogram via the shared FFT. */
export function computeSpectrogram(signal: ArrayLike<number>, fs: number, nfft = 256, hop = 128): Spectrogram {
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (nfft - 1));
  const frames: Float64Array[] = [];
  for (let start = 0; start + nfft <= signal.length; start += hop) {
    const re = new Float64Array(nfft);
    const im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) re[i] = signal[start + i] * win[i];
    fft(re, im);
    const mag = new Float64Array(nfft / 2 + 1);
    for (let k = 0; k <= nfft / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    frames.push(mag);
  }
  return { frames, hop, nfft, fs };
}
