/**
 * Synthetic EEG + flash scheduling for the live speller sim. Illustrative by
 * design (no BCI Competition data ships with the page): seeded noise with an
 * EEG-ish spectrum, occipital alpha, and a P300 template injected after target
 * flashes. Timing constants are the real paradigm's (README: 100 ms on, 75 ms
 * off, 12 flashes x 15 repetitions; 650 ms windows at 120 Hz -> 78 samples).
 */

export const FLASH_ON_MS = 100;
export const FLASH_OFF_MS = 75;
export const SOA_MS = FLASH_ON_MS + FLASH_OFF_MS; // stimulus-onset asynchrony
export const REPETITIONS = 15;
export const WINDOW_MS = 650;
export const SAMPLE_RATE = 120;
export const WINDOW_SAMPLES = 78; // round(120 * 0.65)

/** The CNN2a electrode set, in channel order. */
export const CHANNELS_8 = ["Fz", "Cz", "Pz", "P3", "P4", "PO7", "PO8", "Oz"] as const;

/** Relative P300 amplitude per channel (centro-parietal max — Pz/Cz strongest). */
export const P300_GAINS: Record<(typeof CHANNELS_8)[number], number> = {
  Fz: 0.55, Cz: 0.85, Pz: 1.0, P3: 0.8, P4: 0.8, PO7: 0.55, PO8: 0.55, Oz: 0.45,
};

/** Relative alpha (10 Hz) amplitude per channel (occipital max). */
export const ALPHA_GAINS: Record<(typeof CHANNELS_8)[number], number> = {
  Fz: 0.25, Cz: 0.3, Pz: 0.5, P3: 0.45, P4: 0.45, PO7: 0.85, PO8: 0.85, Oz: 1.0,
};

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle (in place) driven by `rand`. */
export function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface Flash {
  /** Stimulus code 1-6 = column, 7-12 = row. */
  stim: number;
  /** Onset time in ms from sequence start. */
  tOn: number;
  /** 0-based repetition this flash belongs to. */
  repetition: number;
}

/** One character's full flash sequence: REPETITIONS shuffled sets of the 12 codes. */
export function makeFlashSequence(rand: () => number, repetitions = REPETITIONS): Flash[] {
  const flashes: Flash[] = [];
  for (let rep = 0; rep < repetitions; rep++) {
    const codes = shuffle(Array.from({ length: 12 }, (_, i) => i + 1), rand);
    for (let k = 0; k < 12; k++) {
      flashes.push({ stim: codes[k], tOn: (rep * 12 + k) * SOA_MS, repetition: rep });
    }
  }
  return flashes;
}

/** Does stimulus code `stim` contain the letter at (row, col) [0-based]? */
export function stimHitsTarget(stim: number, row: number, col: number): boolean {
  return stim <= 6 ? stim - 1 === col : stim - 7 === row;
}

/**
 * The P300 template at `tMs` after flash onset (unit peak ~300 ms, with a small
 * preceding N200 dip). Zero outside [0, WINDOW_MS].
 */
export function p300Template(tMs: number): number {
  if (tMs < 0 || tMs > WINDOW_MS) return 0;
  const p = Math.exp(-((tMs - 300) ** 2) / (2 * 60 ** 2));
  const n = -0.35 * Math.exp(-((tMs - 200) ** 2) / (2 * 35 ** 2));
  return p + n;
}

/**
 * One channel of ongoing background EEG: AR(1)-filtered white noise (1/f-ish)
 * plus alpha at 10 Hz with a seeded phase. Amplitudes are arbitrary sim units.
 */
export class NoiseChannel {
  private prev = 0;
  private readonly phase: number;
  constructor(
    private readonly rand: () => number,
    private readonly alphaGain: number,
    private readonly ar = 0.95,
  ) {
    this.phase = rand() * 2 * Math.PI;
  }
  /** Next sample at time tMs (call at a fixed rate for a consistent spectrum). */
  next(tMs: number): number {
    const white = (this.rand() * 2 - 1) * 0.55;
    this.prev = this.ar * this.prev + white;
    const alpha = this.alphaGain * 0.35 * Math.sin(2 * Math.PI * 10 * (tMs / 1000) + this.phase);
    return this.prev + alpha;
  }
}

/**
 * A template-matching flash score for the sim's decoder (the notebook uses a
 * CNN here; the sim stands in an inner product with the known P300 shape —
 * stated on the page). `epoch` is [channel][sample] at SAMPLE_RATE.
 */
export function flashScore(epoch: readonly Float32Array[] | readonly number[][]): number {
  let score = 0;
  let norm = 0;
  for (let c = 0; c < epoch.length; c++) {
    const gain = P300_GAINS[CHANNELS_8[c]] ?? 0.5;
    const ch = epoch[c];
    for (let s = 0; s < ch.length; s++) {
      const t = p300Template((s * 1000) / SAMPLE_RATE);
      score += gain * ch[s] * t;
      norm += gain * t * t;
    }
  }
  return norm > 0 ? score / norm : 0;
}
