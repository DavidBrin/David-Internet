import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "agent-memory",
  kind: "demo",
  displayName: "Agent Memory",
  fakeDomain: "memory.davids.net",
  liveUrl: "/demos/agent-memory",
  tagline:
    "A memory operating system for AI agents, replayed exactly as it ran: an event log, a write gate that explains every decision, and retrieval that shows its citations — a deterministic trace of code that already runs, not a pitch.",
  description:
    "A deterministic Agent_Memory Memory OS v0 trace showing a write gate, temporal supersession, entity-graph retrieval, quarantine, and hash-chain integrity. It is active research, not a production deployment: the browser replays static JSON emitted by the Python prototype.",
  accentColor: "#475569",
  favicon: "🗃️",
  techStack: ["Python", "TypeScript", "React", "SVG", "JSON", "static export"],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#rag-baseline",
      title: "Flat RAG baseline",
      snippet: "A conceptual query → similarity search → top-k snippets comparison, explicitly not implemented in Memory OS v0.",
      keywords: ["RAG", "vector search", "similarity search", "agent memory"],
    },
    {
      path: "#temporal-memory",
      title: "Temporal memory and a governed correction",
      snippet: "A write gate stores a correction as a later version, closes the old validity window, and leaves both records auditable.",
      keywords: ["temporal memory", "write gate", "supersession", "provenance"],
    },
    {
      path: "#context-graph-retrieval",
      title: "Context graph retrieval",
      snippet: "A recorded query is filtered by policy and expands one hop through an entity to form a cited context packet or abstention.",
      keywords: ["context graph", "retrieval", "entity graph", "quarantine", "prompt injection"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "agent memory",
    "memory OS",
    "write gate",
    "hash chain",
    "trust",
    "provenance",
    "forgetting",
    "entity graph",
    "retrieval",
    "RAG",
    "prompt injection",
    "memory poisoning",
  ],
  knowledgePanel: {
    type: "Active research (not coursework)",
    facts: {
      "Source of truth": "Precomputed trace from a real run, not reimplemented in the browser",
      Covers: "Write gate, temporal supersession, entity-graph retrieval, quarantine",
      "Not implemented": "Embeddings, vector DB, learned policy",
    },
  },
  docs: { readme: false, spec: false, decisions: false },
};

export default site;
