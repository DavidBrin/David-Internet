/**
 * The TS Viterbi model must be bit-exact with the RTL simulated at build time
 * (public/demos/verilog/viterbi.json, produced by `pnpm sync-demos verilog`).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENCODER_TABLE,
  ViterbiDecoder,
  channel,
  encode,
  simulate,
  CHANNEL_PRESETS,
  type Bit,
  type Symbol2,
} from "@/demos/verilog/viterbi/model";

const JSON_PATH = path.join(process.cwd(), "public", "demos", "verilog", "viterbi.json");
const hasJson = fs.existsSync(JSON_PATH);

interface Preset {
  id: string;
  status: string;
  params: { PERIOD: number; BURST: number; ERR_BIT0: 0 | 1; ERR_BIT1: 0 | 1; USE_RAND: 0 | 1; ENABLE_ERR: 0 | 1 };
  inputBits: number[];
  decodedBits: number[];
  rxSymbols: number[];
  errHits: number[];
  windows: { id: string; from: number; signals: Record<string, (number | null)[]>; pathCost: (number | null)[][] }[];
}

const sim = hasJson ? (JSON.parse(fs.readFileSync(JSON_PATH, "utf8")) as { presets: Preset[] }) : null;
/** The RTL is held in reset for the first 10 cycles; the decoder enables one cycle after the encoder. */
const RESET_CYCLES = 10;

describe("encoder table", () => {
  it("matches Implementation-Info.md", () => {
    const expected: [number, number, number, number][] = [
      // state, next0, out0, next1, out1 — out as 2-bit integer (bit1 bit0)
      [0, 0, 0b00, 4, 0b11],
      [1, 4, 0b00, 0, 0b11],
      [2, 5, 0b10, 1, 0b01],
      [3, 1, 0b10, 5, 0b01],
      [4, 2, 0b10, 6, 0b01],
      [5, 6, 0b10, 2, 0b01],
      [6, 7, 0b00, 3, 0b11],
      [7, 3, 0b00, 7, 0b11],
    ].map((r) => [r[0], r[1], r[2], r[3], r[4]] as unknown as [number, number, number, number]);
    for (const [s, n0, o0, n1, o1] of expected as unknown as [number, number, number, number, number][]) {
      expect(ENCODER_TABLE[s].d0).toEqual([n0, o0]);
      expect(ENCODER_TABLE[s].d1).toEqual([n1, o1]);
    }
  });
});

describe("decoder corrects the assignment's error patterns", () => {
  it("recovers a random message through 2.a.1 (one bit in eight)", () => {
    const bits = Array.from({ length: 200 }, (_, i) => ((i * 7919) % 13 < 6 ? 1 : 0) as Bit);
    const r = simulate(bits, CHANNEL_PRESETS[1]);
    expect(r.ch.corrupted).toBeGreaterThan(20);
    expect(r.decoded).toEqual(bits);
  });
});

describe.skipIf(!hasJson)("bit-exact against the Icarus simulation", () => {
  for (const p of sim?.presets ?? []) {
    if (p.status === "error" || p.params.USE_RAND || !p.windows.length) continue;
    it(`preset ${p.id}: encoder + channel reproduce the RTL symbol stream`, () => {
      const enc = encode(p.inputBits.slice(RESET_CYCLES) as Bit[]);
      const win = p.windows.find((w) => w.id === "in")!;
      const rtlEncOut = win.signals.encoder_o.slice(RESET_CYCLES, RESET_CYCLES + enc.symbols.length);
      expect(enc.symbols).toEqual(rtlEncOut);
      const ch = channel(enc.symbols, p.params);
      expect(ch.rx).toEqual(p.rxSymbols.slice(RESET_CYCLES, RESET_CYCLES + enc.symbols.length));
      expect(ch.hits).toEqual(p.errHits.slice(RESET_CYCLES, RESET_CYCLES + enc.symbols.length));
    });

    it(`preset ${p.id}: path metrics match the RTL every cycle`, () => {
      const dec = new ViterbiDecoder();
      const win = p.windows.find((w) => w.id === "in")!;
      // decoder step k consumes rxSymbols[10 + k] at clock edge 11 + k; its registered
      // result is visible as the pre-edge sample at cycle 12 + k.
      let checked = 0;
      for (let k = 0; RESET_CYCLES + 2 + k < win.pathCost.length; k++) {
        const rec = dec.step(p.rxSymbols[RESET_CYCLES + k] as Symbol2);
        const rtlCost = win.pathCost[RESET_CYCLES + 2 + k];
        expect(rec.cost, `cycle ${RESET_CYCLES + 2 + k}`).toEqual(rtlCost);
        const rtlBest = win.signals.best_state[RESET_CYCLES + 2 + k];
        expect(rec.bestState, `best_state at cycle ${RESET_CYCLES + 2 + k}`).toEqual(rtlBest);
        checked++;
      }
      expect(checked).toBeGreaterThan(250);
    });

    it(`preset ${p.id}: decoded bits match the RTL scoreboard`, () => {
      const dec = new ViterbiDecoder();
      const out: number[] = [];
      for (let k = 0; RESET_CYCLES + k < p.rxSymbols.length; k++) {
        const rec = dec.step(p.rxSymbols[RESET_CYCLES + k] as Symbol2);
        if (rec.out !== null) out.push(rec.out);
      }
      // out[i] is the decoded copy of input bit RESET_CYCLES + i. The JSON only carries the
      // first 300 cycles of symbols, so compare what both sides cover.
      const n = Math.min(out.length, p.decodedBits.length - RESET_CYCLES);
      expect(n).toBeGreaterThan(200);
      expect(out.slice(0, n)).toEqual(p.decodedBits.slice(RESET_CYCLES, RESET_CYCLES + n));
    });
  }
});
