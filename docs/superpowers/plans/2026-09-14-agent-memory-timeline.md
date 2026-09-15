# Agent Memory Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one static, interactive David's Internet demo section that traces how agent memory evolved from flat RAG to temporal memory and then context-graph retrieval, with every implemented behavior replayed from the Agent_Memory prototype.

**Architecture:** The page is a React/SVG reader for a committed JSON trace. Agent_Memory produces the trace from its runnable `memory_os_v0` code; David Internet's build-preparation script copies that result and the attributable source files into the demo archive. The RAG chapter is a clearly labelled conceptual baseline, while the temporal and context-graph chapters are driven by actual `MemorySystem` outputs.

**Tech Stack:** Python 3 standard library; JSON; Next.js 15; React 19; TypeScript; SVG; Vitest; Playwright.

**Spec:** `demos/specs/16_agent_memory_timeline.md` (approved scope companion, updated 2026-09-15 to add the hierarchy lead-in, the policy/quarantine contrast, the integrity-check snapshot, and manifest copy — see the tasks below marked "new, 2026-09-15"; implementation must not widen further without a matching spec update).

## Global Constraints

- The rendered page contains **one section** (`#memory-timeline`), not a collection of independent demo cards.
- The first chapter, “flat RAG,” is explanatory only: do not imply that Agent_Memory v0 implements embeddings, a vector database, or an LLM.
- The temporal and context-graph chapters must replay data emitted by Agent_Memory, not duplicate Python policy or retrieval logic in TypeScript.
- Ship the generated JSON and vendored source files in David Internet so the exported site remains fully static and offline.
- Do not place example secrets, real personal records, or live user memory in the trace. Use only the existing deterministic prototype scenario.
- Preserve the experiment’s distinctions between evidence and belief, quarantine and rejection, session and durable scope, validity windows, sensitivity clearance, and deletion.
- Do not add background consolidation, embeddings, learned policy, a database, or an agent chat interface as part of this demo.

---

## Intended reader experience

The section is one horizontally continuous diagram with a story scrubber, not three separate panels:

```text
RAG baseline (concept only)  →  temporal memory  →  context-graph retrieval
search → top-k snippets         event → gate → versioned claim   query → candidates → graph → context
                               └──────── timeline dates ────────┘
```

1. **Flat RAG — conceptual baseline.** A fixed comparison diagram explains that a similarity search returns snippets without version, trust, provenance, or relationship reasoning. Its status badge says “research baseline — not implemented in v0.” The claim is supported by `Agent_Memory/Research/proposed_solutions.md`, which explicitly advises against making a generic vector database the core abstraction.
2. **Temporal memory — runnable v0.** Selecting a timeline date animates an observation through the event log and write gate. The April 6 concise-summary preference and April 27 correction render as two records joined by `supersedes`; the original validity window closes exactly when the correction is admitted.
3. **Context-graph retrieval — runnable v0, deliberately small.** Selecting one of the captured questions highlights candidate records, policy exclusions, and entity edges before rendering the cited context packet or abstention. The resource-memory example makes graph expansion visible; the poisoned-web example shows quarantine ending the path before retrieval.

The only interactive controls are the chapter scrubber, the bounded set of trace snapshots, and the trace’s built-in query scenarios. There is no free-form query box because a client-side reimplementation would diverge from the Python experiment.

## Implementation status and source of truth

