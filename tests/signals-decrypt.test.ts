/**
 * Lab 1 ("Decrypt the message") — the browser's regenerated permutation and the full decode
 * chain must match a SciPy/NumPy fixture, and the decode chain must reproduce the actual
 * shipped assets under public/demos/signals/ (fixture + assets from scripts/demos/signals_prep.py).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { matlabRandperm } from "@/demos/signals/dsp/mt19937";
import { decodeAll, flipY, reformZ, unpackMagPhase, unpermuteY } from "@/demos/signals/decrypt/model";

interface Fixture {
  n: number;
  seed: number;
  permHead: number[];
  permTail: number[];
  permSum: number;
  decodedSlice: { from: number; y: number[] };
  flippedSlice: { from: number; m: number[] };
  lag1: number;
}

interface Lab1Json {
  fs: number;
  seed: number;
  nHalf: number;
  n: number;
  mag: { file: string; n: number; fs: number; scale: number };
  phase: { file: string; n: number; fs: number; scale: number };
}

const FX_PATH = path.join(process.cwd(), "tests", "fixtures", "signals-lab1.json");
const fx = JSON.parse(fs.readFileSync(FX_PATH, "utf8")) as Fixture;

const ASSETS_DIR = path.join(process.cwd(), "public", "demos", "signals");
const header = JSON.parse(fs.readFileSync(path.join(ASSETS_DIR, "lab1.json"), "utf8")) as Lab1Json;

function readInt16Bin(file: string): Int16Array {
  const buf = fs.readFileSync(path.join(ASSETS_DIR, file));
  // Copy into a fresh, aligned ArrayBuffer so the Int16Array view is well-formed regardless
  // of the Buffer's internal offset.
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Int16Array(ab);
}

function toFloat64(raw: Int16Array, scale: number): Float64Array {
  const out = new Float64Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw[i] / scale;
  return out;
}

function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  expect(a.length).toBe(b.length);
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

describe("matlabRandperm (Lab 1 seed)", () => {
  it("matches MATLAB's rng(2023); randperm(N) head, tail, and checksum", () => {
    const perm = matlabRandperm(fx.n, fx.seed);
    expect(perm.length).toBe(fx.n);
    expect(Array.from(perm.slice(0, 32))).toEqual(fx.permHead);
    expect(Array.from(perm.slice(perm.length - 32))).toEqual(fx.permTail);
    let sum = 0;
    for (let i = 0; i < perm.length; i++) sum += perm[i];
    expect(sum).toBe(fx.permSum);
  });
});

describe("decode chain against the shipped assets", () => {
  const mag = toFloat64(readInt16Bin(header.mag.file), header.mag.scale);
  const phase = toFloat64(readInt16Bin(header.phase.file), header.phase.scale);

  it("asset header matches the fixture's N and seed", () => {
    expect(header.n).toBe(fx.n);
    expect(header.seed).toBe(fx.seed);
    expect(mag.length).toBe(header.nHalf);
    expect(phase.length).toBe(header.nHalf);
  });

  it("unpack -> reform -> un-permute reproduces decodedSlice.y", () => {
    const { re, im } = unpackMagPhase(mag, phase);
    const z = reformZ(re, im);
    expect(z.length).toBe(fx.n);
    const perm = matlabRandperm(fx.n, fx.seed);
    const y = unpermuteY(z, perm);
    const { from, y: expected } = fx.decodedSlice;
    const got = Array.from(y.slice(from, from + expected.length));
    expect(maxAbsDiff(got, expected)).toBeLessThan(1e-9);
  });

  it("flip reproduces flippedSlice.m", () => {
    const perm = matlabRandperm(fx.n, fx.seed);
    const { re, im } = unpackMagPhase(mag, phase);
    const z = reformZ(re, im);
    const y = unpermuteY(z, perm);
    const m = flipY(y);
    const { from, m: expected } = fx.flippedSlice;
    const got = Array.from(m.slice(from, from + expected.length));
    expect(maxAbsDiff(got, expected)).toBeLessThan(1e-9);
  });

  it("decodeAll matches the individually-composed chain", () => {
    const perm = matlabRandperm(fx.n, fx.seed);
    const chain = decodeAll(mag, phase, perm);
    const { from, y: expectedY } = fx.decodedSlice;
    const { m: expectedM } = fx.flippedSlice;
    expect(maxAbsDiff(Array.from(chain.y.slice(from, from + expectedY.length)), expectedY)).toBeLessThan(1e-9);
    expect(maxAbsDiff(Array.from(chain.m.slice(from, from + expectedM.length)), expectedM)).toBeLessThan(1e-9);
  });
});
