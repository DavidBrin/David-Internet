/**
 * Louvain community detection + modularity for the semantic graph —
 * TS counterpart of the group's graph_clustering.run_louvain (NetworkX).
 *
 * Modularity is the exact NetworkX formula (weighted); the Louvain heuristic is
 * a deterministic two-phase implementation (fixed node order — no RNG), tested
 * to land within a small margin of the NetworkX seed-42 run's Q on the shipped
 * graph (tests/fixtures/arxiv-louvain.json).
 */

export interface WEdge {
  a: number;
  b: number;
  w: number;
}

/** Weighted modularity of a labeling — matches networkx.quality.modularity. */
export function modularity(n: number, edges: WEdge[], labels: Int32Array | number[]): number {
  let m2 = 0; // 2m = sum of degrees = 2 * total edge weight
  const deg = new Float64Array(n);
  for (const e of edges) {
    deg[e.a] += e.w;
    deg[e.b] += e.w;
    m2 += 2 * e.w;
  }
  if (m2 === 0) return 0;
  const inW = new Map<number, number>();
  const totW = new Map<number, number>();
  for (const e of edges) {
    if (labels[e.a] === labels[e.b]) inW.set(labels[e.a] as number, (inW.get(labels[e.a] as number) ?? 0) + e.w);
  }
  for (let v = 0; v < n; v++) totW.set(labels[v] as number, (totW.get(labels[v] as number) ?? 0) + deg[v]);
  let q = 0;
  for (const [c, tot] of totW) {
    const internal = inW.get(c) ?? 0;
    q += (2 * internal) / m2 - (tot / m2) ** 2;
  }
  return q;
}

interface Adj {
  nbr: Int32Array;
  w: Float64Array;
  start: Int32Array; // CSR offsets, length n+1
}

function buildAdj(n: number, edges: WEdge[]): Adj {
  const count = new Int32Array(n);
  for (const e of edges) {
    count[e.a]++;
    count[e.b]++;
  }
  const start = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) start[i + 1] = start[i] + count[i];
  const nbr = new Int32Array(start[n]);
  const w = new Float64Array(start[n]);
  const cursor = Int32Array.from(start.subarray(0, n));
  for (const e of edges) {
    nbr[cursor[e.a]] = e.b;
    w[cursor[e.a]++] = e.w;
    nbr[cursor[e.b]] = e.a;
    w[cursor[e.b]++] = e.w;
  }
  return { nbr, w, start };
}

export interface LouvainResult {
  labels: Int32Array;
  modularity: number;
  nCommunities: number;
  /** number of level passes performed */
  levels: number;
}

/**
 * Deterministic Louvain. Nodes are visited in index order each sweep; a node
 * moves to the neighbouring community with the largest positive gain.
 */
export function louvain(nIn: number, edgesIn: WEdge[], maxLevels = 12): LouvainResult {
  // current mapping from original node -> community label
  const mapping = new Int32Array(nIn);
  for (let i = 0; i < nIn; i++) mapping[i] = i;

  let n = nIn;
  let edges = edgesIn;
  let levels = 0;

  for (let level = 0; level < maxLevels; level++) {
    const adj = buildAdj(n, edges);
    const deg = new Float64Array(n);
    let m2 = 0;
    for (const e of edges) {
      deg[e.a] += e.w;
      deg[e.b] += e.w;
      m2 += 2 * e.w;
      if (e.a === e.b) {
        // self loop from aggregation: counts twice in degree
        deg[e.a] += e.w * 0; // (already added once per endpoint above)
      }
    }
    if (m2 === 0) break;

    const comm = new Int32Array(n);
    for (let i = 0; i < n; i++) comm[i] = i;
    const commTot = Float64Array.from(deg);
    let moved = true;
    let sweeps = 0;
    let anyMove = false;
    while (moved && sweeps < 40) {
      moved = false;
      sweeps++;
      for (let v = 0; v < n; v++) {
        const cv = comm[v];
        // weights from v to each neighbouring community (self loops excluded)
        const nbrW = new Map<number, number>();
        let selfLoop = 0;
        for (let ptr = adj.start[v]; ptr < adj.start[v + 1]; ptr++) {
          const u = adj.nbr[ptr];
          if (u === v) {
            selfLoop += adj.w[ptr];
            continue;
          }
          const cu = comm[u];
          nbrW.set(cu, (nbrW.get(cu) ?? 0) + adj.w[ptr]);
        }
        commTot[cv] -= deg[v];
        const wOwn = nbrW.get(cv) ?? 0;
        let bestC = cv;
        let bestGain = wOwn - (commTot[cv] * deg[v]) / m2;
        for (const [c, wc] of nbrW) {
          if (c === cv) continue;
          const gain = wc - (commTot[c] * deg[v]) / m2;
          if (gain > bestGain + 1e-12 || (Math.abs(gain - bestGain) <= 1e-12 && c < bestC)) {
            bestGain = gain;
            bestC = c;
          }
        }
        commTot[bestC] += deg[v];
        if (bestC !== cv) {
          comm[v] = bestC;
          moved = true;
          anyMove = true;
        }
      }
    }
    levels++;
    if (!anyMove) break;

    // relabel communities compactly
    const relabel = new Map<number, number>();
    for (let v = 0; v < n; v++) {
      if (!relabel.has(comm[v])) relabel.set(comm[v], relabel.size);
    }
    const nNew = relabel.size;
    for (let i = 0; i < nIn; i++) mapping[i] = relabel.get(comm[mapping[i]])!;
    if (nNew === n) break;

    // aggregate the graph
    const agg = new Map<number, number>();
    for (const e of edges) {
      const a = relabel.get(comm[e.a])!;
      const b = relabel.get(comm[e.b])!;
      const key = a <= b ? a * nNew + b : b * nNew + a;
      agg.set(key, (agg.get(key) ?? 0) + e.w);
    }
    edges = Array.from(agg, ([key, w]) => ({
      a: Math.floor(key / nNew),
      b: key % nNew,
      w,
    }));
    n = nNew;
  }

  const q = modularity(nIn, edgesIn, mapping);
  let nComm = 0;
  const seen = new Set<number>();
  for (let i = 0; i < nIn; i++) seen.add(mapping[i]);
  nComm = seen.size;
  return { labels: mapping, modularity: q, nCommunities: nComm, levels };
}
