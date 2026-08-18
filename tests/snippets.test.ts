import { describe, expect, it } from "vitest";
import { buildSnippet, type SnippetSegment } from "@/lib/snippets";
import { docs } from "./fixtures";

const plain = (segments: SnippetSegment[]) => segments.map((s) => s.text).join("");
const bolded = (segments: SnippetSegment[]) =>
  segments.filter((s) => s.bold).map((s) => s.text.toLowerCase());

const BODY =
  "The quick brown fox jumps over the lazy dog. " +
  "Padding sentence one keeps this body comfortably longer than any snippet window. " +
  "Padding sentence two keeps going with more filler words to push the interesting part away. " +
  "Deep in the middle the kanban board groups issues by status, and the kanban swimlanes " +
  "collapse when the kanban column is empty. " +
  "Trailing filler continues afterwards so that the tail also has to be cut off somewhere.";

describe("buildSnippet", () => {
  it("returns [] for an empty body", () => {
    expect(buildSnippet("", "youtube")).toEqual([]);
    expect(buildSnippet("   \n  ", "youtube")).toEqual([]);
  });

  it("falls back to the start of the body when the query is empty", () => {
    const segments = buildSnippet(BODY, "", 80);
    expect(segments.every((s) => !s.bold)).toBe(true);
    expect(plain(segments).startsWith("The quick brown fox")).toBe(true);
    expect(plain(segments).endsWith("…")).toBe(true);
  });

  it("falls back to the start of the body when no query term is found", () => {
    const segments = buildSnippet(BODY, "zzzzz nothingness", 80);
    expect(bolded(segments)).toEqual([]);
    expect(plain(segments).startsWith("The quick brown fox")).toBe(true);
    expect(plain(segments).endsWith("…")).toBe(true);
  });

  it("does not add a trailing ellipsis when the whole body fits", () => {
    const segments = buildSnippet("Short body about linear.", "linear", 300);
    expect(plain(segments)).toBe("Short body about linear.");
    expect(bolded(segments)).toEqual(["linear"]);
  });

  it("bolds each occurrence of a query term, case-insensitively", () => {
    const segments = buildSnippet("Linear is linear and LINEAR again.", "linear", 300);
    expect(bolded(segments)).toEqual(["linear", "linear", "linear"]);
    expect(plain(segments)).toBe("Linear is linear and LINEAR again.");
  });

  it("does not bold a term that only appears inside another word", () => {
    const segments = buildSnippet("Collinearity is not the topic here.", "linear", 300);
    expect(bolded(segments)).toEqual([]);
  });

  it("bolds a short inflection of a longer term", () => {
    const segments = buildSnippet("The issues list shows every issue.", "issue", 300);
    expect(bolded(segments)).toEqual(["issues", "issue"]);
  });

  it("windows onto the densest cluster of query terms", () => {
    const segments = buildSnippet(BODY, "kanban", 120);
    const text = plain(segments);
    expect(text).toContain("kanban");
    expect(text.startsWith("…")).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(bolded(segments).length).toBeGreaterThanOrEqual(2);
    expect(text.includes("quick brown fox")).toBe(false);
  });

  it("keeps the window within maxLen (ellipses aside) and cuts on word boundaries", () => {
    const segments = buildSnippet(BODY, "kanban", 120);
    const text = plain(segments);
    const inner = text.replace(/…/g, "");
    expect(inner.length).toBeLessThanOrEqual(120);
    // No half-words at either edge.
    expect(BODY.replace(/\s+/g, " ")).toContain(inner.trim());
    expect(/^\S/.test(inner)).toBe(true);
  });

  it("collapses whitespace and newlines from the source body", () => {
    const segments = buildSnippet("line one\n\n   line two\ttabbed", "line", 300);
    expect(plain(segments)).toBe("line one line two tabbed");
  });

  it("handles multi-term queries by preferring the window covering both terms", () => {
    const body =
      "Alpha mentions video once. " +
      "Filler filler filler filler filler filler filler filler filler filler filler. " +
      "Later on the video player and the player controls appear together in one sentence.";
    const segments = buildSnippet(body, "video player", 90);
    const terms = bolded(segments);
    expect(terms).toContain("video");
    expect(terms).toContain("player");
  });

  it("never emits empty or adjacent same-style segments", () => {
    const segments = buildSnippet(docs[0].body, "video player feed", 200);
    expect(segments.length).toBeGreaterThan(1);
    for (const s of segments) expect(s.text.length).toBeGreaterThan(0);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].bold === segments[i - 1].bold).toBe(false);
    }
  });

  it("is safe with regex-special characters in the query", () => {
    expect(() => buildSnippet(BODY, "c++ (a|b) [x]", 100)).not.toThrow();
    expect(plain(buildSnippet(BODY, "c++ (a|b) [x]", 100)).length).toBeGreaterThan(0);
  });

  it("works over a real fixture doc body", () => {
    const doc = docs.find((d) => d.id === "youtube:watch")!;
    const segments = buildSnippet(doc.body, "comments", 140);
    expect(bolded(segments)).toContain("comments");
    expect(plain(segments).replace(/…/g, "").length).toBeLessThanOrEqual(140);
  });
});
