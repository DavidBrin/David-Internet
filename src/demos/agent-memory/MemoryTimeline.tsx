"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentMemoryTrace, SnapshotId, TraceSnapshot } from "./core/trace";
import { chapterFromHash, type TimelineChapter } from "./core/chapters";
import { focusChapterAnchor } from "./core/navigation";
import { supersedesArrow } from "./core/relationships";
import { recordsForSnapshot } from "./core/snapshot-records";

type Chapter = TimelineChapter;

const HIERARCHY = [
  "KV cache",
  "working context",
  "session memory",
  "long-term episodic memory",
  "semantic + procedural memory",
  "cold archival storage",
];

const TEMPORAL_IDS: { id: SnapshotId; label: string }[] = [
  { id: "temporal-before-correction", label: "April 20 — concise" },
  { id: "temporal-after-correction", label: "May 11 — detailed" },
];

const GRAPH_IDS: { id: SnapshotId; label: string }[] = [
  { id: "session-boundary", label: "session boundary" },
  { id: "quarantine", label: "quarantine contrast" },
  { id: "clearance", label: "clearance gate" },
  { id: "graph-expansion", label: "entity traversal" },
  { id: "after-deletion", label: "after deletion" },
  { id: "integrity-check", label: "integrity check" },
];

const CHAPTERS: { id: Chapter; anchor: string; label: string; detail: string }[] = [
  { id: "rag", anchor: "rag-baseline", label: "1. Flat RAG", detail: "comparison baseline" },
  { id: "temporal", anchor: "temporal-memory", label: "2. Temporal memory", detail: "captured write decisions" },
  { id: "graph", anchor: "context-graph-retrieval", label: "3. Context graph retrieval", detail: "captured packets" },
];

function compact(text: string, limit = 42): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

function date(text: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(text));
}

function statusClass(action?: string): string {
  return action ? `amStatus amStatus--${action}` : "amStatus";
}

function RagBaseline() {
  return (
    <div className="amChapter" id="rag-baseline" tabIndex={-1}>
      <div className="amChapterHead">
        <div>
          <p className="amKicker">Flat RAG</p>
          <h3>Similarity can find snippets. It cannot govern them.</h3>
        </div>
        <span className="amBadge">Conceptual baseline — not in Memory OS v0</span>
      </div>
      <figure className="amFigure">
        <svg viewBox="0 0 900 210" role="img" aria-label="Conceptual RAG flow from a query through similarity search to top-k snippets">
          <defs>
            <marker id="am-rag-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" className="amArrowHead" />
            </marker>
          </defs>
          <line x1="256" y1="102" x2="362" y2="102" className="amArrow" markerEnd="url(#am-rag-arrow)" />
          <line x1="536" y1="102" x2="642" y2="102" className="amArrow" markerEnd="url(#am-rag-arrow)" />
          <g className="amSvgNode">
            <rect x="54" y="50" width="202" height="104" rx="8" />
            <text x="76" y="84" className="amSvgEyebrow">INPUT</text>
            <text x="76" y="116" className="amSvgTitle">query</text>
            <text x="76" y="138" className="amSvgCopy">“How should I write?”</text>
          </g>
          <g className="amSvgNode amSvgNode--muted">
            <rect x="362" y="50" width="174" height="104" rx="8" />
            <text x="384" y="84" className="amSvgEyebrow">RANK</text>
            <text x="384" y="116" className="amSvgTitle">similarity search</text>
            <text x="384" y="138" className="amSvgCopy">nearest text only</text>
          </g>
          <g className="amSvgNode">
            <rect x="642" y="50" width="204" height="104" rx="8" />
            <text x="664" y="84" className="amSvgEyebrow">OUTPUT</text>
            <text x="664" y="116" className="amSvgTitle">top-k snippets</text>
            <text x="664" y="138" className="amSvgCopy">no time or policy gate</text>
          </g>
        </svg>
        <figcaption>
          This is the comparison point only. The following chapters replay the prototype&apos;s captured write and retrieval decisions.
        </figcaption>
      </figure>
    </div>
  );
}

