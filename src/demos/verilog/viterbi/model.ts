/**
 * TypeScript model of the ECE 111 Viterbi project, bit-exact with the RTL in
 * demos/verilog_src/viterbi/ (encoder.sv, bmc0.sv, ACS.sv, decoder.sv, viterbi_tx_rx_2a1.sv).
 *
 * Rate 1/2, 8-state (constraint length 3) systematic recursive convolutional code:
 *   next state = { d ^ s0 ^ s1, s2, s1 }         (shift right, feedback into the MSB)
 *   output     = { d ^ s2 ^ s1, d }              (parity, systematic bit)
 * The decoder keeps one 8-bit path metric and one survivor shift register per state,
 * an add-compare-select per state, and reads the decoded bit off the oldest survivor
 * bit of the best state after TRACEBACK_DEPTH symbols.
 */

export type Bit = 0 | 1;
/** 2-bit symbol as an integer: bit1 = parity (MSB), bit0 = systematic bit (LSB). */
export type Symbol2 = 0 | 1 | 2 | 3;

export const N_STATES = 8;
export const RTL_TRACEBACK_DEPTH = 64;
/** Cycles from an input bit entering the encoder to its decoded copy leaving the decoder. */
export const RTL_LATENCY = 4105;

// --------------------------------------------------------------------------------------------
// Encoder (encoder.sv)

export function nextState(s: number, d: Bit): number {
  const s0 = s & 1;
  const s1 = (s >> 1) & 1;
  return ((d ^ s0 ^ s1) << 2) | (s >> 1);
}

export function outSymbol(s: number, d: Bit): Symbol2 {
  const s1 = (s >> 1) & 1;
  const s2 = (s >> 2) & 1;
  return (((d ^ s2 ^ s1) << 1) | d) as Symbol2;
}

/** The case table exactly as written in encoder.sv: [next, out] for d=0 and d=1. */
export const ENCODER_TABLE: { state: number; d0: [number, Symbol2]; d1: [number, Symbol2] }[] = Array.from(
  { length: N_STATES },
  (_, s) => ({ state: s, d0: [nextState(s, 0), outSymbol(s, 0)], d1: [nextState(s, 1), outSymbol(s, 1)] }),
);

export interface EncodeResult {
  /** State before each bit (states[i] is the state used to encode bits[i]). */
  states: number[];
  symbols: Symbol2[];
  finalState: number;
}

export function encode(bits: Bit[], start = 0): EncodeResult {
  const states: number[] = [];
  const symbols: Symbol2[] = [];
  let s = start;
  for (const d of bits) {
    states.push(s);
    symbols.push(outSymbol(s, d));
    s = nextState(s, d);
  }
  return { states, symbols, finalState: s };
}

// --------------------------------------------------------------------------------------------
// Channel (the error injector in viterbi_tx_rx_2a1.sv)

export interface ChannelPreset {
  id: string;
  label: string;
  PERIOD: number;
  BURST: number;
  ERR_BIT0: Bit;
  ERR_BIT1: Bit;
  USE_RAND: Bit;
  ENABLE_ERR: Bit;
}

