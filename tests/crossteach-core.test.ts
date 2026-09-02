/**
 * The crossteach TS ports must reproduce the Python pipeline's numbers on the
 * shipped data (fixture from `pnpm sync-demos crossteach`): the repo's
 * compute_metrics (macro dice/iou + pixel accuracy), the redesign's image-level
 * confidence gate, and evaluate_ensemble's logit averaging. Fixture values are
 * computed from the QUANTIZED shipped assets (label PNGs, uint8 confidence
 * maps, 4-dp-rounded logits) so the page and these tests see identical inputs.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeMetrics,
  ensembleArgmax,
  gatePasses,
  imageConfidence,
} from "@/demos/crossteach/core/metrics";

interface Fx {
  threshold: number;
  metrics: {
    name: string;
    pred: number[][];
    gt: number[][];
    expected: { dice: number; iou: number; pixelAccuracy: number };
  }[];
  gates: { name: string; mean: number; passes: boolean }[];
  ensemble: {
    name: string;
    unetLogits: number[][][];
    vitLogits: number[][][];
    expectedArgmax: number[][];
  }[];
}

const fx: Fx = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", "crossteach-core.json"), "utf8"),
);

describe("compute_metrics vs the Python pipeline", () => {
  for (const c of fx.metrics) {
    it(`${c.name}: dice/iou/acc match on the shipped 64x64 crop`, () => {
      const m = computeMetrics(c.pred.flat(), c.gt.flat());
      expect(m.dice).toBeCloseTo(c.expected.dice, 10);
      expect(m.iou).toBeCloseTo(c.expected.iou, 10);
      expect(m.pixelAccuracy).toBeCloseTo(c.expected.pixelAccuracy, 10);
    });
  }
});

describe("image-level confidence gate", () => {
  it("threshold matches the redesign's config", () => {
    expect(fx.threshold).toBe(0.75);
  });
  for (const g of fx.gates) {
    it(`${g.name}: gate decision matches`, () => {
      expect(gatePasses(g.mean, fx.threshold)).toBe(g.passes);
    });
  }
  it("imageConfidence averages a map", () => {
    expect(imageConfidence([0.5, 1.0, 0.75, 0.75])).toBeCloseTo(0.75, 12);
  });
});

describe("evaluate_ensemble logit averaging", () => {
  for (const e of fx.ensemble) {
    it(`${e.name}: argmax of averaged logits matches`, () => {
      expect(ensembleArgmax(e.unetLogits, e.vitLogits)).toEqual(e.expectedArgmax);
    });
  }
});
