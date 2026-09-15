import type { TraceRecord, TraceSnapshot } from "./trace";

export function recordsForSnapshot(snapshot: TraceSnapshot, temporal: boolean): TraceRecord[] {
  const preferenceRecords = snapshot.records.filter((record) => record.entities.includes("summary_style"));
  const packetRecordIds = new Set([
    ...(snapshot.query?.entries.map((entry) => entry.memory_id) ?? []),
    ...(snapshot.query?.excluded.map((entry) => entry.memory_id) ?? []),
  ]);
  const packetRecords = snapshot.records.filter((record) => packetRecordIds.has(record.memory_id));
  const eventRecords = snapshot.event
    ? snapshot.records.filter((record) => record.source_event_ids.includes(snapshot.event!.event_id))
    : [];
  if ((temporal || snapshot.id === "after-deletion") && preferenceRecords.length) return preferenceRecords;
  if (packetRecords.length) return packetRecords;
  if (eventRecords.length) return eventRecords;
  return snapshot.records.filter((record) => !record.deleted).slice(-3);
}
