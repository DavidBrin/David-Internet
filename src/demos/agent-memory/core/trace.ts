export const SNAPSHOT_IDS = [
  "temporal-before-correction",
  "temporal-after-correction",
  "session-boundary",
  "quarantine",
  "clearance",
  "graph-expansion",
  "after-deletion",
  "integrity-check",
] as const;

export type SnapshotId = (typeof SNAPSHOT_IDS)[number];
export type SnapshotFocus = "event" | "query" | "deletion" | "integrity";

export interface TraceEvent {
  event_id: string;
  actor: string;
  kind: string;
  content: string;
  session_id: string;
  ts: string;
  entity_hints: string[];
}

export interface TraceDecision {
  action: "store" | "session_only" | "quarantine" | "reject";
  reasons: string[];
  memory_type: string;
  scope: string;
  trust_level: string;
  sensitivity: string;
  confidence: number;
  supersedes: string[];
  policy_flags: string[];
}

export interface TraceRecord {
  memory_id: string;
  type: string;
  content: string;
  source_event_ids: string[];
  entities: string[];
  valid_from: string;
  valid_until: string | null;
  trust_level: string;
  sensitivity: string;
  confidence: number;
  scope: string;
  session_id: string;
  supersedes: string[];
  superseded_by: string | null;
  deleted: boolean;
  visible: boolean;
  gate_reasons: string[];
  policy_flags: string[];
}

export interface TraceEdge {
  src: string;
  dst: string;
  rel: string;
  valid_from: string;
  valid_until: string | null;
  visible: boolean;
}

export interface TraceQueryEntry {
  memory_id: string;
  type: string;
  content: string;
  score: number;
  valid_from: string;
  trust_level: string;
  confidence: number;
  citations: string[];
  why: string[];
}

export interface TraceQueryResult {
  query: string;
  as_of: string;
  session_id: string | null;
  clearance: string;
  entries: TraceQueryEntry[];
  excluded: { memory_id: string; reason: string }[];
  notes: string[];
  abstain: boolean;
}

export interface TraceSnapshot {
  id: SnapshotId;
  at: string;
  focus: SnapshotFocus;
  event?: TraceEvent;
  decision?: TraceDecision;
  contrastEvent?: TraceEvent;
  contrastDecision?: TraceDecision;
  records: TraceRecord[];
  edges: TraceEdge[];
  query?: TraceQueryResult;
  integrity?: { eventCount: number; hashChainIntact: boolean; recordCountsByType: Record<string, number> };
}

