/**
 * The TS spikeparam port must reproduce the real pipeline on the shipped
 * sweeps: detection indices exactly, control points and features within
 * tolerance of the Python fits (fixtures from `pnpm sync-demos spikes`).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decodeI16, type SweepsJson } from "@/demos/spikes/core/data";
import { fitSweep, PROJECT_FIT } from "@/demos/spikes/core/spike";
import { simGaussianSpike, skgFromArray } from "@/demos/spikes/core/skg";
import { simPatch } from "@/demos/spikes/core/patchSim";

function fx<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8")) as T;
}
function pub<T>(name: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public", "demos", "spikes", name), "utf8"),
  ) as T;
}

interface FitFx {
  sweep: string;
  fs: number;
  spikeInds: number[];
  indices: number[][];
  rampPoly: number[][];
  rampAmp: number[];
  inflectionTime: number[];
  inflectionAmp: number[];
  peakAmp: number[];
  peakWidth: number[];
  peakSharpness: number[];
  expAmp: number[];
  expLambda: number[];
  expConst: number[];
  r2Ramp: number[];
  r2Exp: number[];
  isi: number[];
  indsError: number[];
}

interface SkgFx {
  n: number;
  meanSpike: number[];
  params: number[];
  fit: number[];
  gaussA: number[];
  gaussB: number[];
  r2: number;
}

const fixtures = fx<FitFx>("spikes-fit.json") as unknown as FitFx[];
const sweepsJson = pub<SweepsJson>("sweeps.json");

describe("fitSweep vs spikeparam (Python) on the shipped sweeps", () => {
  for (const f of fixtures) {
    const ship = sweepsJson.sweeps.find((s) => s.id === f.sweep);
    it(`${f.sweep}: detection matches exactly`, () => {
      expect(ship).toBeDefined();
      const sig = decodeI16(ship!.mv_q);
      const fit = fitSweep(sig, f.fs, PROJECT_FIT);
      expect(fit.spikes.map((s) => s.peakInd)).toEqual(f.spikeInds);
    });

    it(`${f.sweep}: control points + features within tolerance`, () => {
      const sig = decodeI16(ship!.mv_q);
      const fit = fitSweep(sig, f.fs, PROJECT_FIT);
      const errorSet = new Set(f.indsError);
      let compared = 0;
      for (let i = 0; i < fit.spikes.length; i++) {
        const spk = fit.spikes[i];
        if (errorSet.has(i)) {
          // Python failed this spike; the port may or may not — skip
          continue;
        }
        expect(spk.features, `spike ${i} failed in TS but not Python`).not.toBeNull();
        const ft = spk.features!;
        const pyIdx = f.indices[i];
        const tsIdx = [
          ft.indices.rampStart, ft.indices.inflection, ft.indices.rise,
          ft.indices.peak, ft.indices.decay, ft.indices.expStart, ft.indices.expEnd,
        ];
        for (let k = 0; k < 7; k++) {
          expect(Math.abs(tsIdx[k] - pyIdx[k]), `spike ${i} index ${k}`).toBeLessThanOrEqual(2);
        }
        // exact-index-dependent features get looser tolerance when indices shift
        const shifted = tsIdx.some((v, k) => v !== pyIdx[k]);
        const relTol = shifted ? 0.15 : 0.02;
        const close = (a: number, b: number, what: string, rel = relTol, absFloor = 0.05) => {
          const diff = Math.abs(a - b);
          const scale = Math.max(Math.abs(b), absFloor);
          expect(diff / scale, `spike ${i} ${what}: ts=${a} py=${b}`).toBeLessThanOrEqual(rel);
        };
        close(ft.peak.peakAmp, f.peakAmp[i], "peakAmp", shifted ? 0.05 : 1e-9, 1);
        close(ft.peak.peakWidth, f.peakWidth[i], "peakWidth");
        close(ft.ramp.inflectionTime, f.inflectionTime[i], "inflectionTime");
        close(ft.ramp.inflectionAmp, f.inflectionAmp[i], "inflectionAmp", relTol, 5);
        close(ft.exp.expLambda, f.expLambda[i], "expLambda", 0.05, 0.05);
        close(ft.exp.expConst, f.expConst[i], "expConst", 0.05, 5);
        expect(Math.abs(ft.r2Exp - f.r2Exp[i]), `spike ${i} r2Exp`).toBeLessThanOrEqual(0.02);
        compared += 1;
      }
      expect(compared).toBeGreaterThan(0);
    });

    it(`${f.sweep}: ISI matches`, () => {
      const sig = decodeI16(ship!.mv_q);
      const fit = fitSweep(sig, f.fs, PROJECT_FIT);
      for (let i = 0; i < fit.spikes.length; i++) {
        const py = f.isi[i];
        const ts = fit.spikes[i].isi;
        if (py === -1) {
          expect(Number.isNaN(ts)).toBe(true);
        } else {
          expect(ts).toBeCloseTo(py, 6);
        }
      }
    });
  }
});

describe("skewed-gaussian model vs Python", () => {
  const f = fx<SkgFx>("spikes-skg.json");
  it("sim_gaussian_spike reproduces the fitted curve", () => {
    const { total, a, b } = simGaussianSpike(f.n, skgFromArray(f.params));
    let maxErr = 0;
    for (let i = 0; i < f.n; i++) {
      maxErr = Math.max(maxErr, Math.abs(total[i] - f.fit[i]));
      expect(Math.abs(a[i] - f.gaussA[i])).toBeLessThanOrEqual(0.01);
      expect(Math.abs(b[i] - f.gaussB[i])).toBeLessThanOrEqual(0.01);
    }
    expect(maxErr).toBeLessThanOrEqual(0.01);
  });
  it("the fit explains the mean spike (r2 from prep)", () => {
    expect(f.r2).toBeGreaterThan(0.95);
  });
});

describe("simPatch", () => {
  it("stitches spikes with hyperpolarization and correct length", () => {
    const spike = new Float64Array(101);
    // asymmetric spike: starts at rest (-60), ends mid-decay (-50)
    for (let i = 0; i < 101; i++) {
      spike[i] = -60 + 80 * Math.exp(-((i - 50) ** 2) / 40) + (10 * i) / 100;
    }
    const sig = simPatch([spike, spike, spike], [200, 200], 60);
    expect(sig.length).toBe(3 * 101 + 2 * 200 + 200); // last isi appended (mean)
    // between spikes the trace dips below the next spike's start, then recovers to it
    const between = Array.from(sig.slice(101, 301));
    expect(Math.min(...between)).toBeLessThan(-60);
    expect(between[between.length - 1]).toBeCloseTo(-60, 6);
  });
});
