import { describe, expect, it } from "vitest";
import { supersedesArrow } from "./relationships";

describe("supersedesArrow", () => {
  it("points from the detailed replacement card to the concise card it supersedes", () => {
    const arrow = supersedesArrow(
      [{ memory_id: "concise" }, { memory_id: "detailed" }],
      [{ src: "mem:detailed", dst: "mem:concise", rel: "supersedes" }]
    );

    expect(arrow).toEqual({ startY: 184, endY: 160 });
  });

  it("does not infer an arrow when the trace edge is absent from the visible records", () => {
    expect(supersedesArrow([{ memory_id: "concise" }], [{ src: "mem:detailed", dst: "mem:concise", rel: "supersedes" }])).toBeNull();
  });
});
