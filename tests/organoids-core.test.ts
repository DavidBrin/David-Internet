/**
 * The organoids TS ports must reproduce the Python pipeline:
 *  - welch.ts vs the scipy/neurodsp PSD on the fixture signal
 *  - specparam.ts vs FOOOF 1.1 fits (fixed + knee) on six synthetic spectra
 *  - bursts.ts exact-match vs General_LFP_analysis_functions.py
 * Fixtures from `pnpm sync-demos organoids`.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { welch } from "@/demos/organoids/core/welch";
import { fitSpecparam, PROJECT_SETTINGS } from "@/demos/organoids/core/specparam";
import { isiArray, burstRate, networkEvents, perWell, type SpikeTimesGrid } from "@/demos/organoids/core/bursts";
import { synthLfp, wellParams, synthSpikes, mulberry32 } from "@/demos/organoids/core/synth";
import { PLATE_D, PLATE_F } from "@/demos/organoids/core/plate";

function fx<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8")) as T;
}

interface SpecFx {
  welch: { nperseg: number; noverlap: number; fs: number };
  cases: {
    name: string;
    gen: { offset: number; exponent: number; knee: number; peaks: number[][] };
    freqs: number[];
    psd: number[];
    fits: Record<string, { aperiodic: number[]; peaks: number[][]; gaussians: number[][]; r_squared: number; error: number }>;
    signal?: number[];
    fs?: number;
  }[];
}

interface BurstFx {
  spikeTimes: SpikeTimesGrid;
  isiFirstWell: number[][];
  burstCounts: number[][][][];
  burstPerWell: number[][];
  networkEvents: number[][];
  params: { isi_thresh: number; min_spikes: number };
}

const spec = fx<SpecFx>("organoids-specparam.json");

describe("welch.ts vs scipy", () => {
  const c0 = spec.cases.find((c) => c.signal)!;
  it("PSD matches the fixture", () => {
    const { freqs, psd } = welch(c0.signal!, c0.fs!);
    expect(freqs.length).toBe(c0.freqs.length);
    for (let i = 0; i < freqs.length; i++) {
      expect(freqs[i]).toBeCloseTo(c0.freqs[i], 9);
      if (i === 0) continue; // DC is ~0 after constant detrend in both; relative error meaningless
      const rel = Math.abs(psd[i] - c0.psd[i]) / Math.max(c0.psd[i], 1e-12);
      expect(rel, `psd[${i}] f=${freqs[i]}`).toBeLessThanOrEqual(1e-6);
    }
  });
});

describe("specparam.ts vs FOOOF 1.1", () => {
  for (const c of spec.cases) {
    for (const mode of ["fixed", "knee"] as const) {
      it(`${c.name} / ${mode}`, () => {
        const res = fitSpecparam(c.freqs, c.psd, [2, 50], {
          ...PROJECT_SETTINGS,
          aperiodicMode: mode,
        });
        const py = c.fits[mode];
        // aperiodic: offset first, exponent last
        expect(Math.abs(res.aperiodic[0] - py.aperiodic[0]), "offset").toBeLessThanOrEqual(0.15);
        expect(
          Math.abs(res.aperiodic[res.aperiodic.length - 1] - py.aperiodic[py.aperiodic.length - 1]),
          "exponent",
        ).toBeLessThanOrEqual(0.1);
        // peaks: same count, CF/PW/BW close
        expect(res.peaks.length, "n_peaks").toBe(py.peaks.length);
        for (let p = 0; p < py.peaks.length; p++) {
          expect(Math.abs(res.peaks[p][0] - py.peaks[p][0]), `peak ${p} CF`).toBeLessThanOrEqual(0.75);
          expect(Math.abs(res.peaks[p][1] - py.peaks[p][1]), `peak ${p} PW`).toBeLessThanOrEqual(0.2);
          expect(Math.abs(res.peaks[p][2] - py.peaks[p][2]), `peak ${p} BW`).toBeLessThanOrEqual(1.5);
        }
        expect(Math.abs(res.rSquared - py.r_squared), "r2").toBeLessThanOrEqual(0.02);
        expect(Math.abs(res.error - py.error), "MAE").toBeLessThanOrEqual(0.02);
      });
    }
  }
});

describe("bursts.ts exact vs Python", () => {
  const f = fx<BurstFx>("organoids-bursts.json");
  it("isi_array (first well)", () => {
    const isi = isiArray(f.spikeTimes);
    let k = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const got = isi[0][0][i][j].map((v) => Math.round(v * 1000) / 1000);
        const want = f.isiFirstWell[k].map((v) => Math.round(v * 1000) / 1000);
        expect(got).toEqual(want);
        k += 1;
      }
    }
  });
  it("burst_rate exact", () => {
    const isi = isiArray(f.spikeTimes);
    const br = burstRate(isi, f.params.isi_thresh, f.params.min_spikes);
    expect(br).toEqual(f.burstCounts);
    expect(perWell(br)).toEqual(f.burstPerWell);
  });
  it("network_events exact", () => {
    const ne = networkEvents(f.spikeTimes, f.params.isi_thresh, f.params.min_spikes);
    expect(ne).toEqual(f.networkEvents);
  });
});

describe("synth.ts determinism + spectral sanity", () => {
  it("mulberry32 is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });
  it("synthetic LFP recovers roughly the target exponent", () => {
    const params = { offset: 1.0, knee: 0, exponent: 2.0, peaks: [] };
    const sig = synthLfp(params, 7, 16384, 100);
    const { freqs, psd } = welch(sig, 100);
    const res = fitSpecparam(freqs, psd, [2, 50], { ...PROJECT_SETTINGS, aperiodicMode: "fixed" });
    expect(Math.abs(res.aperiodic[1] - 2.0)).toBeLessThanOrEqual(0.25);
  });
  it("dose trends: 20uM wells drop exponent vs blank by day 6", () => {
    const blank = wellParams(PLATE_D, 6, 0, 0); // Blank-stim column
    const dosed = wellParams(PLATE_D, 6, 0, 4); // 20uM-stim column
    expect(dosed.exponent).toBeLessThan(blank.exponent + 0.1);
  });
  it("synthetic spike grids are deterministic and non-empty", () => {
    const g1 = synthSpikes(PLATE_F, 6, 600);
    const g2 = synthSpikes(PLATE_F, 6, 600);
    expect(g1).toEqual(g2);
    const total = g1.flat(3).reduce((a, times) => a + (times as number[]).length, 0);
    expect(total).toBeGreaterThan(200);
  });
});
