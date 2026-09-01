/**
 * Data shapes for the graph panel's runtime fetches (public/demos/arxiv/*.json)
 * and the Louvain worker's message protocol. Kept local to graph/ per the
 * panel-owns-its-types convention (see Stage.tsx panel contracts).
 */

export interface GraphNode {
  id: string; // arXiv id, e.g. "2507.14810"
  t: string; // title
  y: number; // year
  c: string; // category, e.g. "cs.LG"
  g: number; // index into groups[]
  x: number; // t-SNE layout x, [0,1]
  z: number; // t-SNE layout y, [0,1]
}

export interface GraphJson {
  nodes: GraphNode[];
  groups: string[];
  /** [srcIdx, dstIdx, dist] — every candidate edge with dist<=tauMax */
  edges: [number, number, number][];
  kSearch: number;
  tauMax: number;
}

export interface NeighborsJson {
  k: number;
  /** list[i] = up to k nearest neighbours of node i, as [nodeIdx, dist] pairs */
  list: [number, number][][];
}

export interface TauCandidate {
  pkeep: number;
  tau: number;
}

export interface TauTableRow {
  tau: number;
  pkeep: number;
  edges: number;
  avgDegree: number;
  isolated: number;
  modularity: number;
  communities: number;
}

export interface FullRunLouvainRow {
  tau: number;
  modularity: number;
  communities: number;
}

export interface HistJson {
  bins: number[];
  counts: number[];
  tauCandidates: TauCandidate[];
  tauTable: TauTableRow[];
  sample: {
    n: number;
    corpusTotal: number;
    filters: { minYear: number; minWords: number };
  };
  fullRun: {
    papers: number;
    tauCandidates: TauCandidate[];
    louvain: FullRunLouvainRow[];
    reportTau: number;
    note: string;
  };
}

export interface CommunitiesJson {
  taus: number[];
  /** keyed by stringified tau, e.g. "0.27" -> per-node community id, length n */
  labels: Record<string, number[]>;
  /** keyed by stringified community id (tau=0.27 run, communities with >=8 papers) */
  words27: Record<string, string[]>;
}

export type ColorMode = "communities" | "categories";

export interface LouvainWorkerResult {
  tau: number;
  labels: Int32Array;
  modularity: number;
  nCommunities: number;
  edgeCount: number;
}

export interface WorkerInitMsg {
  type: "init";
  n: number;
  edgeA: number[];
  edgeB: number[];
  edgeDist: number[];
}

export interface WorkerRunMsg {
  type: "run";
  reqId: number;
  tau: number;
}

export type WorkerInMsg = WorkerInitMsg | WorkerRunMsg;

export interface WorkerOutMsg {
  reqId: number;
  tau: number;
  labels: ArrayBuffer;
  modularity: number;
  nCommunities: number;
  edgeCount: number;
}
