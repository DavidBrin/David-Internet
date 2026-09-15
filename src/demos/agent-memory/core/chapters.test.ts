import { describe, expect, it } from "vitest";
import { chapterFromHash } from "./chapters";

describe("Agent Memory Timeline chapter hashes", () => {
  it.each([
    ["#rag-baseline", "rag"],
    ["#temporal-memory", "temporal"],
    ["#context-graph-retrieval", "graph"],
  ] as const)("selects %s", (hash, chapter) => {
    expect(chapterFromHash(hash)).toBe(chapter);
  });

  it("ignores unrelated hashes", () => {
    expect(chapterFromHash("#other")).toBeNull();
  });
});
