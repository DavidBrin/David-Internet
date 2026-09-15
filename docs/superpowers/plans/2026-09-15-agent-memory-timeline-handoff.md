# Agent Memory Timeline — scaffold handoff

Updated: 2026-09-15

## Local integration state

- David Internet scaffold is merged into local `main` at `300d6bd`.
- Memory producer remains on `feature/agent-memory-trace-export` at `127d4ba`; it exports the deterministic, eight-checkpoint trace and preserves the temporal `supersedes` graph edge.
- Wikipedia article remains on `feature/agent-memory-wiki` at `8a01a15`.

## What is built

- Static browser demo at `/demos/agent-memory`, driven only by committed `/demos/agent-memory/trace.json`.
- One chaptered section: flat RAG baseline, temporal/versioned memory, and context-graph retrieval.
- Real captured write-gate, quarantine contrast, session, clearance, graph traversal, deletion, and integrity snapshots.
- Trace-derived `supersedes` direction, deep-link chapter activation, textual/mobile equivalents, source drawer, metadata, and a docs redirect mapping.

## Verification recorded

- David Internet: `pnpm test` — 35 files / 493 tests passed; `pnpm build` passed.
- Wikipedia: 151 tests passed, 1 skipped; TypeScript check passed.
- Producer: 39 Python tests passed.

## Remaining before public release

1. Merge and deploy the Wikipedia article before releasing David's `/sites/agent-memory/docs` redirect.
2. Add the planned Playwright/visual verification for direct deep links, chapter selection, temporal-arrow direction, quarantine abstention, mobile content, and the RAG disclosure.
3. Decide whether to extend the producer contract with pre-policy retrieval candidates; the current UI accurately labels only records named by the captured packet.

