/**
 * Direct ports of the spike-train analysis functions from
 * General_LFP_analysis_functions.py (David Brin, 2024-2025):
 * `isi_array`, `burst_rate`, `network_events`. Exact-match tested against
 * Python fixtures.
 *
 * spikeTimes is well-major: [6 rows][8 cols][4 elec rows][4 elec cols] → sorted
 * spike times in seconds (empty array = silent electrode).
 */

export type SpikeTimesGrid = number[][][][][];

export const N_ROWS = 6;
export const N_COLS = 8;
export const N_ELEC = 4;

/** Inter-spike intervals per electrode (np.diff of each electrode's times). */
export function isiArray(spikeTimes: SpikeTimesGrid): number[][][][][] {
  const out: number[][][][][] = [];
  for (let r = 0; r < N_ROWS; r++) {
    const rr: number[][][][] = [];
    for (let c = 0; c < N_COLS; c++) {
      const well: number[][][] = [];
      for (let i = 0; i < N_ELEC; i++) {
        const er: number[][] = [];
        for (let j = 0; j < N_ELEC; j++) {
          const st = spikeTimes[r][c][i][j];
          const isi: number[] = [];
          for (let k = 1; k < st.length; k++) isi.push(st[k] - st[k - 1]);
          er.push(isi);
        }
        well.push(er);
      }
      rr.push(well);
    }
    out.push(rr);
  }
  return out;
}

/** Burst counts per electrode: runs of >= minSpikes-1 consecutive ISIs < thresh. */
export function burstRate(
  isi: number[][][][][],
  isiThresh = 1.0,
  minSpikes = 3,
): number[][][][] {
  const out: number[][][][] = [];
  for (let r = 0; r < N_ROWS; r++) {
    const rr: number[][][] = [];
    for (let c = 0; c < N_COLS; c++) {
      const well: number[][] = [];
      for (let i = 0; i < N_ELEC; i++) {
        const er: number[] = [];
        for (let j = 0; j < N_ELEC; j++) {
          const vals = isi[r][c][i][j];
          let count = 0;
          let run = 0;
          for (const v of vals) {
            if (v < isiThresh) {
              run += 1;
            } else {
              if (run >= minSpikes - 1) count += 1;
              run = 0;
            }
          }
          if (vals.length > 0 && run >= minSpikes - 1) count += 1;
          er.push(count);
        }
        well.push(er);
      }
      rr.push(well);
    }
    out.push(rr);
  }
  return out;
}

/** Sum an electrode-level grid down to per-well counts. */
export function perWell(grid: number[][][][]): number[][] {
  return grid.map((row) =>
    row.map((well) => well.reduce((a, er) => a + er.reduce((b, v) => b + v, 0), 0)),
  );
}

/**
 * Network events per well: >= minSpikes spikes from *distinct electrodes*
 * within isiThresh seconds. Greedy sweep identical to the Python original.
 */
export function networkEvents(
  spikeTimes: SpikeTimesGrid,
  isiThresh = 1,
  minSpikes = 3,
): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < N_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < N_COLS; c++) {
      const events: { t: number; e: number }[] = [];
      for (let i = 0; i < N_ELEC; i++) {
        for (let j = 0; j < N_ELEC; j++) {
          for (const t of spikeTimes[r][c][i][j]) events.push({ t, e: i * N_ELEC + j });
        }
      }
      events.sort((a, b) => a.t - b.t || a.e - b.e);
      const used = new Set<number>();
      let count = 0;
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
          count += 1;
          for (const k of involved) used.add(k);
          i2 = Math.max(...involved) + 1;
        } else {
          i2 += 1;
        }
      }
      row.push(count);
    }
    out.push(row);
  }
  return out;
}