/** The testbench's commented-out configurations, in order. */
export const CHANNEL_PRESETS: ChannelPreset[] = [
  { id: "clean", label: "No channel errors", PERIOD: 16, BURST: 1, ERR_BIT0: 0, ERR_BIT1: 0, USE_RAND: 0, ENABLE_ERR: 0 },
  { id: "2a1", label: "2.a.1 · bit[0] once every 8", PERIOD: 8, BURST: 1, ERR_BIT0: 1, ERR_BIT1: 0, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a2", label: "2.a.2 · bit[1] once every 8", PERIOD: 8, BURST: 1, ERR_BIT0: 0, ERR_BIT1: 1, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a3", label: "2.a.3 · both bits once every 16", PERIOD: 16, BURST: 1, ERR_BIT0: 1, ERR_BIT1: 1, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a4", label: "2.a.4 · bit[0] ×2 every 16", PERIOD: 16, BURST: 2, ERR_BIT0: 1, ERR_BIT1: 0, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a5", label: "2.a.5 · bit[1] ×2 every 16", PERIOD: 16, BURST: 2, ERR_BIT0: 0, ERR_BIT1: 1, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a6", label: "2.a.6 · bit[0] ×4 every 32", PERIOD: 32, BURST: 4, ERR_BIT0: 1, ERR_BIT1: 0, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a7", label: "2.a.7 · bit[1] ×4 every 32", PERIOD: 32, BURST: 4, ERR_BIT0: 0, ERR_BIT1: 1, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a8", label: "2.a.8 · both bits ×2 every 32", PERIOD: 32, BURST: 2, ERR_BIT0: 1, ERR_BIT1: 1, USE_RAND: 0, ENABLE_ERR: 1 },
];

export interface ChannelResult {
  rx: Symbol2[];
  /** error mask applied to each symbol (0 = untouched). */
  hits: number[];
  corrupted: number;
}

/**
 * Deterministic injector: symbol k (k = word_ct) is flipped by mask when k % PERIOD < BURST.
 * `random` (0..1) is used only for USE_RAND presets, where the RTL uses $random % PERIOD.
 */
export function channel(
  symbols: Symbol2[],
  preset: Pick<ChannelPreset, "PERIOD" | "BURST" | "ERR_BIT0" | "ERR_BIT1" | "USE_RAND" | "ENABLE_ERR">,
  random: () => number = Math.random,
  extraFlipProb = 0,
): ChannelResult {
  const mask = (preset.ERR_BIT1 << 1) | preset.ERR_BIT0;
  const rx: Symbol2[] = [];
  const hits: number[] = [];
  let corrupted = 0;
  symbols.forEach((sym, k) => {
    let m = 0;
    if (preset.ENABLE_ERR) {
      const phase = preset.USE_RAND ? Math.floor(random() * preset.PERIOD) : k % preset.PERIOD;
      if (phase < preset.BURST) m = mask;
    }
    if (extraFlipProb > 0) {
      if (random() < extraFlipProb) m ^= 1;
      if (random() < extraFlipProb) m ^= 2;
    }
    if (m) corrupted++;
    hits.push(m);
    rx.push((sym ^ m) as Symbol2);
  });
  return { rx, hits, corrupted };
}

// --------------------------------------------------------------------------------------------
// Decoder (bmc0.sv + ACS.sv + decoder.sv)

/** Predecessors of each state: [reached with input 0, reached with input 1] (decoder.sv ACS wiring). */
export const PREDECESSORS: [number, number][] = [
  [0, 1],
  [3, 2],
  [4, 5],
  [7, 6],
  [1, 0],
  [2, 3],
  [5, 4],
  [6, 7],
];

/** bmc #(.INVERT_RX1(1)) for states 1, 2, 5, 6. */
export const INVERT_RX1: boolean[] = [false, true, true, false, false, true, true, false];

/** Expected symbols on the two incoming branches of a state: path 0 → 00 (10 if inverted), path 1 → 11 (01). */
export function expectedSymbols(state: number): [Symbol2, Symbol2] {
  return INVERT_RX1[state] ? [2, 1] : [0, 3];
}

export function hamming2(a: number, b: number): number {
  const x = (a ^ b) & 3;
  return (x & 1) + (x >> 1);
}

/** bmc0.sv: branch metrics for a state's two incoming paths. */
export function branchMetrics(state: number, rx: Symbol2): [number, number] {
  const [e0, e1] = expectedSymbols(state);
  return [hamming2(rx, e0), hamming2(rx, e1)];
}

export interface AcsResult {
  selection: Bit;
  valid: boolean;
  cost: number;
  cost0: number;
  cost1: number;
}

/** ACS.sv, verbatim: 8-bit adds, prefer path 0 on ties. */
export function acs(v0: boolean, v1: boolean, bm0: number, bm1: number, pm0: number, pm1: number): AcsResult {
  const cost0 = (pm0 + bm0) & 0xff;
  const cost1 = (pm1 + bm1) & 0xff;
  if (!v0 && !v1) return { selection: 0, valid: false, cost: 0, cost0, cost1 };
  if (v0 && !v1) return { selection: 0, valid: true, cost: cost0, cost0, cost1 };
  if (!v0 && v1) return { selection: 1, valid: true, cost: cost1, cost0, cost1 };
  const sel: Bit = cost0 > cost1 ? 1 : 0;
  return { selection: sel, valid: true, cost: sel ? cost1 : cost0, cost0, cost1 };
}

export interface StepRecord {
  /** Symbol index within the decoder's run (enable_count before the update). */
  k: number;
  rx: Symbol2;
  bm: [number, number][];
  acs: AcsResult[];
  /** Registered results after the update. */
  valid: boolean[];
  cost: number[];
  normalized: boolean;
  bestState: number;
  bestMetric: number;
  /** Decoded bit produced this step (null until TRACEBACK_DEPTH symbols have accumulated). */
  out: Bit | null;
  /** Newest→oldest survivor bits per state, after the update (length ≤ depth). */
  survivors: Bit[][];
}

export class ViterbiDecoder {
  readonly depth: number;
  valid: boolean[] = [];
  cost: number[] = [];
  survivors: Bit[][] = [];
  count = 0;
  history: StepRecord[] = [];

  constructor(depth = RTL_TRACEBACK_DEPTH) {
    this.depth = depth;
    this.reset();
  }

  reset(): void {
    this.valid = Array.from({ length: N_STATES }, (_, i) => i === 0);
    this.cost = new Array(N_STATES).fill(0);
    this.survivors = Array.from({ length: N_STATES }, () => []);
    this.count = 0;
    this.history = [];
  }

  /** Best (lowest metric) valid state; ties go to the lower index, like the comparator tree. */
  best(): { state: number; metric: number } {
    let state = 0;
    let metric = 0xff;
    for (let s = 0; s < N_STATES; s++) {
      const m = this.valid[s] ? this.cost[s] : 0xff;
      if (m < metric) {
        metric = m;
        state = s;
      }
    }
    return { state, metric };
  }

  step(rx: Symbol2): StepRecord {
    const bm: [number, number][] = [];
    const res: AcsResult[] = [];
    for (let s = 0; s < N_STATES; s++) {
      const [p0, p1] = PREDECESSORS[s];
      const b = branchMetrics(s, rx);
      bm.push(b);
      res.push(acs(this.valid[p0], this.valid[p1], b[0], b[1], this.cost[p0], this.cost[p1]));
    }
    const normalized = res.every((r) => (r.cost & 0x80) !== 0);
    const newValid = res.map((r) => r.valid);
    const newCost = res.map((r) => (normalized ? r.cost & 0x7f : r.cost));
    const newSurv: Bit[][] = [];
    for (let s = 0; s < N_STATES; s++) {
      const [p0, p1] = PREDECESSORS[s];
      const r = res[s];
      if (!r.valid) {
        newSurv.push(this.survivors[s]);
        continue;
      }
      const src = this.survivors[r.selection ? p1 : p0];
      const next = [r.selection, ...src].slice(0, this.depth) as Bit[];
      newSurv.push(next);
    }
    this.valid = newValid;
    this.cost = newCost;
    this.survivors = newSurv;
    this.count++;
    const { state, metric } = this.best();
    const out: Bit | null = this.count >= this.depth ? (this.survivors[state][this.depth - 1] ?? 0) : null;
    const rec: StepRecord = {
      k: this.count - 1,
      rx,
      bm,
      acs: res,
      valid: newValid,
      cost: newCost,
      normalized,
      bestState: state,
      bestMetric: metric,
      out,
      survivors: newSurv,
    };
    this.history.push(rec);
    return rec;
  }

  /** The survivor path ending in `state` after step index `t`: states at t, t-1, … (newest first). */
  tracePath(t: number, state = this.history[t]?.bestState ?? 0, maxLen = this.depth): number[] {
    const path: number[] = [];
    let s = state;
    for (let i = t; i >= 0 && path.length < maxLen + 1; i--) {
      path.push(s);
      const r = this.history[i];
      const [p0, p1] = PREDECESSORS[s];
      s = r.acs[s].selection ? p1 : p0;
    }
    return path;
  }

  /** Flush: decode everything that is still inside the traceback window (best-state traceback). */
  flush(): Bit[] {
    const t = this.history.length - 1;
    if (t < 0) return [];
    // Streamed outputs already covered symbols 0 .. count-depth; the window still holds
    // the last depth-1 symbols (or everything, if fewer than depth were seen).
    const path = this.tracePath(t, undefined, Math.min(this.depth - 2, t));
    // path[i] is the state at time t-i; the bit that entered state path[i] is its selection.
    const bits: Bit[] = [];
    for (let i = path.length - 1; i >= 0; i--) {
      const time = t - i;
      bits.push(this.history[time].acs[path[i]].selection);
    }
    return bits;
  }
}

/** Convenience: full encode → channel → decode, returning the decoded bits aligned with the input. */
export function simulate(
  bits: Bit[],
  preset: ChannelPreset,
  opts: { depth?: number; random?: () => number; extraFlipProb?: number } = {},
): { enc: EncodeResult; ch: ChannelResult; dec: ViterbiDecoder; decoded: Bit[] } {
  const enc = encode(bits);
  const ch = channel(enc.symbols, preset, opts.random, opts.extraFlipProb);
  const dec = new ViterbiDecoder(opts.depth ?? RTL_TRACEBACK_DEPTH);
  const decoded: Bit[] = [];
  for (const rx of ch.rx) {
    const r = dec.step(rx);
    if (r.out !== null) decoded.push(r.out);
  }
  decoded.push(...dec.flush());
  return { enc, ch, dec, decoded: decoded.slice(0, bits.length) };
}

export function parseBits(text: string): Bit[] {
  return [...text].filter((c) => c === "0" || c === "1").map((c) => (c === "1" ? 1 : 0));
}

export function randomBits(n: number, random: () => number = Math.random): Bit[] {
  return Array.from({ length: n }, () => (random() < 0.5 ? 0 : 1));
}

/** Small deterministic PRNG for reproducible demos (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
