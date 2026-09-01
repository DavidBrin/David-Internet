import type { GraphJson, NeighborsJson, HistJson, CommunitiesJson } from "./types";

const BASE = "/demos/arxiv";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`arxiv graph: fetch failed for ${path} (${res.status})`);
  return (await res.json()) as T;
}

export interface ArxivGraphData {
  graph: GraphJson;
  neighbors: NeighborsJson;
  hist: HistJson;
  communities: CommunitiesJson;
}

export async function loadArxivGraphData(): Promise<ArxivGraphData> {
  const [graph, neighbors, hist, communities] = await Promise.all([
    fetchJson<GraphJson>("graph.json"),
    fetchJson<NeighborsJson>("neighbors.json"),
    fetchJson<HistJson>("hist.json"),
    fetchJson<CommunitiesJson>("communities.json"),
  ]);
  return { graph, neighbors, hist, communities };
}
