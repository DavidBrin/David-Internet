/**
 * The arXiv TS ports must reproduce the Python/NetworkX pipeline on the
 * shipped data (fixtures from `pnpm sync-demos arxiv`): tau-from-percentile
 * exactly, modularity of the shipped Louvain partition exactly, TS louvain
 * within a small margin of the NetworkX seed-42 Q, A-priori exact on the real
 * baskets, and the karate-club betweenness / Girvan-Newman / Laplacian values.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { chooseTauFromPercentile, edgeStatsAtTau } from "@/demos/arxiv/core/tau";
import { louvain, modularity, type WEdge } from "@/demos/arxiv/core/louvain";
import { calculateLift, getFrequentItemsets, pairKey } from "@/demos/arxiv/core/apriori";
import {
  edgeBetweenness,
  girvanNewmanStep,
  jacobiEigen,
  laplacian,
  nodeBetweenness,
  type Edge,
} from "@/demos/arxiv/core/graphalgos";

function fx<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8")) as T;
}
function pub<T>(name: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public", "demos", "arxiv", name), "utf8")
  ) as T;
}

// ---------------------------------------------------------------------------
interface TauFx {
  bins: number[];
  counts: number[];
  expected: { pkeep: number; tau: number }[];
}

describe("choose_tau_from_percentile port", () => {
  const f = fx<TauFx>("arxiv-tau.json");
  for (const c of f.expected) {
    it(`pkeep=${c.pkeep} -> tau=${c.tau}`, () => {
      expect(chooseTauFromPercentile(f.bins, f.counts, c.pkeep)).toBeCloseTo(c.tau, 9);
    });
  }
});

// ---------------------------------------------------------------------------
interface GraphJson {
  nodes: { id: string }[];
  edges: [number, number, number][];
}
interface CommJson {
  taus: number[];
  labels: Record<string, number[]>;
}
interface LouvainFx {
  tau: number;
  modularity: number;
  communities: number;
  edges: number;
}

describe("modularity + louvain on the shipped graph", () => {
  const g = pub<GraphJson>("graph.json");
  const comm = pub<CommJson>("communities.json");
  const f = fx<LouvainFx>("arxiv-louvain.json");
  const n = g.nodes.length;
  const wedges: WEdge[] = g.edges
    .filter(([, , d]) => d <= f.tau)
    .map(([a, b, d]) => ({ a, b, w: 1 - d }));

  it("edge count at tau matches the prep run", () => {
    expect(wedges.length).toBe(f.edges);
    expect(edgeStatsAtTau(n, g.edges, f.tau).edges).toBe(f.edges);
  });

  it("TS modularity of the shipped partition matches NetworkX", () => {
    const labels = comm.labels[String(f.tau)];
    expect(labels).toBeDefined();
    const q = modularity(n, wedges, labels);
    expect(q).toBeCloseTo(f.modularity, 3);
  });

  it("TS louvain reaches within 0.02 of the NetworkX Q", () => {
    const r = louvain(n, wedges);
    expect(Math.abs(r.modularity - f.modularity)).toBeLessThan(0.02);
    // sanity: same order of magnitude of communities
    expect(r.nCommunities).toBeGreaterThan(f.communities * 0.8);
    expect(r.nCommunities).toBeLessThan(f.communities * 1.2);
  });
});

// ---------------------------------------------------------------------------
interface BasketsJson {
  items: string[];
  baskets: number[][];
}
interface AprioriFx {
  minSupport: number;
  totalBaskets: number;
  frequentItems: number;
  frequentPairs: number;
  topPairs: { a: string; b: string; count: number; lift: number }[];
}

describe("A-priori port vs David's functions on the real baskets", () => {
  const data = pub<BasketsJson>("baskets.json");
  const f = fx<AprioriFx>("arxiv-apriori.json");
  const r = getFrequentItemsets(data.baskets, f.minSupport);
  it("frequent item / pair counts match", () => {
    expect(data.baskets.length).toBe(f.totalBaskets);
    expect(r.frequentItems.size).toBe(f.frequentItems);
    expect(r.frequentPairs.size).toBe(f.frequentPairs);
  });
  it("top pairs and lifts match exactly", () => {
    const lifts = calculateLift(r.itemCounts, r.frequentPairs, data.baskets.length);
    const nameIdx = new Map(data.items.map((s, i) => [s, i]));
    for (const p of f.topPairs) {
      const k = pairKey(nameIdx.get(p.a)!, nameIdx.get(p.b)!);
      expect(r.frequentPairs.get(k)).toBe(p.count);
      expect(lifts.get(k)!).toBeCloseTo(p.lift, 6);
    }
  });
});

// ---------------------------------------------------------------------------
interface SocialJson {
  n: number;
  edges: Edge[];
}
interface AlgoFx {
  nodeBetweenness: Record<string, number>;
  edgeBetweennessTop: { e: Edge; v: number }[];
  gnRemoved: [number, number, number][];
  gnFirstSplit: number[][];
  laplacianEigenvalues: number[];
  fiedlerSigns: number[];
}

describe("karate-club algorithm cards vs Python", () => {
  const g = pub<SocialJson>("social.json");
  const f = fx<AlgoFx>("arxiv-graphalgos.json");

  it("David's node betweenness matches exactly", () => {
    const bc = nodeBetweenness(g.n, g.edges);
    for (const [k, v] of Object.entries(f.nodeBetweenness)) {
      expect(bc[Number(k)]).toBeCloseTo(v, 6);
    }
  });

  it("edge betweenness matches networkx on the top edges", () => {
    const eb = edgeBetweenness(g.n, g.edges);
    for (const { e, v } of f.edgeBetweennessTop) {
      const key = e[0] < e[1] ? `${e[0]}-${e[1]}` : `${e[1]}-${e[0]}`;
      expect(eb.get(key)!).toBeCloseTo(v, 6);
    }
  });

  it("Girvan-Newman removes the same edges to the first split", () => {
    let edges = g.edges.map((e) => [...e] as Edge);
    for (const [a, b] of f.gnRemoved) {
      const step = girvanNewmanStep(g.n, edges)!;
      const got = [...step.removed].sort((x, y) => x - y);
      expect(got).toEqual([a, b].sort((x, y) => x - y));
      edges = edges.filter(([x, y]) => !(Math.min(x, y) === got[0] && Math.max(x, y) === got[1]));
      if (step.components.length > 1) break;
    }
    const final = components(g.n, edges);
    function components(n: number, es: Edge[]) {
      // re-derive via the module's helper through girvanNewmanStep's contract
      return finalComponents(n, es);
    }
    function finalComponents(n: number, es: Edge[]) {
      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      for (const [a, b] of es) parent[find(a)] = find(b);
      const groups = new Map<number, number[]>();
      for (let v = 0; v < n; v++) {
        const r = find(v);
        if (!groups.has(r)) groups.set(r, []);
        groups.get(r)!.push(v);
      }
      return Array.from(groups.values()).sort((x, y) => y.length - x.length);
    }
    expect(final.length).toBe(f.gnFirstSplit.length);
    expect(final[0].sort((x, y) => x - y)).toEqual(f.gnFirstSplit[0]);
  });

  it("Laplacian eigenvalues match numpy (sorted)", () => {
    const { values, vectors } = jacobiEigen(laplacian(g.n, g.edges));
    for (let i = 0; i < values.length; i++) {
      expect(values[i]).toBeCloseTo(f.laplacianEigenvalues[i], 5);
    }
    // Fiedler vector signs (up to global sign flip)
    const fied = vectors.map((row) => row[1]);
    const signs = fied.map((v) => Math.sign(Math.round(v * 1e12)));
    const agree = signs.filter((s, i) => s === f.fiedlerSigns[i]).length;
    const flipped = signs.filter((s, i) => -s === f.fiedlerSigns[i]).length;
    expect(Math.max(agree, flipped)).toBe(g.n);
  });
});