| Capability shown | Degree | Source locations | Diagram treatment |
| --- | --- | --- | --- |
| Flat RAG/vector retrieval | Research comparison only; **not implemented** in v0 | `Agent_Memory/Research/proposed_solutions.md`, “What Not To Build First”; `docs/superpowers/specs/2026-09-10-memory-os-v0-design.md` | Muted fixed baseline; no “run” state or generated trace data. |
| Immutable event evidence | Implemented and tested | `Agent_Memory/experiments/memory_os_v0/memory_os/event_log.py`, `system.py` | Every selected observation first reaches the event-log lane. |
| Explainable write gate | Implemented and tested | `memory_os/write_gate.py`; `tests/test_memory_os.py::WriteGateTests` | Decision chip shows `store`, `session_only`, `quarantine`, or `reject`, plus recorded reasons. |
| Trust-gated instruction acceptance (new, 2026-09-15) | Implemented, untriggered by the current scenario | `memory_os/write_gate.py` (`policy_authorized` branch) | Rendered as a contrast pair beside the quarantine card: same instruction-shaped wording, accepted because it comes from a trusted actor tagged `kind="policy"`. |
| Typed, temporal claims | Implemented and tested | `memory_os/schema.py`, `memory_os/store.py`; `tests/test_memory_os.py::TemporalTests` | Record cards carry type, scope, trust, sensitivity, and validity window; supersession is an explicit edge. |
| Temporal/entity graph | Implemented, minimal index | `memory_os/graph.py` | Render `mentions`, `evidenced_by`, and `supersedes` edges only when valid at the selected snapshot. |
| Trust-aware context retrieval | Implemented, lexical candidate finding plus one-hop graph expansion | `memory_os/retrieval.py`; `tests/test_memory_os.py::RetrievalTests` | Candidate, excluded, graph-expanded, and admitted records use distinct styles and expose the recorded reason. |
| Feedback and cascading deletion | Implemented and tested | `memory_os/retrieval.py::record_feedback`, `memory_os/system.py::forget`; `tests/test_memory_os.py::DeletionTests` | Final optional snapshot shows deletion removing the entire version chain and the resulting abstention. |
| Hash-chain integrity (new, 2026-09-15) | Implemented and tested | `memory_os/event_log.py::verify`, `demo.py` Phase 8 | Closing `integrity-check` snapshot: event count, hash-chain-intact boolean, final record counts by type. |
| Embeddings, vector DB, consolidation, learned policy, multimodal/resource ingestion service, background workers | Future research scope; **not built** | `Agent_Memory/Research/proposed_solutions.md`; v0 design “Scope” | Omit from the interaction. Mention only in a compact “not in this demo” footnote. |

## File structure

### Agent_Memory (producer repository)

| File | Change | Responsibility |
| --- | --- | --- |
| `experiments/memory_os_v0/memory_os/trace_export.py` | Create | Execute the deterministic scenario and serialize normalized trace snapshots to JSON. |
| `experiments/memory_os_v0/memory_os/demo.py` | Modify | Expose the scenario’s ordered events and named query checkpoints for both terminal narration and trace export; retain current CLI behavior. |
| `experiments/memory_os_v0/tests/test_trace_export.py` | Create | Validate trace schema, temporal transitions, policy exclusions, and deterministic output. |
| `experiments/memory_os_v0/tests/fixtures/agent_memory_timeline_trace.json` | Create | Small committed golden trace for regression comparison. |

### David-Internet (consumer and renderer repository)

| File | Change | Responsibility |
| --- | --- | --- |
| `scripts/demos/agent-memory.ts` | Create | Run the Agent_Memory exporter using `AGENT_MEMORY_ROOT`, copy the normalized asset and source-drawer files, and fail clearly when the source checkout is absent. |
| `demos/agent_memory_raw/` | Create | Vendored, read-only copies of `demo.py`, `trace_export.py`, `write_gate.py`, `retrieval.py`, `graph.py`, `schema.py`, and `textutil.py` (schema.py + textutil.py added 2026-09-15 for Source-drawer completeness — they define the trust/sensitivity vocabulary and the instruction-pattern detection the quarantine contrast depends on) for attribution and the Source drawer. |
| `public/demos/agent-memory/trace.json` | Create, generated and committed | Static trace asset consumed by the browser. |
| `src/demos/agent-memory/core/trace.ts` | Create | Type definitions, JSON validation, snapshot lookup, and presentation-only derived state. It must not calculate gate decisions or retrieval scores. |
| `src/demos/agent-memory/core/trace.test.ts` | Create | Unit tests for trace parsing and selection of captured snapshots. |
| `src/demos/agent-memory/MemoryTimeline.tsx` | Create | One SVG-backed narrative section: chapter scrubber, event timeline, gates, records, temporal graph, and context packet. |
| `src/demos/agent-memory/Stage.tsx` | Create | Mount exactly one `#memory-timeline` section and load `trace.json`. |
| `src/demos/agent-memory/meta.ts` | Create | Story rail and source-drawer metadata for the new demo. |
| `src/demos/agent-memory/agent-memory.css` | Create | Responsive, accessible styles under an `am` prefix. |
| `content/agent-memory/site.ts` | Create | Search/knowledge-panel manifest for the demo. |
| `src/lib/demos.ts` | Modify | Register the `agent-memory` metadata. |
| `src/components/demo/DemoStage.tsx` | Modify | Register the lazy-loaded stage. |
| `src/lib/manifests.ts` | Modify | Register the site manifest. |
| `src/lib/wiki.ts` and the corresponding Replicates/Wikipedia article | Modify/create | Provide the normal David's Internet documentation route before release. |
| `e2e/agent-memory.spec.ts` | Create | Browser-level smoke and behavior checks for the static demo. |
| `demos/specs/16_agent_memory_timeline.md` | Review/update only if implementation changes an approved detail | Reader-facing demo spec, scope statement, source attribution, and disclosure of the RAG baseline. |