export interface AgentMemoryTrace {
  version: 1;
  generatedAt: string;
  snapshots: TraceSnapshot[];
}

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function timestamp(value: unknown, label: string): string {
  const text = string(value, label);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${label} must be a valid timestamp`);
  return text;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
  return value;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => string(item, `${label}[${index}]`));
}

function stringOrNull(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label);
}

function timestampOrNull(value: unknown, label: string): string | null {
  return value === null ? null : timestamp(value, label);
}

function event(value: unknown, label: string): TraceEvent {
  const item = object(value, label);
  return {
    event_id: string(item.event_id, `${label}.event_id`),
    actor: string(item.actor, `${label}.actor`),
    kind: string(item.kind, `${label}.kind`),
    content: string(item.content, `${label}.content`),
    session_id: string(item.session_id, `${label}.session_id`),
    ts: timestamp(item.ts, `${label}.ts`),
    entity_hints: strings(item.entity_hints, `${label}.entity_hints`),
  };
}

function decision(value: unknown, label: string): TraceDecision {
  const item = object(value, label);
  const action = string(item.action, `${label}.action`);
  if (!(["store", "session_only", "quarantine", "reject"] as string[]).includes(action)) {
    throw new Error(`${label}.action is not a supported gate action`);
  }
  return {
    action: action as TraceDecision["action"],
    reasons: strings(item.reasons, `${label}.reasons`),
    memory_type: string(item.memory_type, `${label}.memory_type`),
    scope: string(item.scope, `${label}.scope`),
    trust_level: string(item.trust_level, `${label}.trust_level`),
    sensitivity: string(item.sensitivity, `${label}.sensitivity`),
    confidence: number(item.confidence, `${label}.confidence`),
    supersedes: strings(item.supersedes, `${label}.supersedes`),
    policy_flags: strings(item.policy_flags, `${label}.policy_flags`),
  };
}

function record(value: unknown, label: string): TraceRecord {
  const item = object(value, label);
  return {
    memory_id: string(item.memory_id, `${label}.memory_id`),
    type: string(item.type, `${label}.type`),
    content: string(item.content, `${label}.content`),
    source_event_ids: strings(item.source_event_ids, `${label}.source_event_ids`),
    entities: strings(item.entities, `${label}.entities`),
    valid_from: timestamp(item.valid_from, `${label}.valid_from`),
    valid_until: timestampOrNull(item.valid_until, `${label}.valid_until`),
    trust_level: string(item.trust_level, `${label}.trust_level`),
    sensitivity: string(item.sensitivity, `${label}.sensitivity`),
    confidence: number(item.confidence, `${label}.confidence`),
    scope: string(item.scope, `${label}.scope`),
    session_id: string(item.session_id, `${label}.session_id`),
    supersedes: strings(item.supersedes, `${label}.supersedes`),
    superseded_by: stringOrNull(item.superseded_by, `${label}.superseded_by`),
    deleted: boolean(item.deleted, `${label}.deleted`),
    visible: boolean(item.visible, `${label}.visible`),
    gate_reasons: strings(item.gate_reasons, `${label}.gate_reasons`),
    policy_flags: strings(item.policy_flags, `${label}.policy_flags`),
  };
}

function edge(value: unknown, label: string): TraceEdge {
  const item = object(value, label);
  return {
    src: string(item.src, `${label}.src`),
    dst: string(item.dst, `${label}.dst`),
    rel: string(item.rel, `${label}.rel`),
    valid_from: timestamp(item.valid_from, `${label}.valid_from`),
    valid_until: timestampOrNull(item.valid_until, `${label}.valid_until`),
    visible: boolean(item.visible, `${label}.visible`),
  };
}

function query(value: unknown, label: string): TraceQueryResult {
  const item = object(value, label);
  const entries = Array.isArray(item.entries) ? item.entries : (() => { throw new Error(`${label}.entries must be an array`); })();
  const excluded = Array.isArray(item.excluded) ? item.excluded : (() => { throw new Error(`${label}.excluded must be an array`); })();
  return {
    query: string(item.query, `${label}.query`),
    as_of: timestamp(item.as_of, `${label}.as_of`),
    session_id: stringOrNull(item.session_id, `${label}.session_id`),
    clearance: string(item.clearance, `${label}.clearance`),
    entries: entries.map((entryValue, index) => {
      const entry = object(entryValue, `${label}.entries[${index}]`);
      return {
        memory_id: string(entry.memory_id, `${label}.entries[${index}].memory_id`),
        type: string(entry.type, `${label}.entries[${index}].type`),
        content: string(entry.content, `${label}.entries[${index}].content`),
        score: number(entry.score, `${label}.entries[${index}].score`),
        valid_from: string(entry.valid_from, `${label}.entries[${index}].valid_from`),
        trust_level: string(entry.trust_level, `${label}.entries[${index}].trust_level`),
        confidence: number(entry.confidence, `${label}.entries[${index}].confidence`),
        citations: strings(entry.citations, `${label}.entries[${index}].citations`),
        why: strings(entry.why, `${label}.entries[${index}].why`),
      };
    }),
    excluded: excluded.map((excludedValue, index) => {
      const excludedItem = object(excludedValue, `${label}.excluded[${index}]`);
      return {
        memory_id: string(excludedItem.memory_id, `${label}.excluded[${index}].memory_id`),
        reason: string(excludedItem.reason, `${label}.excluded[${index}].reason`),
      };
    }),
    notes: strings(item.notes, `${label}.notes`),
    abstain: boolean(item.abstain, `${label}.abstain`),
  };
}

export function parseTrace(value: unknown): AgentMemoryTrace {
  const trace = object(value, "Agent Memory trace");
  if (trace.version !== 1) throw new Error("Agent Memory trace must use version 1");
  if (!Array.isArray(trace.snapshots)) throw new Error("Agent Memory trace.snapshots must be an array");

  const snapshots = trace.snapshots.map((value, index) => {
    const item = object(value, `trace.snapshots[${index}]`);
    const id = string(item.id, `trace.snapshots[${index}].id`);
    if (!SNAPSHOT_IDS.includes(id as SnapshotId)) throw new Error(`Unknown Agent Memory snapshot id: ${id}`);
    const focus = string(item.focus, `trace.snapshots[${index}].focus`);
    if (!(["event", "query", "deletion", "integrity"] as string[]).includes(focus)) {
      throw new Error(`Unknown Agent Memory snapshot focus: ${focus}`);
    }
    if (!Array.isArray(item.records) || !Array.isArray(item.edges)) {
      throw new Error(`trace.snapshots[${index}] must contain records and edges arrays`);
    }
    const snapshot: TraceSnapshot = {
      id: id as SnapshotId,
      at: timestamp(item.at, `trace.snapshots[${index}].at`),
      focus: focus as SnapshotFocus,
      records: item.records.map((recordValue, recordIndex) => record(recordValue, `trace.snapshots[${index}].records[${recordIndex}]`)),
      edges: item.edges.map((edgeValue, edgeIndex) => edge(edgeValue, `trace.snapshots[${index}].edges[${edgeIndex}]`)),
    };
    if (item.event !== undefined) snapshot.event = event(item.event, `trace.snapshots[${index}].event`);
    if (item.decision !== undefined) snapshot.decision = decision(item.decision, `trace.snapshots[${index}].decision`);
    if (item.contrastEvent !== undefined) snapshot.contrastEvent = event(item.contrastEvent, `trace.snapshots[${index}].contrastEvent`);
    if (item.contrastDecision !== undefined) snapshot.contrastDecision = decision(item.contrastDecision, `trace.snapshots[${index}].contrastDecision`);
    if (item.query !== undefined) snapshot.query = query(item.query, `trace.snapshots[${index}].query`);
    if (item.integrity !== undefined) {
      const integrity = object(item.integrity, `trace.snapshots[${index}].integrity`);
      const counts = object(integrity.recordCountsByType, `trace.snapshots[${index}].integrity.recordCountsByType`);
      snapshot.integrity = {
        eventCount: number(integrity.eventCount, `trace.snapshots[${index}].integrity.eventCount`),
        hashChainIntact: boolean(integrity.hashChainIntact, `trace.snapshots[${index}].integrity.hashChainIntact`),
        recordCountsByType: Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, number(count, `trace.snapshots[${index}].integrity.recordCountsByType.${key}`)])),
      };
    }
    return snapshot;
  });

  const ids = new Set(snapshots.map((snapshot) => snapshot.id));
  if (ids.size !== snapshots.length) throw new Error("Agent Memory trace contains duplicate snapshot ids");
  for (const id of SNAPSHOT_IDS) if (!ids.has(id)) throw new Error(`Agent Memory trace is missing required snapshot: ${id}`);
  for (const id of ["temporal-before-correction", "temporal-after-correction", "session-boundary", "clearance", "graph-expansion"] as SnapshotId[]) {
    const snapshot = snapshots.find((candidate) => candidate.id === id)!;
    if (!snapshot.event || !snapshot.decision || !snapshot.query) {
      throw new Error(`Agent Memory trace ${id} must contain its recorded event, decision, and query`);
    }
  }
  const temporalAfter = snapshots.find((snapshot) => snapshot.id === "temporal-after-correction")!;
  const missingSupersedesEdge = temporalAfter.records.some((record) => record.supersedes.some((supersededId) =>
    !temporalAfter.edges.some((edge) => edge.rel === "supersedes" && edge.src === `mem:${record.memory_id}` && edge.dst === `mem:${supersededId}`)
  ));
  if (missingSupersedesEdge) {
    throw new Error("Agent Memory trace temporal-after-correction must preserve every supersedes graph edge");
  }
  const quarantine = snapshots.find((snapshot) => snapshot.id === "quarantine")!;
  if (!quarantine.event || !quarantine.decision || !quarantine.query || !quarantine.contrastEvent || !quarantine.contrastDecision) {
    throw new Error("Agent Memory trace quarantine snapshot must contain its event, decision, query, and trusted-policy contrast");
  }
  const integrity = snapshots.find((snapshot) => snapshot.id === "integrity-check")!;
  if (!integrity.integrity) throw new Error("Agent Memory trace integrity-check snapshot must contain integrity data");
  return { version: 1, generatedAt: timestamp(trace.generatedAt, "trace.generatedAt"), snapshots };
}

export function getSnapshot(trace: AgentMemoryTrace, id: SnapshotId): TraceSnapshot {
  const snapshot = trace.snapshots.find((candidate) => candidate.id === id);
  if (!snapshot) throw new Error(`Agent Memory trace is missing required snapshot: ${id}`);
  return snapshot;
}
