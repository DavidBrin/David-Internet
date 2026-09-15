import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getSnapshot, parseTrace } from "./trace";

function shippedTrace() {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public", "demos", "agent-memory", "trace.json"), "utf8")
  ) as unknown;
}

describe("Agent Memory Timeline trace", () => {
  it("selects the concise preference before the correction", () => {
    const snapshot = getSnapshot(parseTrace(shippedTrace()), "temporal-before-correction");
    expect(snapshot.records.map((record) => record.content)).toContain("I prefer concise final summaries, no preamble.");
  });

  it("selects the detailed preference and its supersession after the correction", () => {
    const snapshot = getSnapshot(parseTrace(shippedTrace()), "temporal-after-correction");
    const concise = snapshot.records.find((record) => record.content.includes("concise final summaries"));
    const detailed = snapshot.records.find((record) => record.content.includes("detailed summaries"));
    expect(concise?.valid_until).not.toBeNull();
    expect(detailed?.supersedes).toContain(concise?.memory_id);
    expect(snapshot.edges).toContainEqual(expect.objectContaining({
      src: `mem:${detailed?.memory_id}`,
      dst: `mem:${concise?.memory_id}`,
      rel: "supersedes",
    }));
  });

  it("keeps a quarantined observation out of the recorded context packet", () => {
    const snapshot = getSnapshot(parseTrace(shippedTrace()), "quarantine");
    expect(snapshot.decision?.action).toBe("quarantine");
    expect(snapshot.query?.entries).toHaveLength(0);
    expect(snapshot.query?.abstain).toBe(true);
  });

  it("rejects an unrecognized trace version", () => {
    expect(() => parseTrace({ version: 2, generatedAt: "2026-01-01T00:00:00Z", snapshots: [] })).toThrow("version 1");
  });

  it("rejects duplicate snapshot IDs", () => {
    const trace = shippedTrace() as { snapshots: unknown[] };
    trace.snapshots.push(trace.snapshots[0]);
    expect(() => parseTrace(trace)).toThrow("duplicate");
  });

  it("rejects a quarantine checkpoint without its trusted-policy contrast", () => {
    const trace = shippedTrace() as { snapshots: Array<Record<string, unknown>> };
    const quarantine = trace.snapshots.find((snapshot) => snapshot.id === "quarantine")!;
    delete quarantine.contrastEvent;
    expect(() => parseTrace(trace)).toThrow("contrast");
  });

  it("rejects an integrity checkpoint without recorded integrity data", () => {
    const trace = shippedTrace() as { snapshots: Array<Record<string, unknown>> };
    const integrity = trace.snapshots.find((snapshot) => snapshot.id === "integrity-check")!;
    delete integrity.integrity;
    expect(() => parseTrace(trace)).toThrow("integrity");
  });

  it("rejects a temporal correction checkpoint without its graph supersedes edge", () => {
    const trace = shippedTrace() as { snapshots: Array<Record<string, unknown>> };
    const after = trace.snapshots.find((snapshot) => snapshot.id === "temporal-after-correction")!;
    after.edges = (after.edges as Array<{ rel: string }>).filter((edge) => edge.rel !== "supersedes");
    expect(() => parseTrace(trace)).toThrow("supersedes");
  });
});