## Trace contract

`trace.json` is versioned and contains only values generated by the Python scenario, plus the static display labels needed by the renderer:

```ts
interface AgentMemoryTrace {
  version: 1;
  generatedAt: string;
  snapshots: TraceSnapshot[];
}

interface TraceSnapshot {
  id: "temporal-before-correction" | "temporal-after-correction" |
      "session-boundary" | "quarantine" | "clearance" |
      "graph-expansion" | "after-deletion" | "integrity-check";
  at: string;
  focus: "event" | "query" | "deletion" | "integrity";
  event?: TraceEvent;
  decision?: TraceDecision;
  // (new, 2026-09-15) present only on "quarantine": the same instruction-shaped
  // wording accepted as trusted policy, so the diagram can show the gate is
  // trust-gated rather than a blanket instruction filter.
  contrastEvent?: TraceEvent;
  contrastDecision?: TraceDecision;
  records: TraceRecord[];
  edges: TraceEdge[];
  query?: TraceQueryResult;
  // (new, 2026-09-15) present only on "integrity-check".
  integrity?: { eventCount: number; hashChainIntact: boolean; recordCountsByType: Record<string, number> };
}
```

`TraceDecision` preserves `action`, `reasons`, `memory_type`, `scope`, `trust_level`, `sensitivity`, `confidence`, `supersedes`, and `policy_flags`. `TraceRecord` preserves its stable ID, record type, content, source-event IDs, entities, validity window, trust, sensitivity, and deletion/visibility state. `TraceQueryResult` preserves the query text, `as_of`, session, clearance, cited entries, exclusions, and abstention state.

The exporter must capture **state at each checkpoint**, not reconstruct historical states from the final, post-deletion store. This prevents the deletion demo from accidentally changing the earlier correction story.

## Tasks

### Task 1: Produce a deterministic trace from Agent_Memory

**Files:**
- Create: `Agent_Memory/experiments/memory_os_v0/memory_os/trace_export.py`
- Modify: `Agent_Memory/experiments/memory_os_v0/memory_os/demo.py`
- Create: `Agent_Memory/experiments/memory_os_v0/tests/test_trace_export.py`
- Create: `Agent_Memory/experiments/memory_os_v0/tests/fixtures/agent_memory_timeline_trace.json`

**Interfaces:**
- Produces: `python3 -m memory_os.trace_export --out PATH` with a `version: 1` JSON document matching the contract above.
- Consumes: the existing public `MemorySystem.observe`, `MemorySystem.ask`, `MemorySystem.forget`, `GateDecision`, `MemoryRecord`, and `TemporalGraph` interfaces.

- [ ] Write `test_trace_export.py` first. Assert that the export contains all eight named snapshot IDs (2026-09-15: `integrity-check` added), that the correction snapshot contains both preference records with a closed `valid_until` on the old record, that the quarantine query has no context entry, that the quarantine snapshot's `contrastDecision` (new, 2026-09-15) shows `action="store"` with `policy_authorized` in its flags, and that the graph-expansion packet records a `reached by entity traversal` reason.
- [ ] Run `PYTHONPATH=experiments/memory_os_v0 python3 -m unittest experiments/memory_os_v0/tests/test_trace_export.py -v` and confirm the expected missing-exporter failure.
- [ ] Extract the scenario events and named query checkpoints from `demo.py` into a reusable, deterministic helper. Keep `python3 -m memory_os.demo` as the human-readable terminal narration.
- [ ] (New, 2026-09-15) Add one scenario event exercising the currently-untriggered `policy_authorized` branch in `write_gate.py`: a `verified`/`private` actor, `kind="policy"`, instruction-shaped content (e.g. "Always redact salary figures before sharing them externally"). Capture its decision alongside the existing poisoned-web event as the `quarantine` snapshot's `contrastEvent`/`contrastDecision`.
- [ ] (New, 2026-09-15) Capture Phase 8's final state (`system.log.verify()`, event count, `store.counts_by_type()`) as the `integrity-check` snapshot.
- [ ] Implement `trace_export.py` by invoking that shared scenario, capturing immutable snapshots immediately after each named checkpoint, and serializing `datetime` values in UTC ISO-8601 format.
- [ ] Regenerate the fixture from the exporter and compare the in-test result to the fixture after removing only `generatedAt`; no other value may be nondeterministic.
- [ ] Run the new test, then the complete existing suite: `cd Agent_Memory/experiments/memory_os_v0 && PYTHONPATH=. python3 -m unittest discover -s tests -v`.
- [ ] Commit only the trace-exporter change and its tests in the Agent_Memory feature branch.

