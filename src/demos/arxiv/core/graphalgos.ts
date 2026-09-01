/**
 * Graph algorithm cards — TS ports for the karate-club panels:
 *
 * - nodeBetweenness: David's from-scratch betweenness from
 *   SocialNetworkGraphs.py — counts the interior nodes of ONE shortest path per
 *   ordered (source, target) pair, the path being exactly what
 *   nx.shortest_path returns (bidirectional BFS, adjacency insertion order),
 *   normalized by (n-1)(n-2)/2. Quirks reproduced faithfully.
 * - edgeBetweenness: Brandes' algorithm, normalized like networkx
 *   edge_betweenness_centrality (undirected: 1 / (n(n-1)) after double count).
 * - girvanNewmanStep: cut the max-betweenness edge (deterministic tie-break:
 *   lexicographically smallest edge — mirrored in the prep's fixture loop).
 * - jacobiEigen: cyclic Jacobi eigensolver for the Laplacian spectral card.
 *
 * Fixtures: tests/fixtures/arxiv-graphalgos.json.
 *
 * IMPORTANT: adjacency preserves edge-list insertion order (never sort) — the
 * shipped social.json edge order defines the same adjacency the Python fixture
 * run used, and nx's shortest-path choice depends on it.
 */

export type Edge = [number, number];

export function adjacency(n: number, edges: Edge[]): number[][] {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  }
  return adj;
}

/**
 * networkx bidirectional_shortest_path, faithfully: BFS from both ends,
 * expanding the smaller fringe, returning the FIRST meeting point found while
 * scanning in adjacency order. Returns the node path s..t, or null.
 */
export function bidirectionalShortestPath(adj: number[][], s: number, t: number): number[] | null {
  if (s === t) return [s];
  const pred = new Map<number, number>([[s, -1]]);
  const succ = new Map<number, number>([[t, -1]]);
  let forward = [s];
  let reverse = [t];
  let meet = -1;
  outer: while (forward.length && reverse.length) {
    if (forward.length <= reverse.length) {
      const level = forward;
      forward = [];
      for (const v of level) {
        for (const w of adj[v]) {
          if (!pred.has(w)) {
            forward.push(w);
            pred.set(w, v);
          }
          if (succ.has(w)) {
            meet = w;
            break outer;
          }
        }
      }
    } else {
      const level = reverse;
      reverse = [];
      for (const v of level) {
        for (const w of adj[v]) {
          if (!succ.has(w)) {
            succ.set(w, v);
            reverse.push(w);
          }
          if (pred.has(w)) {
            meet = w;
            break outer;
          }
        }
      }
    }
  }
  if (meet < 0) return null;
  const path: number[] = [];
  let v = meet;
  while (v !== -1) {
    path.unshift(v);
    v = pred.get(v)!;
  }
  v = succ.get(meet)!;
  while (v !== -1) {
    path.push(v);
    v = succ.get(v)!;
  }
  return path;
}

/** David's calculate_betweenness_centrality — exact port (one path per pair). */
export function nodeBetweenness(n: number, edges: Edge[]): Float64Array {
  const adj = adjacency(n, edges);
  const bc = new Float64Array(n);
  for (let s = 0; s < n; s++) {
    for (let t = 0; t < n; t++) {
      if (s === t) continue;
      const path = bidirectionalShortestPath(adj, s, t);
      if (!path) continue;
      for (let i = 1; i < path.length - 1; i++) bc[path[i]] += 1;
    }
  }
  const denom = ((n - 1) * (n - 2)) / 2;
  for (let i = 0; i < n; i++) bc[i] /= denom;
  return bc;
}

