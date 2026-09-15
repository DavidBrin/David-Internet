import { describe, expect, it } from "vitest";
import { REQUIRED_SNAPSHOT_IDS, validateTrace } from "./agent-memory";

function traceWithSnapshots(ids: string[]) {
  return {
    version: 1,
    generatedAt: "2026-04-06T09:00:00Z",
    snapshots: ids.map((id) => ({
      id,
      at: "2026-04-06T09:00:00Z",
      focus: "event",
      records: [],
      edges: [],
    })),
  };
}

describe("Agent Memory demo preparation", () => {
  it("accepts a version-one trace containing every captured checkpoint", () => {
    expect(() => validateTrace(traceWithSnapshots([...REQUIRED_SNAPSHOT_IDS]))).not.toThrow();
  });

  it("rejects a trace that omits the closing integrity checkpoint", () => {
    expect(() => validateTrace(traceWithSnapshots(REQUIRED_SNAPSHOT_IDS.filter((id) => id !== "integrity-check")))).toThrow(
      "integrity-check"
    );
  });

  it("rejects an unknown trace version", () => {
    expect(() => validateTrace({ ...traceWithSnapshots([...REQUIRED_SNAPSHOT_IDS]), version: 2 })).toThrow("version 1");
  });
});
