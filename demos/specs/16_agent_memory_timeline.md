# 16 — Agent Memory Timeline

Slug: `agent-memory` · Fake domain: `memory.davids.net` · Archetype: **one interactive SVG narrative**

Status: planned 2026-09-14; scope extended 2026-09-15 (hierarchy lead-in, policy/quarantine contrast, integrity snapshot, manifest copy — additions below are marked "new, 2026-09-15"). Implementation details and test sequence: `docs/superpowers/plans/2026-09-14-agent-memory-timeline.md`.

## Summary

Unlike every other demo on the site, this one traces David's own current research rather than archived coursework — the opening story beat says so plainly.

A single diagram explains the progression from flat RAG to governed, temporal agent memory. A short static lead-in (the memory hierarchy — KV cache → working context → session memory → long-term episodic memory → semantic + procedural memory → cold archival storage, from `Agent_Memory/README.md`) frames why governance matters before the diagram starts. It starts with RAG as a comparison baseline, then replays the existing Agent_Memory v0 prototype: an observation is logged, its write is explained by the gate, a correction closes an earlier validity window, and retrieval follows eligible temporal/entity links into a cited context packet.

The page is an explanation of a deterministic experiment, not a production memory product and not an interactive chat agent.

## Source material and truth boundaries

The source project is `Agent_Memory`, specifically:

| Claim | Source | Status |
| --- | --- | --- |
| Generic vector search/RAG is an insufficient core memory abstraction | `Research/proposed_solutions.md` | Research comparison only; not implemented in v0. |
| Raw observations become governed records through an auditable write gate | `experiments/memory_os_v0/memory_os/write_gate.py` | Runnable and tested. |
| Corrections supersede a claim by closing the old validity window | `memory_os/store.py`, `memory_os/graph.py`, `tests/test_memory_os.py::TemporalTests` | Runnable and tested. |
| Retrieval filters for validity, trust, and clearance, then expands one hop through entities | `memory_os/retrieval.py` | Runnable and tested, using deterministic lexical candidate finding. |
| Prompt-injection-like web content is quarantined and excluded from retrieval | `memory_os/write_gate.py`, `tests/test_memory_os.py::WriteGateTests` | Runnable and tested. |
| Embeddings, vector databases, background consolidation, learned policies, and multimodal ingestion | v0 design and proposal | Not implemented; not depicted as working functionality. |

## Stage

There is exactly one stage section: `#memory-timeline`. Above the chapter scrubber, a static **memory-hierarchy lead-in** (new, 2026-09-15) renders the tiers from `Agent_Memory/README.md` — KV cache → working context → session memory → long-term episodic memory → semantic + procedural memory → cold archival storage — as plain labeled copy, not simulation output; it needs no trace data and exists purely to frame why the rest of the page treats memory as governance rather than storage.

Its internal story scrubber has three anchored chapters:

1. `#rag-baseline` — fixed mini-flow: `query → similarity search → top-k snippets`. A visible badge says “conceptual baseline — not in Memory OS v0.” It is not selectable as a runnable scenario.
2. `#temporal-memory` — the user selects captured dates around the concise-summary preference and its later detailed-summary correction. The diagram shows the event log, the write-gate reason, two versioned records, and the `supersedes` relationship. At the later date only the detailed record is live.
3. `#context-graph-retrieval` — captured queries show candidate records, policy exclusions, entity traversal, and the cited context packet or abstention. The resource example surfaces a stale-document episode through a shared entity; the poison example visibly terminates at quarantine. **(new, 2026-09-15, approved for Task 1)** The quarantine example renders paired with a contrasting trusted-policy example: the same instruction-shaped wording, but from a `verified`/`private` actor tagged `kind="policy"`, which the gate accepts and flags `policy_authorized`. This shows the gate is trust-gated rather than a blanket instruction filter, and exercises a branch of `write_gate.py` the current scenario never triggers — it requires adding one event to the Python scenario (Task 1).

A final snapshot, **`integrity-check`** (new, 2026-09-15), closes the diagram with the scenario's own Phase 8: the event log's length and hash-chain-intact result, and the final memory-record counts by type — the concrete payoff of "append-only" and "nothing enters or leaves without a trace."

The browser never invents a gate decision, ranking score, or historical state. It loads a committed `trace.json` exported from the Python scenario and lets the reader choose only precomputed checkpoints.

## Asset flow

```text
Agent_Memory deterministic scenario
  → trace_export.py (versioned JSON snapshots)
  → David-Internet scripts/demos/agent-memory.ts
  → public/demos/agent-memory/trace.json
  → React/SVG timeline at /demos/agent-memory
```

The David Internet prep step also vendors the five small, attributable Python sources shown in the Source drawer: `demo.py`, `trace_export.py`, `write_gate.py`, `retrieval.py`, and `graph.py`. Generated assets are committed, so production rendering has no Python runtime or dependency on the sibling checkout.

## Source drawer

- `demo.py` — deterministic scenario and terminal narration.
- `trace_export.py` — the browser asset’s producer.
- `write_gate.py` — admission, routing, sensitivity, and quarantine policy.
- `retrieval.py` — candidate, filter, graph-expansion, and context-packet logic.
- `graph.py` — temporal entity and provenance links.
- `schema.py` — event/record types, trust weights, sensitivity ranks (new, 2026-09-15: the vocabulary every badge on the page names).
- `textutil.py` — instruction-pattern detection and `neutralize()`, the mechanism behind the quarantine contrast above (new, 2026-09-15).

## Manifest

- Display name: **Agent Memory Timeline**
- Accent: **decided 2026-09-15** (superseding the original "restrained indigo/teal" note) — slate/graphite, dropping the indigo/teal direction entirely so this demo doesn't sit near Nocturnal's indigo (`#6366F1`) or Crossteach's teal (`#14B8A6`) on the demos index. `theme: { bg: "#eef1f5", panel: "#e2e7ee" }`, `accentColor: "#475569"`. Still pair every policy-state color with a text label, per the accessibility requirement below. Favicon candidate: 🗃️ (🧠 as an alternate).
- Tagline (2026-09-15): "A memory operating system for AI agents, replayed exactly as it ran: an event log, a write gate that explains every decision, and retrieval that shows its citations — a deterministic trace of code that already runs, not a pitch."
- Keywords (2026-09-15): agent memory, memory OS, write gate, hash chain, trust, provenance, forgetting, entity graph, retrieval, RAG, prompt injection, memory poisoning.
- Knowledge panel facts (2026-09-15): "Type: active research (not coursework)" · "Source of truth: precomputed trace from a real run, not reimplemented in the browser" · "Covers: write gate, temporal supersession, entity-graph retrieval, quarantine" · "Not implemented: embeddings, vector DB, learned policy."
- Deep links: `#rag-baseline`, `#temporal-memory`, `#context-graph-retrieval`.
- Technologies: Python, TypeScript, React, SVG, JSON, static export.
- Knowledge panel: a prototype/research demo; no claim of production deployment.

## Accessibility and scope

All chapter and snapshot controls are keyboard buttons with visible focus. Every SVG state has a textual equivalent: selected event, gate outcome/reasons, record validity, graph-edge type, and retrieval inclusion or exclusion reason. The layout stacks the diagram’s lanes on narrow screens; it must not rely on hover alone.

Out of scope: free-form visitor queries, persistence of visitor data, a vector/embedding pipeline, a force-directed graph, background jobs, a backend, or authentication.
