"use client";

/**
 * Lazy, chunked FOOOF (knee mode) fits for the boxplot's 48 wells.
 *
 * Same pipeline as chapter 3: synthLfp(wellParams(...)) -> welch -> fitSpecparam
 * with aperiodicMode "knee" (chapter 4 is the knee-mode chapter). A 48-well
 * fit is real work (FFT + Levenberg-Marquardt per well), so results are
 * cached in a module-level Map keyed `day:r:c` — switching the boxplot
 * parameter or revisiting a day already computed is instant — and a fresh
 * day is fit a few wells per setTimeout tick so the main thread (and the
 * raster's own rAF loop) stays responsive.
 */
import { useEffect, useRef, useState } from "react";
import { PLATE_F } from "../core/plate";
import { hashSeed, synthLfp, wellParams } from "../core/synth";
import { welch } from "../core/welch";
import { fitSpecparam, PROJECT_SETTINGS } from "../core/specparam";

export interface WellSpectral {
  offset: number;
  exponent: number;
  peakCf: number | null;
  peakPower: number | null;
}

const cache = new Map<string, WellSpectral>();

function computeWell(day: number, r: number, c: number): WellSpectral {
  const params = wellParams(PLATE_F, day, r, c);
  const seed = hashSeed("ch4", day, r, c);
  const sig = synthLfp(params, seed, 8192, 100);
  const { freqs, psd } = welch(sig, 100);
  const fit = fitSpecparam(freqs, psd, [2, 50], { ...PROJECT_SETTINGS, aperiodicMode: "knee" });
  let peakCf: number | null = null;
  let peakPower: number | null = null;
  for (const p of fit.peaks) {
    if (peakPower === null || p[1] > peakPower) {
      peakCf = p[0];
      peakPower = p[1];
    }
  }
  return {
    offset: fit.aperiodic[0],
    exponent: fit.aperiodic[fit.aperiodic.length - 1],
    peakCf,
    peakPower,
  };
}

const WELLS: [number, number][] = (() => {
  const list: [number, number][] = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) list.push([r, c]);
  return list;
})();

const CHUNK_SIZE = 3;

/** Wells fit so far for `day`, plus whether the full 48-well grid is done. */
export function useSpectralGrid(day: number): { grid: (WellSpectral | undefined)[][]; done: boolean; progress: number } {
  const [, bump] = useState(0);
  const doneRef = useRef(false);
  const progressRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let idx = 0;
    doneRef.current = false;

    function step() {
      if (cancelled) return;
      let didWork = false;
      for (let n = 0; n < CHUNK_SIZE && idx < WELLS.length; n++, idx++) {
        const [r, c] = WELLS[idx];
        const key = `${day}:${r}:${c}`;
        if (!cache.has(key)) {
          cache.set(key, computeWell(day, r, c));
          didWork = true;
        }
      }
      progressRef.current = idx / WELLS.length;
      if (idx < WELLS.length) {
        if (didWork) bump((t) => t + 1);
        setTimeout(step, 0);
      } else {
        doneRef.current = true;
        bump((t) => t + 1);
      }
    }
    setTimeout(step, 0);
    return () => {
      cancelled = true;
    };
  }, [day]);

  const grid: (WellSpectral | undefined)[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: (WellSpectral | undefined)[] = [];
    for (let c = 0; c < 8; c++) row.push(cache.get(`${day}:${r}:${c}`));
    grid.push(row);
  }
  return { grid, done: doneRef.current, progress: progressRef.current };
}
