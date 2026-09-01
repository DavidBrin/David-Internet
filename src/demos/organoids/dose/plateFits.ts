/**
 * Chapter 3 — per-day plate fits. For a given day, 48 wells each get a FOOOF fit
 * (mirrors param_heatmap in the real notebooks). Fits are cheap (a few ms) but 48
 * of them can still be felt as a hitch, so callers compute a day's fits lazily and
 * in chunks (see ensureDayFits) and everything is cached module-wide keyed
 * `day:row:col` so scrubbing back to an already-visited day is instant.
 */
import { synthLfp, wellParams, hashSeed } from "../core/synth";
import { welch } from "../core/welch";
import { fitSpecparam, PROJECT_SETTINGS, type SpecparamResult } from "../core/specparam";
import { PLATE_D } from "../core/plate";

export interface WellFit {
  offset: number;
  exponent: number;
  /** PW of the tallest peak, 0 when the well has none. */
  peakPower: number;
  result: SpecparamResult;
}

export type HeatmapParam = "offset" | "exponent" | "peak";

export function paramValue(fit: WellFit, param: HeatmapParam): number {
  if (param === "offset") return fit.offset;
  if (param === "exponent") return fit.exponent;
  return fit.peakPower;
}

export const PARAM_DOMAIN: Record<HeatmapParam, [number, number]> = {
  offset: [0.3, 1.3],
  exponent: [1.1, 2.6],
  peak: [0, 1.2],
};

export const PARAM_LABEL: Record<HeatmapParam, string> = {
  offset: "offset",
  exponent: "exponent",
  peak: "peak power",
};

const cache = new Map<string, WellFit>();

function key(day: number, r: number, c: number): string {
  return `${day}:${r}:${c}`;
}

function computeWellFit(day: number, r: number, c: number): WellFit {
  const params = wellParams(PLATE_D, day, r, c);
  const sig = synthLfp(params, hashSeed("ch3", day, r, c), 8192, 100);
  const { freqs, psd } = welch(sig, 100);
  const result = fitSpecparam(freqs, psd, [2, 50], { ...PROJECT_SETTINGS, aperiodicMode: "fixed" });
  const [offset, exponent] = result.aperiodic;
  let peakPower = 0;
  for (const p of result.peaks) if (p[1] > peakPower) peakPower = p[1];
  return { offset, exponent, peakPower, result };
}

export function getCachedFit(day: number, r: number, c: number): WellFit | undefined {
  return cache.get(key(day, r, c));
}

export function cachedCountForDay(day: number): number {
  let n = 0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) if (cache.has(key(day, r, c))) n++;
  return n;
}

/**
 * Ensures every well of `day` is fitted, computing missing wells 8 at a time on
 * setTimeout(0) ticks so the main thread stays responsive. `onProgress` fires after
 * each chunk (including synchronously-empty runs) so callers can re-render.
 * Returns a cancel function to call on unmount / day change.
 */
export function ensureDayFits(day: number, onProgress: () => void): () => void {
  const missing: [number, number][] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 8; c++) {
      if (!cache.has(key(day, r, c))) missing.push([r, c]);
    }
  }
  if (missing.length === 0) return () => {};

  let cancelled = false;
  let i = 0;
  const CHUNK = 8;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function tick() {
    if (cancelled) return;
    const end = Math.min(i + CHUNK, missing.length);
    for (; i < end; i++) {
      const [r, c] = missing[i];
      cache.set(key(day, r, c), computeWellFit(day, r, c));
    }
    onProgress();
    if (i < missing.length) timer = setTimeout(tick, 0);
  }
  timer = setTimeout(tick, 0);
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
