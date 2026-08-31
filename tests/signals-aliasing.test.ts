import { describe, expect, it } from "vitest";
import { apparentFrequency, sampleAt, sincReconstruct, t2Of } from "@/demos/signals/aliasing/model";
import fixture from "./fixtures/signals-lab4.json";

describe("signals aliasing model (Lab 4 fixture)", () => {
  const { fs, f0, M, samples, fineT, reconstructed, aliasHz } = fixture as {
    fs: number;
    f0: number;
    M: number;
    samples: number[];
    fineT: number[];
    reconstructed: number[];
    aliasHz: number;
  };
  const fs2 = fs / M;
  const T2 = t2Of(M);

  it("reproduces the undersampled tone samples", () => {
    for (let n = 0; n < samples.length; n++) {
      expect(Math.abs(sampleAt(f0, fs2, n) - samples[n])).toBeLessThan(1e-12);
    }
  });

  it("sinc-reconstructs the fine-time waveform from the 64 samples", () => {
    const rec = sincReconstruct(samples, T2, 0, fineT);
    for (let i = 0; i < reconstructed.length; i++) {
      expect(Math.abs(rec[i] - reconstructed[i])).toBeLessThan(1e-9);
    }
  });

  it("computes the folded apparent frequency", () => {
    expect(apparentFrequency(f0, fs2)).toBe(aliasHz);
  });
});
