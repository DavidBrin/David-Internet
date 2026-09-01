/**
 * Deterministic synthetic data generator for the organoids demo.
 *
 * ILLUSTRATIVE DATA ONLY — no lab recordings ship with this page. Every well's
 * LFP is colored noise with a dose/day-conditioned aperiodic exponent, knee,
 * and 1–2 oscillatory peaks, so the plate heatmaps *trend* the way the demo's
 * story needs, without claiming to be the real measurements. Panels label this.
 *
 * Seeded (mulberry32) so the page is identical on every load.
 */
import { fft } from "./fft";
import { PlateDef, doseKey } from "./plate";
import type { SpikeTimesGrid } from "./bursts";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

export interface WellSpectralParams {
  offset: number;
  knee: number;
  exponent: number;
  peaks: { cf: number; pw: number; bw: number }[];
}

/**
 * Dose/day-conditioned spectral parameters for one well. The *shape* of the
 * trends (exponent drifting with dose over days, theta/beta peaks on active
 * wells) is parameterized for the demo — illustrative, not measured.
 */
export function wellParams(plate: PlateDef, day: number, row: number, col: number): WellSpectralParams {
  const dose = doseKey(plate, row, col);
  const rng = mulberry32(hashSeed("well", plate.id, row, col));
  const base = 2.1 + (rng() - 0.5) * 0.5;
  const dayIdx = Math.max(0, plate.days.indexOf(day));
  const tCourse = dayIdx <= 0 ? 0 : Math.exp(-(dayIdx - 1) / 3.2) * Math.min(1, dayIdx);

  let doseShift = 0;
  if (dose.includes("20uM")) doseShift = -0.55;
  else if (dose.includes("10uM")) doseShift = -0.32;
  else if (dose === "Psilocybin") doseShift = -0.42;
  else if (dose === "LSD") doseShift = -0.5;
  else if (dose === "Psilocin") doseShift = -0.35;

  const stim = plate.doses[row][col].endsWith("-stim");
  const dayNoise = (mulberry32(hashSeed("day", plate.id, day, row, col))() - 0.5) * 0.18;
  const exponent = base + doseShift * tCourse + dayNoise;
  const offset = 0.9 + (rng() - 0.5) * 0.4 + 0.12 * doseShift * tCourse;
  const knee = 40 + rng() * 120;

  const peaks: { cf: number; pw: number; bw: number }[] = [];
  const rngP = mulberry32(hashSeed("peaks", plate.id, day, row, col));
  if (rngP() < (stim ? 0.85 : 0.55)) {
    peaks.push({ cf: 4.5 + rngP() * 4, pw: 0.5 + rngP() * 0.5, bw: 1.5 + rngP() * 1.2 });
  }
  if (rngP() < 0.45 - 0.25 * Math.abs(doseShift) * tCourse) {
    peaks.push({ cf: 16 + rngP() * 12, pw: 0.35 + rngP() * 0.35, bw: 2.5 + rngP() * 2 });
  }
  return { offset, knee, exponent, peaks };
}

/**
 * Colored-noise LFP for one well: spectral shaping of random phases via
 * IFFT (radix-2), plus stim-evoked bursts on stim rows. fs = 100 Hz.
 */
export function synthLfp(
  params: WellSpectralParams,
  seed: number,
  nSamples = 16384,
  fs = 100,
  stim = false,
): Float64Array {
  const rng = mulberry32(seed);
  const n = nSamples;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let k = 1; k <= n / 2; k++) {
    const f = (k * fs) / n;
    let target = Math.pow(10, params.offset) / (params.knee + Math.pow(f, params.exponent));
    for (const p of params.peaks) {
      target *= Math.pow(10, p.pw * Math.exp(-((f - p.cf) ** 2) / (2 * p.bw * p.bw)));
    }
    const amp = Math.sqrt(target);
    const ph = rng() * 2 * Math.PI;
    const cr = amp * Math.cos(ph);
    const ci = amp * Math.sin(ph);
    re[k] = cr;
    im[k] = ci;
    if (k < n / 2) {
      re[n - k] = cr;
      im[n - k] = -ci;
    }
  }
  fft(re, im, true);
  // normalize to unit std
  let mean = 0;
  for (let i = 0; i < n; i++) mean += re[i];
  mean /= n;
  let sd = 0;
  for (let i = 0; i < n; i++) sd += (re[i] - mean) ** 2;
  sd = Math.sqrt(sd / n) || 1;
  const sig = new Float64Array(n);
  for (let i = 0; i < n; i++) sig[i] = (re[i] - mean) / sd;

  if (stim) {
    // stim-evoked bursts: 8-12 Hz packets at random times
    const nB = 2 + Math.floor(rng() * 3);
    for (let b = 0; b < nB; b++) {
      const t0 = Math.floor(rng() * (n - 4 * fs));
      const dur = Math.floor((1 + rng()) * fs);
      const f0 = 8 + rng() * 4;
      for (let i = 0; i < dur; i++) {
        const env = Math.sin((Math.PI * i) / dur) ** 2;
        sig[t0 + i] += 1.6 * env * Math.sin((2 * Math.PI * f0 * i) / fs + rng());
      }
    }
  }
  return sig;
}

/**
 * Synthetic spike times for a full plate: Poisson baseline per electrode +
 * burst epochs + correlated network events on active wells. duration in s.
 */
export function synthSpikes(plate: PlateDef, day: number, duration = 600): SpikeTimesGrid {
  const grid: SpikeTimesGrid = [];
  for (let r = 0; r < 6; r++) {
    const rr: number[][][][] = [];
    for (let c = 0; c < 8; c++) {
      const rng = mulberry32(hashSeed("spk", plate.id, day, r, c));
      const dose = doseKey(plate, r, c);
      const active = rng() < (dose === "Blank" ? 0.25 : 0.75);
      const rateScale = dose.includes("20uM") || dose === "LSD" ? 1.5 : 1.0;
      // network event times for the well
      const events: number[] = [];
      if (active) {
        const nEv = Math.floor(rng() * 6 * rateScale);
        for (let e = 0; e < nEv; e++) events.push(rng() * duration);
      }
      const well: number[][][] = [];
      for (let i = 0; i < 4; i++) {
        const er: number[][] = [];
        for (let j = 0; j < 4; j++) {
          const times: number[] = [];
          if (active && rng() < 0.55) {
            const rate = (0.02 + rng() * 0.12) * rateScale; // Hz baseline
            let t = -Math.log(1 - rng()) / rate;
            while (t < duration) {
              times.push(t);
              t += -Math.log(1 - rng()) / rate;
            }
            // burst epochs
            const nBursts = Math.floor(rng() * 4);
            for (let b = 0; b < nBursts; b++) {
              let bt = rng() * (duration - 10);
              const nSp = 4 + Math.floor(rng() * 8);
              for (let s = 0; s < nSp; s++) {
                bt += 0.05 + rng() * 0.5;
                times.push(bt);
              }
            }
            // join network events
            for (const ev of events) {
              if (rng() < 0.5) {
                for (let s = 0; s < 2 + Math.floor(rng() * 3); s++) {
                  times.push(ev + rng() * 0.8);
                }
              }
            }
            times.sort((a, b) => a - b);
          }
          er.push(times.map((t) => Math.round(t * 1000) / 1000));
        }
        well.push(er);
      }
      rr.push(well);
    }
    grid.push(rr);
  }
  return grid;
}