const ekey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** Brandes edge betweenness, networkx-normalized (undirected). */
export function edgeBetweenness(n: number, edges: Edge[]): Map<string, number> {
  const adj = adjacency(n, edges);
  const eb = new Map<string, number>();
  for (const [a, b] of edges) eb.set(ekey(a, b), 0);
  for (let s = 0; s < n; s++) {
    const dist = new Int32Array(n).fill(-1);
    const sigma = new Float64Array(n);
    const preds: number[][] = Array.from({ length: n }, () => []);
    dist[s] = 0;
    sigma[s] = 1;
    const order: number[] = [s];
    for (let qi = 0; qi < order.length; qi++) {
      const v = order[qi];
      for (const u of adj[v]) {
        if (dist[u] < 0) {
          dist[u] = dist[v] + 1;
          order.push(u);
        }
        if (dist[u] === dist[v] + 1) {
          sigma[u] += sigma[v];
          preds[u].push(v);
        }
      }
    }
    const delta = new Float64Array(n);
    for (let i = order.length - 1; i > 0; i--) {
      const w = order[i];
      for (const v of preds[w]) {
        const c = (sigma[v] / sigma[w]) * (1 + delta[w]);
        const k = ekey(v, w);
        eb.set(k, (eb.get(k) ?? 0) + c);
        delta[v] += c;
      }
    }
  }
  // every undirected pair is accumulated from both endpoints (x2), and networkx
  // normalizes by 2 / (n(n-1)); the net factor is 1 / (n(n-1)).
  const scale = 1 / (n * (n - 1));
  for (const [k, v] of eb) eb.set(k, v * scale);
  return eb;
}

export interface GnStep {
  removed: Edge;
  betweenness: number;
  components: number[][];
}

/** One Girvan–Newman iteration: cut the max edge (ties → smallest sorted edge). */
export function girvanNewmanStep(n: number, edges: Edge[]): GnStep | null {
  if (edges.length === 0) return null;
  const eb = edgeBetweenness(n, edges);
  let mx = -1;
  for (const v of eb.values()) if (v > mx) mx = v;
  let best: Edge | null = null;
  for (const [a, b] of edges) {
    const v = eb.get(ekey(a, b)) ?? 0;
    if (v < mx - 1e-12) continue;
    const cand: Edge = a < b ? [a, b] : [b, a];
    if (!best || cand[0] < best[0] || (cand[0] === best[0] && cand[1] < best[1])) best = cand;
  }
  if (!best) return null;
  const [ba, bb] = best;
  const rest = edges.filter(([a, b]) => !((a === ba && b === bb) || (a === bb && b === ba)));
  return { removed: best, betweenness: mx, components: components(n, rest) };
}

export function components(n: number, edges: Edge[]): number[][] {
  const adj = adjacency(n, edges);
  const comp = new Int32Array(n).fill(-1);
  let c = 0;
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0) continue;
    const queue = [s];
    comp[s] = c;
    for (let qi = 0; qi < queue.length; qi++) {
      for (const u of adj[queue[qi]]) {
        if (comp[u] < 0) {
          comp[u] = c;
          queue.push(u);
        }
      }
    }
    c++;
  }
  const out: number[][] = Array.from({ length: c }, () => []);
  for (let v = 0; v < n; v++) out[comp[v]].push(v);
  out.sort((x, y) => y.length - x.length);
  return out;
}

/** Graph Laplacian (dense, symmetric). */
export function laplacian(n: number, edges: Edge[]): number[][] {
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [a, b] of edges) {
    L[a][a] += 1;
    L[b][b] += 1;
    L[a][b] -= 1;
    L[b][a] -= 1;
  }
  return L;
}

export interface EigenResult {
  /** eigenvalues ascending */
  values: number[];
  /** eigenvectors as columns matching `values` (vectors[row][i]) */
  vectors: number[][];
}

/** Classical cyclic Jacobi eigensolver for a symmetric matrix (n <= ~64). */
export function jacobiEigen(mIn: number[][]): EigenResult {
  const n = mIn.length;
  const A = mIn.map((row) => [...row]);
  const V: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-22) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p][q];
        if (Math.abs(apq) < 1e-15) continue;
        const app = A[p][p];
        const aqq = A[q][q];
        const theta = (aqq - app) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        A[p][p] = app - t * apq;
        A[q][q] = aqq + t * apq;
        A[p][q] = 0;
        A[q][p] = 0;
        for (let k = 0; k < n; k++) {
          if (k === p || k === q) continue;
          const akp = A[k][p];
          const akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[p][k] = A[k][p];
          A[k][q] = s * akp + c * akq;
          A[q][k] = A[k][q];
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p];
          V[k][p] = c * vkp - s * V[k][q];
          V[k][q] = s * vkp + c * V[k][q];
        }
      }
    }
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[a][a] - A[b][b]);
  return {
    values: idx.map((i) => A[i][i]),
    vectors: Array.from({ length: n }, (_, r) => idx.map((i) => V[r][i])),
  };
}
