import { describe, expect, it, vi } from "vitest";
import { focusChapterAnchor } from "./navigation";

describe("focusChapterAnchor", () => {
  it("focuses and scrolls a chapter after it has been rendered for a hash navigation", () => {
    const focus = vi.fn();
    const scrollIntoView = vi.fn();
    const documentLike = {
      getElementById: vi.fn(() => ({ focus, scrollIntoView })),
    };

    expect(focusChapterAnchor("temporal-memory", documentLike)).toBe(true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("does nothing when the requested anchor is not in the rendered chapter", () => {
    expect(focusChapterAnchor("temporal-memory", { getElementById: () => null })).toBe(false);
  });
});
