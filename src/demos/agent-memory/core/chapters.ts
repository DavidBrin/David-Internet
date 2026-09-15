export type TimelineChapter = "rag" | "temporal" | "graph";

const CHAPTERS_BY_HASH: Record<string, TimelineChapter> = {
  "#rag-baseline": "rag",
  "#temporal-memory": "temporal",
  "#context-graph-retrieval": "graph",
};

export function chapterFromHash(hash: string): TimelineChapter | null {
  return CHAPTERS_BY_HASH[hash] ?? null;
}
