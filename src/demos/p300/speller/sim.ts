/**
 * Speller sim engine: builds one character trial's full synthetic EEG buffer
 * up front (deterministic given a seed) and exposes helpers to slice a
 * per-flash scoring epoch out of it. Playback/decoding is driven from
 * SpellerPanel's animation loop; this file has no timers of its own.
 */
import {
  ALPHA_GAINS,
  CHANNELS_8,
  Flash,
  NoiseChannel,
  P300_GAINS,
  REPETITIONS,
  SAMPLE_RATE,
  WINDOW_MS,
  WINDOW_SAMPLES,
  makeFlashSequence,
  mulberry32,
  p300Template,
  stimHitsTarget,
} from "../core/eeg";
import { CHAR_SET } from "../core/decode";

const MS_PER_SAMPLE = 1000 / SAMPLE_RATE;

export interface Trial {
  target: string;
  row: number;
  col: number;
  flashes: Flash[];
  durationMs: number;
  sampleCount: number;
  /** [channel][sample], channel order == CHANNELS_8 */
  channels: Float32Array[];
}

/** Row/col (0-based) of `ch` in the 6x6 matrix (CHAR_SET is row-major). */
export function charRowCol(ch: string): { row: number; col: number } {
  const idx = Math.max(0, CHAR_SET.indexOf(ch));
  return { row: Math.floor(idx / 6), col: idx % 6 };
}

/** Build one character's full flash sequence + synthetic EEG buffer. Deterministic in `seed`. */
export function buildTrial(target: string, seed: number, snr: number): Trial {
  const { row, col } = charRowCol(target);
  const seqRand = mulberry32(seed);
  const flashes = makeFlashSequence(seqRand, REPETITIONS);
  const last = flashes[flashes.length - 1];
  const durationMs = last.tOn + WINDOW_MS;
  // pad a few extra samples past the last epoch's end so slicing never runs short
  const sampleCount = Math.ceil(durationMs / MS_PER_SAMPLE) + 4;

  const channels: Float32Array[] = CHANNELS_8.map((chan, ci) => {
    const noiseRand = mulberry32(seed + 1000 + ci * 7919);
    const noise = new NoiseChannel(noiseRand, ALPHA_GAINS[chan]);
    const buf = new Float32Array(sampleCount);
    for (let s = 0; s < sampleCount; s++) buf[s] = noise.next(s * MS_PER_SAMPLE);
    return buf;
  });

  for (const f of flashes) {
    if (!stimHitsTarget(f.stim, row, col)) continue;
    const s0 = Math.floor(f.tOn / MS_PER_SAMPLE);
    const s1 = Math.min(sampleCount, s0 + WINDOW_SAMPLES);
    for (let ci = 0; ci < CHANNELS_8.length; ci++) {
      const gain = P300_GAINS[CHANNELS_8[ci]];
      const buf = channels[ci];
      for (let s = s0; s < s1; s++) {
        buf[s] += snr * gain * p300Template((s - s0) * MS_PER_SAMPLE);
      }
    }
  }

  return { target, row, col, flashes, durationMs, sampleCount, channels };
}

/** [channel][sample] epoch (WINDOW_SAMPLES long) starting at flash onset. */
export function flashEpoch(trial: Trial, flash: Flash): Float32Array[] {
  const s0 = Math.round(flash.tOn / MS_PER_SAMPLE);
  return trial.channels.map((buf) => buf.subarray(s0, s0 + WINDOW_SAMPLES));
}

/** Weighted-across-channels epoch trace (used for the target/non-target ERP averages). */
export function weightedEpochTrace(epoch: readonly Float32Array[]): Float32Array {
  const out = new Float32Array(WINDOW_SAMPLES);
  let gainSum = 0;
  for (let ci = 0; ci < CHANNELS_8.length; ci++) gainSum += P300_GAINS[CHANNELS_8[ci]];
  for (let s = 0; s < WINDOW_SAMPLES; s++) {
    let acc = 0;
    for (let ci = 0; ci < CHANNELS_8.length; ci++) acc += P300_GAINS[CHANNELS_8[ci]] * epoch[ci][s];
    out[s] = acc / gainSum;
  }
  return out;
}

export { MS_PER_SAMPLE };