function SnapshotDiagram({ snapshot, temporal }: { snapshot: TraceSnapshot; temporal: boolean }) {
  const records = recordsForSnapshot(snapshot, temporal);
  const primary = snapshot.event;
  const decision = snapshot.decision;
  const packet = snapshot.query;
  const live = records.filter((record) => record.visible && !record.deleted);
  const supersedesEdge = snapshot.edges.find((edge) => edge.rel === "supersedes");
  const temporalArrow = supersedesArrow(records, snapshot.edges);
  const focalRecordIds = new Set(records.map((record) => `mem:${record.memory_id}`));
  const focalEdges = snapshot.edges.filter((edge) => focalRecordIds.has(edge.src) || focalRecordIds.has(edge.dst));

  return (
    <>
      <figure className="amFigure amFigure--trace">
        <svg
          viewBox="0 0 1040 430"
          role="img"
          aria-label={`Captured ${snapshot.id} state: ${decision ? `${decision.action} gate decision. ` : ""}${packet ? `${packet.entries.length} context entries.` : ""}`}
        >
          <defs>
            <marker id="am-trace-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" className="amArrowHead" />
            </marker>
          </defs>
          <text x="36" y="34" className="amSvgEyebrow">APPEND-ONLY EVENT LOG</text>
          <text x="390" y="34" className="amSvgEyebrow">WRITE GATE</text>
          <text x="670" y="34" className="amSvgEyebrow">VERSIONED MEMORY</text>
          <line x1="302" y1="170" x2="374" y2="170" className="amArrow" markerEnd="url(#am-trace-arrow)" />
          <line x1="614" y1="170" x2="656" y2="170" className="amArrow" markerEnd="url(#am-trace-arrow)" />
          <g className="amSvgNode">
            <rect x="36" y="72" width="266" height="196" rx="8" />
            <text x="58" y="104" className="amSvgEyebrow">{primary ? `${primary.actor} · ${primary.kind}` : "captured checkpoint"}</text>
            <text x="58" y="138" className="amSvgTitle">{primary ? compact(primary.content, 39) : snapshot.id}</text>
            <text x="58" y="174" className="amSvgCopy">{primary ? date(primary.ts) : date(snapshot.at)}</text>
            <text x="58" y="206" className="amSvgCopy">event remains auditable</text>
            <text x="58" y="238" className="amSvgMono">{primary ? primary.event_id : "integrity snapshot"}</text>
          </g>
          <g className={`amSvgNode amSvgNode--${decision?.action ?? "muted"}`}>
            <rect x="374" y="112" width="240" height="116" rx="8" />
            <text x="396" y="144" className="amSvgEyebrow">OUTCOME</text>
            <text x="396" y="178" className="amSvgTitle">{decision ? decision.action.replace("_", " ") : "recorded state"}</text>
            <text x="396" y="204" className="amSvgCopy">{decision ? compact(decision.reasons[0] ?? "", 31) : "no new gate decision"}</text>
          </g>
          {records.map((record, index) => {
            const y = 72 + index * 112;
            return (
              <g key={record.memory_id} className={`amSvgNode ${record.visible ? "" : "amSvgNode--muted"}`}>
                <rect x="656" y={y} width="348" height="88" rx="8" />
                <text x="678" y={y + 28} className="amSvgEyebrow">{record.type} · {record.trust_level}</text>
                <text x="678" y={y + 54} className="amSvgTitle">{compact(record.content, 48)}</text>
                <text x="678" y={y + 76} className="amSvgMono">{record.deleted ? "deleted" : record.visible ? "live" : "not visible"} · {record.memory_id}</text>
              </g>
            );
          })}
          {temporal && supersedesEdge && temporalArrow && (
            <>
              <line x1="830" y1={temporalArrow.startY} x2="830" y2={temporalArrow.endY} className="amArrow" markerEnd="url(#am-trace-arrow)" />
              <text x="846" y={(temporalArrow.startY + temporalArrow.endY) / 2} className="amSvgEyebrow">SUPERSEDES</text>
            </>
          )}
          {snapshot.integrity && (
            <g className="amSvgNode amSvgNode--integrity">
              <rect x="36" y="314" width="968" height="78" rx="8" />
              <text x="58" y="344" className="amSvgEyebrow">INTEGRITY CHECK</text>
              <text x="58" y="372" className="amSvgTitle">{snapshot.integrity.eventCount} logged observations · hash chain {snapshot.integrity.hashChainIntact ? "intact" : "failed"}</text>
            </g>
          )}
        </svg>
        <figcaption>
          This is a captured state from {date(snapshot.at)}. The diagram uses only values emitted by the Python scenario.
        </figcaption>
      </figure>

      <div className="amMobileLanes" aria-label="Captured event, write-gate, and memory lanes">
        <div>
          <p className="amKicker">Append-only event log</p>
          <p>{primary ? primary.content : "The scenario records its final integrity state."}</p>
        </div>
        <div>
          <p className="amKicker">Write gate</p>
          <p>{decision ? `${decision.action.replace("_", " ")}: ${decision.reasons[0] ?? "no reason recorded"}` : "No new write occurs in this checkpoint."}</p>
        </div>
        <div>
          <p className="amKicker">Versioned memory</p>
          <p>{live.length ? live.map((record) => record.content).join(" · ") : "No record is visible in this checkpoint."}</p>
        </div>
      </div>

      <div className="amTextState" aria-live="polite">
        <div>
          <p className="amKicker">Selected event</p>
          <p>{primary ? primary.content : "The scenario closes by checking its own event log and final memory counts."}</p>
        </div>
        <div>
          <p className="amKicker">Gate outcome</p>
          {decision ? (
            <>
              <span className={statusClass(decision.action)}>{decision.action.replace("_", " ")}</span>
              <ul>{decision.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            </>
          ) : <p>No new write occurs in this checkpoint.</p>}
        </div>
        <div>
          <p className="amKicker">Memory visibility</p>
          <p>{live.length} shown record{live.length === 1 ? "" : "s"} is live in this snapshot; the state below names the visibility rather than encoding it in colour alone.</p>
          <ul>{records.map((record) => <li key={record.memory_id}>{record.deleted ? "deleted" : record.visible ? "live" : "not visible"}: {record.content} — {record.type}, {record.scope}, {record.sensitivity}; valid {date(record.valid_from)} to {record.valid_until ? date(record.valid_until) : "open"}</li>)}</ul>
        </div>
      </div>

      {snapshot.contrastEvent && snapshot.contrastDecision && (
        <aside className="amContrast" aria-label="Trusted policy contrast">
          <p className="amKicker">Trusted policy contrast</p>
          <p><strong>Quarantined web observation:</strong> {decision?.action ?? "recorded"}. <strong>Verified/private policy:</strong> {snapshot.contrastDecision.action} with {snapshot.contrastDecision.policy_flags.join(", ")}.</p>
          <blockquote>{snapshot.contrastEvent.content}</blockquote>
        </aside>
      )}

      {packet && (
        <div className="amPacket" aria-label="Recorded context packet">
          <div>
            <p className="amKicker">Recorded query</p>
            <p>{packet.query}</p>
          </div>
          <div>
            <p className="amKicker">Context packet</p>
            {packet.abstain ? <p><strong>Abstain:</strong> no recorded memory entered context.</p> : (
              <ul>{packet.entries.map((entry) => <li key={entry.memory_id}><strong>{entry.memory_id}</strong> — {entry.content} <span>({entry.why.join(", ")})</span></li>)}</ul>
            )}
          </div>
          <div>
            <p className="amKicker">Policy exclusions</p>
            {packet.excluded.length ? <ul>{packet.excluded.map((item) => <li key={`${item.memory_id}-${item.reason}`}>{item.memory_id}: {item.reason}</li>)}</ul> : <p>None in this captured packet.</p>}
          </div>
        </div>
      )}

      {packet && (
        <div className="amRetrievalFlow" aria-label="Recorded retrieval stages">
          <div>
            <p className="amKicker">Records shown in this snapshot</p>
            {records.length ? <ul>{records.map((record) => <li key={record.memory_id}>{record.memory_id}: {record.content}</li>)}</ul> : <p>No record is named by this captured packet.</p>}
          </div>
          <div>
            <p className="amKicker">Policy decision</p>
            {packet.excluded.length ? <ul>{packet.excluded.map((item) => <li key={item.memory_id}>{item.memory_id}: excluded — {item.reason}</li>)}</ul> : <p>No candidate was excluded in this packet.</p>}
          </div>
          <div>
            <p className="amKicker">Entity traversal</p>
            {packet.entries.some((entry) => entry.why.includes("reached by entity traversal")) ? <p>A cited entry was reached by a recorded one-hop entity traversal.</p> : <p>No entry used entity traversal in this checkpoint.</p>}
            {focalEdges.length ? <ul>{focalEdges.map((edge) => <li key={`${edge.src}-${edge.rel}-${edge.dst}`}>{edge.src} — {edge.rel} → {edge.dst}</li>)}</ul> : <p>No focal graph edge is recorded.</p>}
          </div>
        </div>
      )}

      {snapshot.integrity && (
        <div className="amIntegrity" aria-label="Recorded integrity results">
          <p className="amKicker">Final record counts by type</p>
          <ul>{Object.entries(snapshot.integrity.recordCountsByType).map(([type, count]) => <li key={type}>{type}: {count}</li>)}</ul>
        </div>
      )}
    </>
  );
}

export default function MemoryTimeline({ trace, error }: { trace?: AgentMemoryTrace; error?: string }) {
  const [chapter, setChapter] = useState<Chapter>("rag");
  const [temporalId, setTemporalId] = useState<SnapshotId>("temporal-after-correction");
  const [graphId, setGraphId] = useState<SnapshotId>("graph-expansion");
  const [anchorToFocus, setAnchorToFocus] = useState<string | null>(null);
  const selectedId = chapter === "temporal" ? temporalId : graphId;
  const selected = useMemo(() => trace?.snapshots.find((snapshot) => snapshot.id === selectedId), [selectedId, trace]);

  useEffect(() => {
    const syncChapterFromHash = () => {
      const fromHash = chapterFromHash(window.location.hash);
      if (fromHash) {
        setChapter(fromHash);
        setAnchorToFocus(window.location.hash.slice(1));
      }
    };
    syncChapterFromHash();
    window.addEventListener("hashchange", syncChapterFromHash);
    return () => window.removeEventListener("hashchange", syncChapterFromHash);
  }, []);

  useEffect(() => {
    if (anchorToFocus && focusChapterAnchor(anchorToFocus)) setAnchorToFocus(null);
  }, [anchorToFocus, chapter]);

  function selectChapter(next: Chapter) {
    setChapter(next);
    const anchor = CHAPTERS.find((item) => item.id === next)?.anchor;
    if (anchor) {
      setAnchorToFocus(anchor);
      window.history.replaceState(null, "", `#${anchor}`);
    }
  }

  return (
    <section className="amTimeline" id="memory-timeline" aria-labelledby="am-title">
      <header className="amHero">
        <p className="amKicker">Agent Memory Timeline</p>
        <h2 id="am-title">Memory is a hierarchy. Governed memory is a trace.</h2>
        <p>This page replays one deterministic Memory OS v0 run. It is an explanation of the experiment, not a browser chat agent or a production memory service.</p>
      </header>

      <div className="amHierarchy" aria-label="Agent memory hierarchy">
        <p className="amKicker">Memory hierarchy</p>
        <ol>{HIERARCHY.map((tier, index) => <li key={tier}><span>{tier}</span>{index < HIERARCHY.length - 1 && <b aria-hidden="true">→</b>}</li>)}</ol>
      </div>

      <nav className="amChapters" aria-label="Agent Memory Timeline chapters">
        {CHAPTERS.map((item) => (
          <button key={item.id} type="button" className="amChapterButton" aria-pressed={chapter === item.id} data-active={chapter === item.id} onClick={() => selectChapter(item.id)}>
            <span>{item.label}</span><small>{item.detail}</small>
          </button>
        ))}
      </nav>

      {chapter === "rag" && <RagBaseline />}

      {chapter !== "rag" && (
        <div className="amChapter" id={chapter === "temporal" ? "temporal-memory" : "context-graph-retrieval"} tabIndex={-1}>
          <div className="amChapterHead">
            <div>
              <p className="amKicker">{chapter === "temporal" ? "Temporal memory" : "Context graph retrieval"}</p>
              <h3>{chapter === "temporal" ? "A correction closes a validity window." : "Candidate finding becomes governed context."}</h3>
            </div>
            <p className="amTraceNote">Precomputed checkpoints only</p>
          </div>
          <div className="amSnapshotControls" aria-label={`${chapter === "temporal" ? "Temporal" : "Retrieval"} snapshots`}>
            {(chapter === "temporal" ? TEMPORAL_IDS : GRAPH_IDS).map((item) => (
              <button key={item.id} type="button" aria-pressed={selectedId === item.id} data-active={selectedId === item.id} onClick={() => chapter === "temporal" ? setTemporalId(item.id) : setGraphId(item.id)}>{item.label}</button>
            ))}
          </div>
          {error ? <p className="amLoadError" role="alert">The captured trace could not load: {error}</p> : selected ? <SnapshotDiagram snapshot={selected} temporal={chapter === "temporal"} /> : <p className="amLoadState">Loading the captured trace…</p>}
        </div>
      )}
    </section>
  );
}
