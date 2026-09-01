/**
 * The tau threshold — exact TS port of the group's
 * graph.py choose_tau_from_percentile, plus edge filtering helpers for the
 * live slider (fixture: tests/fixtures/arxiv-tau.json).
 */

/**
 * bins: histogram bin edges (len k+1), counts: per-bin counts (len k).
 * Returns the bin edge just above the pkeep percentile — including the
 * original's `searchsorted` + `idx + 1` behavior.
 */
export function chooseTauFromPercentile(bins: number[], counts: number[], pkeep: number): number {
  const total = Math.max(
    counts.reduce((a, b) => a + b, 0),
    1
  );
  let cum = 0;
  // np.searchsorted(cdf, pkeep) — first index where cdf[idx] >= pkeep
  let idx = counts.length; // if never reached
  for (let i = 0; i < counts.length; i++) {
    cum += counts[i];
    if (cum / total >= pkeep) {
      idx = i;
      break;
    }
  }
  return bins[Math.min(idx + 1, bins.length - 1)];
}

export interface GraphEdges {
  /** [src, dst, dist] sorted ascending is not guaranteed — treat as a set */
  edges: [number, number, number][];
}

/** Count edges and per-node degree at a given tau. */
export function edgeStatsAtTau(
  n: number,
  edges: [number, number, number][],
  tau: number
): { edges: number; avgDegree: number; isolated: number } {
  const deg = new Int32Array(n);
  let m = 0;
  for (const [a, b, d] of edges) {
    if (d <= tau) {
      deg[a]++;
      deg[b]++;
      m++;
    }
  }
  let isolated = 0;
  for (let i = 0; i < n; i++) if (deg[i] === 0) isolated++;
  return { edges: m, avgDegree: (2 * m) / n, isolated };
}