### Task 2: Generate and commit David Internet’s static demo asset

**Files:**
- Create: `David-Internet/scripts/demos/agent-memory.ts`
- Create: `David-Internet/demos/agent_memory_raw/{demo.py,trace_export.py,write_gate.py,retrieval.py,graph.py,schema.py,textutil.py}` (schema.py, textutil.py added 2026-09-15)
- Create: `David-Internet/public/demos/agent-memory/trace.json`

**Interfaces:**
- Consumes: `AGENT_MEMORY_ROOT`, the Agent_Memory exporter from Task 1, and the output path supplied by `scripts/sync-demos.ts`.
- Produces: committed `public/demos/agent-memory/trace.json` and source-drawer copies that identify their Agent_Memory provenance in a header comment or source note.

- [ ] Implement the prep module to require an absolute `AGENT_MEMORY_ROOT`; invoke `python3 -m memory_os.trace_export --out <outDir>/trace.json` with `PYTHONPATH=<AGENT_MEMORY_ROOT>/experiments/memory_os_v0`.
- [ ] Have the module copy exactly the seven listed Python sources from Agent_Memory into `demos/agent_memory_raw/` (2026-09-15: schema.py and textutil.py added); do not copy the whole experiment or test corpus.
- [ ] Validate the parsed JSON contains `version === 1` and every named snapshot before the prep module completes. A missing source checkout, command failure, or invalid trace must return a non-zero result with the source path in the error.
- [ ] Run `AGENT_MEMORY_ROOT='/Users/fobrizzlemynizzle/Documents/Personal Projects/Agent_Memory' pnpm sync-demos agent-memory` from David-Internet and inspect the generated diff. Commit the trace JSON and vendored sources so normal builds do not need Agent_Memory.

### Task 3: Build the one-section timeline diagram

**Files:**
- Create: `David-Internet/src/demos/agent-memory/core/trace.ts`
- Create: `David-Internet/src/demos/agent-memory/core/trace.test.ts`
- Create: `David-Internet/src/demos/agent-memory/MemoryTimeline.tsx`
- Create: `David-Internet/src/demos/agent-memory/Stage.tsx`
- Create: `David-Internet/src/demos/agent-memory/agent-memory.css`

**Interfaces:**
- Consumes: `/demos/agent-memory/trace.json` and the type/validation module.
- Produces: a client-only `Stage` with exactly one `section id="memory-timeline"` and a selectable, accessible SVG diagram.

- [ ] Write `trace.test.ts` first. Use the committed fixture/asset to verify that selecting `temporal-before-correction` exposes the concise preference, selecting `temporal-after-correction` exposes the detailed preference and supersedes edge, and selecting `quarantine` never exposes a context-packet entry.
- [ ] Implement a hand-written JSON type guard in `trace.ts`. Reject unknown trace versions and render a readable in-page load error; do not introduce a schema-validation dependency.
- [ ] Implement `MemoryTimeline.tsx` as one section with three connected chapter anchors: `#rag-baseline`, `#temporal-memory`, and `#context-graph-retrieval`. Keep them inside `#memory-timeline`; these anchors support the story rail but must not create independent page sections.
- [ ] (New, 2026-09-15) Render a static memory-hierarchy lead-in above the chapter scrubber, inside `#memory-timeline`: KV cache → working context → session memory → long-term episodic memory → semantic + procedural memory → cold archival storage, as labeled copy sourced from `Agent_Memory/README.md`. Hardcoded content, not trace-driven — it must not read from `trace.json`.
- [ ] Render the RAG baseline as a fixed SVG mini-flow (`query → similarity search → top-k snippets`) with an explicit “conceptual baseline — not in Memory OS v0” label and no control that implies it ran.
- [ ] Render temporal snapshots from the selected trace: event card, append-only-log lane, gate decision with reasons, record cards with metadata, and time-valid supersession arrows. Use text labels in addition to color for accepted, session-only, rejected, and quarantined states.
- [ ] Render retrieval snapshots from recorded data: query, candidate records, policy exclusions, one-hop entity expansion, and the resulting cited context packet or abstention. Display recorded score explanations only; never calculate new rankings in the browser. (New, 2026-09-15) On the `quarantine` snapshot, render `contrastEvent`/`contrastDecision` beside the primary quarantined card so the accepted-policy and quarantined-web outcomes read as a deliberate pair, not two unrelated cards.
- [ ] (New, 2026-09-15) Render the `integrity-check` snapshot as a closing card: event-log length, hash-chain-intact boolean, and final record counts by type.
- [ ] Add keyboard-accessible buttons for chapter and snapshot selection, SVG `aria-label` text for every diagram state, visible focus styles, and a stacked mobile layout below the desktop breakpoint.
- [ ] Run `pnpm test -- src/demos/agent-memory/core/trace.test.ts` and then `pnpm test` from David-Internet.

