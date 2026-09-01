/**
 * Welch PSD — port of the exact path the notebooks used: neurodsp's
 * compute_spectrum(…, method='welch', nperseg=2·fs) runs scipy.signal.
 * spectrogram (hann window, noverlap = nperseg//8, constant detrend per
 * segment, density scaling) and then mean-averages segments.
 * Verified against the fixture PSD (tests/organoids-core.test.ts).
 */
import { dftPower } from "./fft";

export interface WelchResult {
  freqs: Float64Array;
  psd: Float64Array;
}

export function welch(sig: ArrayLike<number>, fs: number, npersegIn?: number): WelchResult {
  const nperseg = Math.min(npersegIn ?? fs * 2, sig.length);
  const noverlap = Math.floor(nperseg / 8);
  const step = nperseg - noverlap;
  const nSegs = Math.floor((sig.length - noverlap) / step);
  const half = Math.floor(nperseg / 2);

  // periodic hann, as scipy's get_window('hann', nperseg, fftbins=True)
  const win = new Float64Array(nperseg);
  let winSumSq = 0;
  for (let i = 0; i < nperseg; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / nperseg);
    winSumSq += win[i] * win[i];
  }
  const scale = 1 / (fs * winSumSq);

  const seg = new Float64Array(nperseg);
  const power = new Float64Array(half + 1);
  const acc = new Float64Array(half + 1);

  for (let s = 0; s < nSegs; s++) {
    const off = s * step;
    let mean = 0;
    for (let i = 0; i < nperseg; i++) mean += sig[off + i] as number;
    mean /= nperseg;
    for (let i = 0; i < nperseg; i++) seg[i] = ((sig[off + i] as number) - mean) * win[i];
    dftPower(seg, power);
    for (let k = 0; k <= half; k++) acc[k] += power[k];
  }

  const psd = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) {
    let v = (acc[k] / nSegs) * scale;
    if (k !== 0 && !(nperseg % 2 === 0 && k === half)) v *= 2;
    psd[k] = v;
  }
  const freqs = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) freqs[k] = (k * fs) / nperseg;
  return { freqs, psd };
}
