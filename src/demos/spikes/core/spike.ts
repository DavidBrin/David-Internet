/**
 * Full-sweep fit — the TS equivalent of spikeparam's Spike.fit as spike_proj
 * ran it: Spike(thresh_amp=0, window_length=(5,5), smooth_frac=.01).fit(sig, fs).
 */
import { detectSpikes, windowSpikes } from "./window";
import { computeFeatures, SpikeFeatures } from "./features";

export interface FitSettings {
  threshAmp: number;
  threshMs: number;
  windowLength: [number, number];
  smoothFrac: number;
}

export const PROJECT_FIT: FitSettings = {
  threshAmp: 0,
  threshMs: 1.0,
  windowLength: [5, 5],
  smoothFrac: 0.01,
};

export interface FittedSpike {
  /** Peak index in the sweep (samples). */
  peakInd: number;
  /** Windowed waveform (mV). */
  window: Float64Array;
  features: SpikeFeatures | null;
  /** ISI to the next spike, ms (NaN for the last). */
  isi: number;
  error: boolean;
}

export interface SweepFit {
  fs: number;
  settings: FitSettings;
  spikes: FittedSpike[];
}

export function fitSweep(sig: ArrayLike<number>, fs: number, settings: FitSettings = PROJECT_FIT): SweepFit {
  const inds = detectSpikes(sig, fs, settings.threshAmp, settings.threshMs, settings.windowLength);
  const { spikes: windows, keptInds } = windowSpikes(sig, fs, inds, settings.windowLength);
  const peakInd = Math.trunc((settings.windowLength[0] * fs) / 1000);
  const out: FittedSpike[] = [];
  for (let i = 0; i < windows.length; i++) {
    let features: SpikeFeatures | null = null;
    let error = false;
    try {
      features = computeFeatures(windows[i], fs, { peakInd, smoothFrac: settings.smoothFrac });
    } catch {
      error = true;
    }
    const isi = i < keptInds.length - 1 ? ((keptInds[i + 1] - keptInds[i]) / fs) * 1000 : NaN;
    out.push({ peakInd: keptInds[i], window: windows[i], features, isi, error });
  }
  return { fs, settings, spikes: out };
}
