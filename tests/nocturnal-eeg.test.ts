/**
 * The Brainwave lab's TypeScript DSP must reproduce SciPy / neurodsp on a 5 s slice of the
 * shipped recording (fixture from scripts/demos/nocturnal_prep.py).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fft } from "@/demos/nocturnal/eeg/fft";
import {
  commonAverage,
  convolveSame,
  designBandstop,
  designLowpass,
  filterLength,
  firwin,
  lowpassDecimate,
  notch60,
} from "@/demos/nocturnal/eeg/filters";
import { bandPeaks, coherence, welch } from "@/demos/nocturnal/eeg/coherence";

interface Fixture {
  fs: number;
  channels: string[];
  slice: [number, number];
  xa: number[];
  xb: number[];
  lowpass: { fHi: number; nSeconds: number; coefs: number[]; y: number[] };
  bandstop: { fRange: [number, number]; nSeconds: number; coefs: number[]; y: number[] };
  welch: { nperseg: number; f: number[]; p: number[] };
  coherence: { nperseg: number; f: number[]; cxy: number[] };
}

const FX_PATH = path.join(process.cwd(), "tests", "fixtures", "nocturnal-eeg.json");
const fx = JSON.parse(fs.readFileSync(FX_PATH, "utf8")) as Fixture;

function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  expect(a.length).toBe(b.length);
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

function maxRelDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  expect(a.length).toBe(b.length);
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]) / Math.max(Math.abs(b[i]), 1e-300));
  return m;
}

describe("fft", () => {
  it("matches the DFT definition on a small vector", () => {
    const n = 8;
    const x = Array.from({ length: n }, (_, i) => Math.sin(i) + 0.3 * i);
    const re = Float64Array.from(x);
    const im = new Float64Array(n);
    fft(re, im);
    for (let k = 0; k < n; k++) {
      let er = 0;
      let ei = 0;
      for (let i = 0; i < n; i++) {
        er += x[i] * Math.cos((-2 * Math.PI * k * i) / n);
        ei += x[i] * Math.sin((-2 * Math.PI * k * i) / n);
      }
      expect(re[k]).toBeCloseTo(er, 10);
      expect(im[k]).toBeCloseTo(ei, 10);
    }
  });

  it("rejects non-power-of-two lengths", () => {
    expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow();
  });
});

describe("firwin (scipy.signal.firwin, Hamming, scale=True)", () => {
  it("uses neurodsp's odd filter length", () => {
    expect(filterLength(250, 0.2)).toBe(51);
    expect(filterLength(250, 0.5)).toBe(125);
    expect(filterLength(125, 0.2)).toBe(25);
  });

  it("lowpass coefficients match the fixture", () => {
    const coefs = designLowpass(fx.fs, fx.lowpass.fHi, fx.lowpass.nSeconds);
    expect(coefs.length).toBe(fx.lowpass.coefs.length);
    expect(maxAbsDiff(coefs, fx.lowpass.coefs)).toBeLessThan(1e-9);
  });

  it("bandstop coefficients match the fixture", () => {
    const coefs = designBandstop(fx.fs, fx.bandstop.fRange, fx.bandstop.nSeconds);
    expect(coefs.length).toBe(fx.bandstop.coefs.length);
    expect(maxAbsDiff(coefs, fx.bandstop.coefs)).toBeLessThan(1e-9);
  });

  it("has unity gain at DC (lowpass) and at Nyquist (highpass)", () => {
    const lp = firwin(51, 30, 250);
    expect(lp.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    const hp = firwin(51, 30, 250, false);
    let g = 0;
    for (let i = 0; i < hp.length; i++) g += hp[i] * (i % 2 ? -1 : 1);
    expect(Math.abs(g)).toBeCloseTo(1, 12);
  });
});

describe("convolveSame (np.convolve mode='same')", () => {
  it("centres an odd kernel", () => {
    const y = convolveSame([1, 2, 3, 4, 5], [1, 0, 0]);
    expect(Array.from(y)).toEqual([2, 3, 4, 5, 0]);
    const z = convolveSame([1, 2, 3, 4, 5], [0, 0, 1]);
    expect(Array.from(z)).toEqual([0, 1, 2, 3, 4]);
  });

  it("lowpass output matches the fixture", () => {
    const y = convolveSame(fx.xa, fx.lowpass.coefs);
    expect(maxAbsDiff(y, fx.lowpass.y)).toBeLessThan(1e-3);
  });

  it("bandstop output matches the fixture", () => {
    const y = convolveSame(fx.xa, fx.bandstop.coefs);
    expect(maxAbsDiff(y, fx.bandstop.y)).toBeLessThan(1e-3);
  });
});

describe("welch / coherence (scipy defaults)", () => {
  // The fixture's spectra were computed from the unrounded slice, while xa/xb are stored at
  // 4 dp.  SciPy itself, re-run on the rounded arrays, lands 3.3e-4 (relative, Welch — the
  // 2.6e-5 µV²/Hz Nyquist bin is the sensitive one) and 7.3e-5 (absolute, coherence) away from
  // the fixture, so those are the floors a bit-exact port can reach.
  it("welch frequencies and densities match the fixture", () => {
    const { f, p } = welch(fx.xa, fx.fs, fx.welch.nperseg);
    expect(maxAbsDiff(f, fx.welch.f)).toBeLessThan(1e-9);
    expect(maxRelDiff(p, fx.welch.p)).toBeLessThan(5e-4);
    // the bins with real power in them (> 1 µV²/Hz) agree much tighter (SciPy on the rounded input: 2.8e-6)
    let mRel = 0;
    for (let k = 0; k < p.length; k++) {
      if (fx.welch.p[k] > 1) mRel = Math.max(mRel, Math.abs(p[k] - fx.welch.p[k]) / fx.welch.p[k]);
    }
    expect(mRel).toBeLessThan(1e-5);
  });

  it("coherence matches the fixture", () => {
    const { f, cxy } = coherence(fx.xa, fx.xb, fx.fs, fx.coherence.nperseg);
    expect(maxAbsDiff(f, fx.coherence.f)).toBeLessThan(1e-9);
    expect(maxAbsDiff(cxy, fx.coherence.cxy)).toBeLessThan(1e-4);
  });

  it("coherence of a signal with itself is 1 and it is bounded in [0, 1]", () => {
    const { cxy } = coherence(fx.xa, fx.xa, fx.fs, 256);
    for (const c of cxy) expect(c).toBeCloseTo(1, 9);
    const { cxy: c2 } = coherence(fx.xa, fx.xb, fx.fs, 128);
    for (const c of c2) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1 + 1e-12);
    }
  });

  it("bandPeaks finds one peak per band", () => {
    const { f, cxy } = coherence(fx.xa, fx.xb, fx.fs, 256);
    const peaks = bandPeaks(f, cxy);
    expect(peaks.map((p) => p.label)).toEqual(["δ", "θ", "α", "β"]);
    for (const p of peaks) {
      expect(p.peak).not.toBeNull();
      expect(p.peak!.f).toBeGreaterThanOrEqual(p.lo);
      expect(p.peak!.f).toBeLessThan(p.hi);
    }
  });
});

describe("pipeline helpers", () => {
  it("lowpassDecimate halves the sample count", () => {
    const y = lowpassDecimate(fx.xa, fx.fs, 2);
    expect(y.length).toBe(Math.ceil(fx.xa.length / 2));
    // the retained samples are the lowpassed signal at even indices
    const low = convolveSame(fx.xa, fx.lowpass.coefs);
    expect(y[100]).toBeCloseTo(low[200], 9);
  });

  it("commonAverage leaves a zero mean across channels", () => {
    const a = Float32Array.from(fx.xa);
    const b = Float32Array.from(fx.xb);
    const c = Float32Array.from(fx.xa, (v) => v * 0.5 + 3);
    const out = commonAverage([a, b, c]);
    expect(out.length).toBe(3);
    for (let i = 0; i < a.length; i += 97) {
      expect(out[0][i] + out[1][i] + out[2][i]).toBeCloseTo(0, 3);
    }
    // inputs untouched
    expect(a[10]).toBeCloseTo(fx.xa[10], 3);
  });

  // The notebook's notch (58–62 Hz, 0.5 s Hamming FIR) has a ~6.6 Hz transition width at
  // 250 Hz, wider than its 4 Hz stop band, so scipy.signal.freqz puts it at −16.0 dB at 60 Hz
  // (−16.5 dB at 125 Hz).  That is what the port must reproduce — not a deeper notch.
  it("notch60 attenuates a synthetic 60 Hz tone by more than 12 dB and leaves 10 Hz alone", () => {
    const fsHz = 250;
    const n = 2500;
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = Math.sin((2 * Math.PI * 60 * i) / fsHz) + 0.5 * Math.sin((2 * Math.PI * 10 * i) / fsHz);
    const y = notch60(x, fsHz);
    const before = welch(x, fsHz, 256);
    const after = welch(y, fsHz, 256);
    const k60 = before.f.findIndex((f) => Math.abs(f - 60) < 0.5);
    const k10 = before.f.findIndex((f) => Math.abs(f - 10) < 0.5);
    expect(k60).toBeGreaterThan(0);
    const dropDb = 10 * Math.log10(before.p[k60] / after.p[k60]);
    expect(dropDb).toBeGreaterThan(12);
    expect(dropDb).toBeLessThan(20);
    // and the 10 Hz component survives
    expect(after.p[k10] / before.p[k10]).toBeGreaterThan(0.9);
  });
});
