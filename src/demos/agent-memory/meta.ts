import type { DemoMeta } from "@/lib/demos";

const R = "demos/agent_memory_raw";

const meta: DemoMeta = {
  slug: "agent-memory",
  theme: { bg: "#eef1f5", panel: "#e2e7ee" },
  hideChips: true,
  what: "an append-only record of how an agent decides what deserves to become memory",
  why: "memory needs provenance, validity windows, and policy boundaries—not just similar snippets",
  when: "active Agent_Memory research, replayed from a deterministic Memory OS v0 run",
  story: [
    {
      title: "Current research, not archived coursework",
      body:
        "This page traces David's current Agent_Memory research rather than a past class project. Every temporal and retrieval state comes from one deterministic run of the Python prototype; the browser reads that committed trace instead of reimplementing the memory system.",
    },
    {
      title: "Why flat RAG is only a baseline",
      body:
        "A similarity search can find top-k snippets, but it does not by itself say whether a fact is current, trusted, permitted, or connected to the evidence that produced it. The first chapter is a comparison baseline, not functionality claimed for Memory OS v0.",
      anchor: "#rag-baseline",
    },
    {
      title: "A write gate makes evidence governable",
      body:
        "The gate explains each admission decision. It keeps a poisoned web observation as quarantined evidence while accepting instruction-shaped text only when it is verified/private policy—showing a trust boundary rather than a blanket command filter.",
      anchor: "#temporal-memory",
    },
    {
      title: "A correction changes what is live",
      body:
        "The detailed-summary correction closes the concise preference's validity window. Both records remain auditable, but only the later one can answer a later question; a deletion cascade prevents the original from silently coming back.",
      anchor: "#temporal-memory",
    },
    {
      title: "Context follows the temporal entity graph",
      body:
        "Retrieval starts with deterministic lexical candidates, applies validity, trust, and clearance rules, then follows a one-hop entity connection to surface a related stale-document episode with citations. The trace also shows when policy leaves the packet empty and the agent should abstain.",
      anchor: "#context-graph-retrieval",
    },
    {
      title: "The event log closes the loop",
      body:
        "The final integrity checkpoint records the event count, hash-chain verification, and memory-record totals. It makes the append-only claim concrete: nothing enters or leaves without a trace.",
      anchor: "#context-graph-retrieval",
    },
    {
      title: "What this experiment does not do",
      body:
        "Memory OS v0 uses deterministic lexical candidate finding and a one-hop temporal entity index. It does not yet use embeddings, a vector database, background consolidation, or a learned policy.",
    },
  ],
  sources: [
    { name: "demo.py", path: `${R}/demo.py`, lang: "python", note: "The deterministic scenario and its terminal narration, vendored from Agent_Memory." },
    { name: "trace_export.py", path: `${R}/trace_export.py`, lang: "python", note: "Produces the committed browser trace from the scenario." },
    { name: "write_gate.py", path: `${R}/write_gate.py`, lang: "python", note: "Admission, routing, sensitivity, and quarantine policy." },
    { name: "retrieval.py", path: `${R}/retrieval.py`, lang: "python", note: "Candidate finding, policy filters, graph expansion, and cited context packets." },
    { name: "graph.py", path: `${R}/graph.py`, lang: "python", note: "Temporal entity and provenance links." },
    { name: "schema.py", path: `${R}/schema.py`, lang: "python", note: "Event and record types plus trust and sensitivity vocabulary." },
    { name: "textutil.py", path: `${R}/textutil.py`, lang: "python", note: "Instruction-pattern detection and quoted-evidence neutralization." },
  ],
  sourceFooter:
    "Agent_Memory Memory OS v0 source, vendored for attribution. This page replays a committed trace from the Python experiment; it does not run Python in the browser.",
};

export default meta;
