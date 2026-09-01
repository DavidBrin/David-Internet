/**
 * Burst / network-event *placement* detection for the raster.
 *
 * core/bursts.ts's `burstRate` and `networkEvents` are exact ports of the
 * Python analysis functions, but they only return counts — not the time
 * spans a raster needs to draw glow highlights. The functions below re-walk
 * the same runs/greedy-windows with the same thresholds and the same
 * pass/fail conditions, just also recording {t0, t1} for each hit.
 *
 * IMPORTANT: this file is for *drawing* only. Every count the panel shows
 * the user (readouts, chip text) is computed by calling burstRate /
 * networkEvents from core/bursts.ts directly — never by counting the
 * arrays produced here — and CompoundsPanel cross-checks
 * placements.length against the exact-port counts in a dev-only assertion.
 */
import { N_ROWS, N_COLS, N_ELEC, type SpikeTimesGrid } from "../core/bursts";

export interface TimeSpan {
  t0: number;
  t1: number;
}

export interface ElecBurstPlacement extends TimeSpan {
  elec: number; // 0..15, row-major within the 4x4 electrode grid
}

/** Per-well list of electrode bursts (mirrors burstRate's run-length rule). */
export function burstPlacements(
  spikeTimes: SpikeTimesGrid,
  isiThresh: number,
  minSpikes: number,
): ElecBurstPlacement[][][] {
  const out: ElecBurstPlacement[][][] = [];
  for (let r = 0; r < N_ROWS; r++) {
    const row: ElecBurstPlacement[][] = [];
    for (let c = 0; c < N_COLS; c++) {
      const placements: ElecBurstPlacement[] = [];
      for (let i = 0; i < N_ELEC; i++) {
        for (let j = 0; j < N_ELEC; j++) {
          const st = spikeTimes[r][c][i][j];
          const elec = i * N_ELEC + j;
          let run = 0;
          let runStart = -1;
          for (let k = 1; k < st.length; k++) {
            const isi = st[k] - st[k - 1];
            if (isi < isiThresh) {
              if (run === 0) runStart = k - 1;
              run += 1;
            } else {
              if (run >= minSpikes - 1) placements.push({ elec, t0: st[runStart], t1: st[runStart + run] });
              run = 0;
            }
          }
          if (run >= minSpikes - 1) placements.push({ elec, t0: st[runStart], t1: st[runStart + run] });
        }
      }
      row.push(placements);
    }
    out.push(row);
  }
  return out;
}

/** Per-well list of network events (mirrors networkEvents' greedy sweep). */
export function networkEventPlacements(
  spikeTimes: SpikeTimesGrid,
  isiThresh: number,
  minSpikes: number,
): TimeSpan[][][] {
  const out: TimeSpan[][][] = [];
  for (let r = 0; r < N_ROWS; r++) {
    const row: TimeSpan[][] = [];
    for (let c = 0; c < N_COLS; c++) {
      const events: { t: number; e: number }[] = [];
      for (let i = 0; i < N_ELEC; i++) {
        for (let j = 0; j < N_ELEC; j++) {
          for (const t of spikeTimes[r][c][i][j]) events.push({ t, e: i * N_ELEC + j });
        }
      }
      events.sort((a, b) => a.t - b.t || a.e - b.e);
      const used = new Set<number>();
      const placements: TimeSpan[] = [];
      let i2 = 0;
      while (i2 < events.length) {
        if (used.has(i2)) {
          i2 += 1;
          continue;
        }
        const t0 = events[i2].t;
        const electrodes = new Set<number>([events[i2].e]);
        const involved: number[] = [i2];
        let j2 = i2 + 1;
        while (j2 < events.length && events[j2].t - t0 <= isiThresh) {
          electrodes.add(events[j2].e);
          involved.push(j2);
          j2 += 1;
        }
        if (electrodes.size >= minSpikes) {
          let tMin = Infinity;
          let tMax = -Infinity;
          for (const k of involved) {
            if (events[k].t < tMin) tMin = events[k].t;
            if (events[k].t > tMax) tMax = events[k].t;
          }
          placements.push({ t0: tMin, t1: tMax });
          for (const k of involved) used.add(k);
          i2 = Math.max(...involved) + 1;
        } else {
          i2 += 1;
        }
      }
      row.push(placements);
    }
    out.push(row);
  }
  return out;
}
