import { describe, expect, it } from "vitest";
import { recordsForSnapshot } from "./snapshot-records";
import type { TraceSnapshot } from "./trace";

describe("recordsForSnapshot", () => {
  it("shows quarantined evidence when its recorded packet abstains", () => {
    const poisoned = {
      memory_id: "poisoned",
      source_event_ids: ["event-poisoned"],
      entities: [],
      deleted: false,
      visible: false,
    };
    const fallback = {
      memory_id: "fallback",
      source_event_ids: [],
      entities: [],
      deleted: false,
      visible: true,
    };
    const snapshot = {
      id: "quarantine",
      event: { event_id: "event-poisoned" },
      records: [poisoned, fallback],
      query: { entries: [], excluded: [] },
    } as unknown as TraceSnapshot;

    expect(recordsForSnapshot(snapshot, false)).toEqual([poisoned]);
  });
});