### Task 4: Register the demo and document its truth boundaries

**Files:**
- Create: `David-Internet/src/demos/agent-memory/meta.ts`
- Create: `David-Internet/content/agent-memory/site.ts`
- Review: `David-Internet/demos/specs/16_agent_memory_timeline.md`
- Modify: `David-Internet/src/lib/demos.ts`
- Modify: `David-Internet/src/components/demo/DemoStage.tsx`
- Modify: `David-Internet/src/lib/manifests.ts`
- Modify: `David-Internet/src/lib/wiki.ts`
- Create: the matching Replicates/Wikipedia `Agent_Memory` article and redirect as required by that repository.

**Interfaces:**
- Produces: `/demos/agent-memory`, discovery through the demos index/search knowledge panel, a Source drawer containing the vendored Python, and the project’s normal Wikipedia documentation route.

- [ ] Write the meta story in this order (2026-09-15: opening beat and hash-chain beat added): this traces David's own current research, not archived coursework; why flat RAG loses time/provenance; how the write gate turns evidence into governed memory (contrasting the accepted-policy and quarantined-web outcomes); how the temporal correction changes the answer; how context-graph traversal recovers related evidence; how the hash-chained event log closes the loop; and which production features are intentionally absent.
- [ ] Put the following exact disclosure in the story or stage copy: “Memory OS v0 uses deterministic lexical candidate finding and a one-hop temporal entity index. It does not yet use embeddings, a vector database, background consolidation, or a learned policy.”
- [ ] Configure the manifest with `project: "agent-memory"`, `kind: "demo"`, `liveUrl: "/demos/agent-memory"`, deep links for the three chapter anchors, and source-accurate technologies: Python, TypeScript, React, SVG, JSON, and static export. Use the concrete copy/theme fill-ins from the spec's Manifest section (2026-09-15): `theme: { bg: "#eef1f5", panel: "#e2e7ee" }`, `accentColor: "#475569"`, favicon 🗃️, plus the tagline, keywords, and knowledge-panel facts written there.
- [ ] Add the new metadata, manifest, and dynamic Stage imports using the established registry patterns. Keep the stage client-only, matching other interactive demos.
- [ ] Keep the approved demo spec aligned with any source-path or artifact-contract changes made during implementation. Add the wiki mapping and matching article/redirect before presenting the page as an indexed site.
- [ ] Run `pnpm build` to ensure every static parameter, manifest, source-drawer path, and lazy import resolves.

### Task 5: Verify the visual behavior and finish deliberately

**Files:**
- Create: `David-Internet/e2e/agent-memory.spec.ts`
- Review: both feature-branch diffs and the generated `trace.json`.

**Interfaces:**
- Consumes: the static build from Task 4.
- Produces: evidence that the page renders without Python at runtime and that its high-value claims remain correctly labelled.

- [ ] Add Playwright coverage that opens `/demos/agent-memory`, verifies the single “Agent Memory Timeline” section, selects the after-correction snapshot and finds the detailed-summary record, selects the quarantine snapshot and finds the quarantined status plus abstention, and verifies the RAG chapter’s “not implemented in v0” disclosure.
- [ ] Run `pnpm e2e -- agent-memory.spec.ts`, then the complete `pnpm e2e` suite. Diagnose and repair only regressions caused by this demo.
- [ ] Run `pnpm build`, serve the static output if required by the existing Playwright flow, and inspect the page at desktop and mobile widths. Confirm that all detail is understandable without hover and that no component claims a runtime Python connection.
- [ ] Review `git diff --check`, `git diff --stat`, generated JSON size, source attribution, and the disclosure table above. Request independent review of both repositories before merge.
- [ ] Commit Agent_Memory and David-Internet changes separately, push their feature branches, and open the David-Internet PR against its integration branch only after both reviews are addressed.

## Explicit non-goals

- A generic chatbot or a form that stores visitor-provided memories.
- Browsing, vector embedding, semantic search, or LLM calls in the browser.
- A force-directed graph that makes ten records harder to read than the timeline.
- A production claim that the experiment has offline consolidation or an autonomous memory policy.
- A new backend, database, authentication surface, or cross-origin runtime dependency.
