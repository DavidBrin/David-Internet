/**
 * Types + decoders for the committed assets under /demos/spikes/
 * (built by scripts/demos/spikes_prep.py from DANDI:001776).
 */

export interface ShippedSweep {
  id: string;
  subject: string;
  file: string;
  fs: number;
  n: number;
  /** base64 little-endian int16, mV × 100. */
  mv_q: string;
  /** stimulus current (pA), decimated ×50; null if absent. */
  stim_pA: number[] | null;
  nSpikes: number;
}

export interface SweepsJson {
  sweeps: ShippedSweep[];
}

export interface WaveformsJson {
  decim: number;
  scale: number;
  windows: string[];
}

export interface FeatureRow {
  file: string;
  subject: string;
  sweep: string;
  spike: number;
  peakInd: number;
  ramp_amp: number | null;
  inflection_time: number | null;
  inflection_amp: number | null;
  peak_amp: number | null;
  peak_width: number | null;
  peak_sharpness: number | null;
  exp_amp: number;
  exp_lambda: number | null;
  exp_const: number | null;
  isi: number | null;
  r_squared_ramp: number | null;
  r_squared_exp: number | null;
  /** Index into waveforms.json windows (may be absent past the cap). */
  wf?: number;
}

export interface FeaturesJson {
  rows: FeatureRow[];
}

export interface SubjectMeta {
  file: string;
  subject: string;
  species?: string;
  sex?: string;
  age?: string;
  weight?: string;
  description?: string;
  subject_id?: string;
}

export interface SpikesMetaJson {
  dandiset: string;
  dandisetName: string;
  dandisetUrl: string;
  license: string;
  portal: string;
  files: SubjectMeta[];
  settings: Record<string, unknown>;
  note: string;
}

export interface FigureEntry {
  file: string;
  caption: string;
  w: number;
  h: number;
}

/** Decode base64 little-endian int16 → mV Float64Array (scale = 0.01 mV). */
export function decodeI16(b64: string, scale = 0.01): Float64Array {
  const bin = atob(b64);
  const n = bin.length / 2;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v * scale;
  }
  return out;
}

/** Feature columns available as axes in the population panel. */
export const FEATURE_COLUMNS = [
  "ramp_amp",
  "inflection_time",
  "inflection_amp",
  "peak_amp",
  "peak_width",
  "peak_sharpness",
  "exp_lambda",
  "exp_const",
  "isi",
  "r_squared_ramp",
  "r_squared_exp",
] as const;

export type FeatureColumn = (typeof FEATURE_COLUMNS)[number];
