import { beforeAll, describe, expect, it } from "vitest";
import { createEngine, feelingLucky, type SearchEngine } from "@/lib/search";
import { displayUrlFor, resolveHref } from "@/lib/types";
import { docs, fakePhoneManifest, youtubeManifest } from "./fixtures";

let engine: SearchEngine;

beforeAll(() => {
  engine = createEngine(docs);
});

describe("createEngine().search", () => {
  it("returns [] for an empty or whitespace query", () => {
    expect(engine.search("")).toEqual([]);
    expect(engine.search("   ")).toEqual([]);
    expect(engine.search("!!! ???")).toEqual([]);
  });

  it("surfaces several documents of a project for a bare project-name query", () => {
    const results = engine.search("youtube");
    const youtubeHits = results.filter((r) => r.doc.project === "youtube");
    expect(youtubeHits.length).toBeGreaterThanOrEqual(3);
  });

  it("ranks the project home page first for the project name", () => {
    const top = engine.search("youtube")[0];
    expect(top.doc.project).toBe("youtube");
    expect(top.doc.kind).toBe("home");

    const linearTop = engine.search("linear")[0];
    expect(linearTop.doc.id).toBe("linear:home");
  });

  it("returns scores in descending order", () => {
    const scores = engine.search("video player").map((r) => r.score);
    expect(scores.length).toBeGreaterThan(1);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  it("combines terms with OR but ranks the all-terms match higher", () => {
    const results = engine.search("prank call");
    const ids = results.map((r) => r.doc.id);
    // OR: an unrelated doc that only matches "call" may still appear...
    expect(ids).toContain("fake-phone:call");
    // ...but the doc matching both terms leads.
    expect(results[0].doc.project).toBe("fake-phone");
    expect(results[0].score).toBeGreaterThan(results[results.length - 1].score);
  });

  it("matches on keywords and title, not only body text", () => {
    const ids = engine.search("kanban").map((r) => r.doc.id);
    expect(ids).toContain("linear:home");
  });

  it("tolerates a typo via fuzzy matching", () => {
    const ids = engine.search("kanbin").map((r) => r.doc.id);
    expect(ids).toContain("linear:home");
  });

  it("supports prefix matching for partially typed words", () => {
    const ids = engine.search("subscrip").map((r) => r.doc.id);
    expect(ids).toContain("youtube:subscriptions");
  });

  it("is deterministic for the same docs and query", () => {
    const a = engine.search("video").map((r) => `${r.doc.id}:${r.score}`);
    const b = createEngine(docs).search("video").map((r) => `${r.doc.id}:${r.score}`);
    expect(a).toEqual(b);
  });

  it("returns whole SearchDoc objects, not index rows", () => {
    const [first] = engine.search("linear");
    expect(first.doc).toBe(docs.find((d) => d.id === first.doc.id));
    expect(first.doc.favicon).toBeTruthy();
    expect(typeof first.doc.external).toBe("boolean");
  });

  it("returns [] when nothing matches", () => {
    expect(engine.search("zzzzqqqqxxxx")).toEqual([]);
  });
});

describe("createEngine().suggest", () => {
  it("returns [] for an empty prefix", () => {
    expect(engine.suggest("")).toEqual([]);
    expect(engine.suggest("  ")).toEqual([]);
  });

  it("gives sensible completions for one or two characters", () => {
    expect(engine.suggest("y")).toContain("youtube");
    expect(engine.suggest("li")).toContain("linear");
    expect(engine.suggest("ph")).toContain("phone");
  });

  it("prefix-matches curated keywords", () => {
    const suggestions = engine.suggest("kan");
    expect(suggestions).toContain("kanban");
  });

  it("lowercases and dedupes", () => {
    const suggestions = engine.suggest("you");
    expect(new Set(suggestions).size).toBe(suggestions.length);
    for (const s of suggestions) expect(s).toBe(s.toLowerCase());
  });

  it("caps the list at 8 entries", () => {
    for (const prefix of ["p", "c", "s", "l", "d"]) {
      expect(engine.suggest(prefix).length).toBeLessThanOrEqual(8);
    }
  });

  it("puts the most relevant completion first", () => {
    expect(engine.suggest("you")[0]).toBe("youtube");
    expect(engine.suggest("pran")[0]).toBe("prank");
  });

  it("completes the last word and keeps the words already typed", () => {
    const suggestions = engine.suggest("video pla");
    expect(suggestions[0]).toBe("video player");
    expect(engine.suggest("prank c")[0]).toBe("prank call");
    for (const s of engine.suggest("prank c")) expect(s.startsWith("prank")).toBe(true);
  });

  it("never echoes the prefix back unchanged as its only suggestion", () => {
    expect(engine.suggest("youtube")).not.toContain("youtube");
  });
});

describe("createEngine().didYouMean", () => {
  it("corrects a classic misspelling", () => {
    expect(engine.didYouMean("yotube")).toBe("youtube");
    expect(engine.didYouMean("linnear")).toBe("linear");
  });

  it("corrects one word inside a multi-word query", () => {
    expect(engine.didYouMean("kanbin board")).toBe("kanban board");
  });

  it("corrects appended-character typos rather than treating them as prefixes", () => {
    // "youtubexxx" extends a known word, gets zero prefix hits, and must still
    // be eligible for correction; "youtub" is a genuine partial-word query.
    expect(engine.didYouMean("youtubexxx")).toBe("youtube");
    expect(engine.didYouMean("youtub")).toBeNull();
  });

  it("returns null for a query that is already good", () => {
    expect(engine.didYouMean("youtube")).toBeNull();
    expect(engine.didYouMean("linear")).toBeNull();
    expect(engine.didYouMean("video player")).toBeNull();
    expect(engine.didYouMean("issues")).toBeNull();
  });

  it("returns null for an empty query", () => {
    expect(engine.didYouMean("")).toBeNull();
    expect(engine.didYouMean("   ")).toBeNull();
  });

  it("returns null when nothing in the corpus is remotely close", () => {
    expect(engine.didYouMean("qwertyuiop")).toBeNull();
  });

  it("only proposes corrections that actually find results", () => {
    const suggestion = engine.didYouMean("yotube");
    expect(suggestion).not.toBeNull();
    expect(engine.search(suggestion as string).length).toBeGreaterThan(0);
  });
});

describe("feelingLucky", () => {
  it("picks a home-kind href with a seeded random", () => {
    const homes = docs.filter((d) => d.kind === "home");
    const seeds = [0, 0.34, 0.5, 0.99];
    for (const seed of seeds) {
      const href = feelingLucky(docs, () => seed);
      expect(homes.map((h) => h.href)).toContain(href);
    }
  });

  it("is deterministic for a fixed random source", () => {
    expect(feelingLucky(docs, () => 0)).toBe(feelingLucky(docs, () => 0));
    expect(feelingLucky(docs, () => 0)).toBe(docs.filter((d) => d.kind === "home")[0].href);
  });

  it("falls back to any doc when there is no home page", () => {
    const noHomes = docs.filter((d) => d.kind !== "home");
    expect(feelingLucky(noHomes, () => 0)).toBe(noHomes[0].href);
  });

  it("falls back to /about with an empty corpus", () => {
    expect(feelingLucky([], () => 0.5)).toBe("/about");
  });
});

describe("href / breadcrumb helpers (frozen contract, exercised via fixtures)", () => {
  it("resolves live deployment hrefs", () => {
    expect(resolveHref(youtubeManifest, "/")).toBe("https://youtube-david.vercel.app");
    expect(resolveHref(youtubeManifest, "/watch")).toBe("https://youtube-david.vercel.app/watch");
  });

  it("falls back to the internal docs page when liveUrl is null", () => {
    expect(fakePhoneManifest.liveUrl).toBeNull();
    expect(resolveHref(fakePhoneManifest, "/")).toBe("/sites/fake-phone/docs");
    expect(resolveHref(fakePhoneManifest, "/call")).toBe("/sites/fake-phone/docs");
    const phoneDocs = docs.filter((d) => d.project === "fake-phone");
    expect(phoneDocs.length).toBeGreaterThan(0);
    for (const doc of phoneDocs) {
      if (doc.href.startsWith("/sites/")) expect(doc.external).toBe(false);
    }
  });

  it("builds Google-style breadcrumbs", () => {
    expect(displayUrlFor("youtube.davids.net", "/")).toBe("youtube.davids.net");
    expect(displayUrlFor("youtube.davids.net", "/watch")).toBe("youtube.davids.net › watch");
    expect(displayUrlFor("linear.davids.net", "/issues/[id]")).toBe("linear.davids.net › issues › id");
  });
});
