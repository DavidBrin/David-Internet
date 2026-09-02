import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WIKIPEDIA_BASE_URL, WIKI_SLUGS, wikiUrlFor } from "@/lib/wiki";
import { manifests } from "@/lib/manifests";
import { loadAllSearchDocs } from "@/lib/content.server";
import { createEngine } from "@/lib/search";

/**
 * The retired /sites/<project>/docs routes redirect to the Wikipedia replica
 * twice: vercel.json does it with a real HTTP redirect in production, and the
 * page component does it client-side everywhere else. This suite pins the two
 * to the same slug map so they can't drift.
 */
describe("wiki redirects", () => {
  const vercelJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"),
  ) as { redirects: Array<{ source: string; destination: string }> };

  it("covers every registered manifest with a wiki slug", () => {
    for (const m of manifests) {
      expect(WIKI_SLUGS[m.project], `no wiki slug for ${m.project}`).toBeTruthy();
    }
  });

  it("has one vercel.json redirect per project, pointing at its article", () => {
    // Vercel treats bare parentheses in `destination` as regex groups, so the
    // JSON percent-encodes them (%28/%29); decode before comparing.
    const bySource = new Map(
      vercelJson.redirects.map((r) => [r.source, decodeURIComponent(r.destination)]),
    );
    expect(bySource.size).toBe(Object.keys(WIKI_SLUGS).length);
    for (const project of Object.keys(WIKI_SLUGS)) {
      expect(bySource.get(`/sites/${project}/docs`)).toBe(wikiUrlFor(project));
    }
  });

  it("builds article URLs on the wikipedia deployment", () => {
    for (const project of Object.keys(WIKI_SLUGS)) {
      expect(wikiUrlFor(project)).toBe(`${WIKIPEDIA_BASE_URL}/wiki/${WIKI_SLUGS[project]}`);
    }
  });
});

describe("search corpus wiki routing", () => {
  const docs = loadAllSearchDocs();

  it("indexes the Wikipedia homepage", () => {
    const home = docs.find((d) => d.id === "wikipedia");
    expect(home?.href).toBe(WIKIPEDIA_BASE_URL);
    expect(home?.external).toBe(true);
    expect(home?.keywords).toContain("wikipedia");
  });

  it("sends demo documentation results to encyclopedia articles", () => {
    const esp32Docs = docs.find((d) => d.id === "esp32:docs");
    expect(esp32Docs?.href).toBe(wikiUrlFor("esp32"));
    expect(esp32Docs?.external).toBe(true);
    expect(esp32Docs?.displayUrl).toContain("wikipedia.davids.net");
  });

  it("ranks the Wikipedia homepage for a wikipedia query", () => {
    const top = createEngine(docs).search("wikipedia")[0];
    expect(top?.doc.id).toBe("wikipedia");
  });

  it("indexes a home document for every registered project", () => {
    for (const m of manifests) {
      const home = docs.find((d) => d.id === `${m.project}:home`);
      expect(home, `missing home doc for ${m.project}`).toBeTruthy();
      expect(home?.href).toBeTruthy();
    }
  });

  it("finds every project when searching its display name", () => {
    const engine = createEngine(docs);
    for (const m of manifests) {
      const hits = engine.search(m.displayName);
      expect(
        hits.some((h) => h.doc.project === m.project),
        `${m.displayName} should hit ${m.project}`,
      ).toBe(true);
    }
  });

  it("ranks FL Studio first for a fl studio query", () => {
    const top = createEngine(docs).search("fl studio")[0];
    expect(top?.doc.project).toBe("fl-studio");
    expect(top?.doc.kind).toBe("home");
    expect(top?.doc.href).toBe("https://fl-studio-david.vercel.app");
  });

  it("ranks Dollar Pixels first for a dollar pixels query", () => {
    const top = createEngine(docs).search("dollar pixels")[0];
    expect(top?.doc.project).toBe("dollar-pixels");
    expect(top?.doc.kind).toBe("home");
    expect(top?.doc.href).toBe("https://dollar-pixels-david.vercel.app");
  });

  it("ranks the Art-Wall deep link first for an art wall query", () => {
    const top = createEngine(docs).search("art wall")[0];
    expect(top?.doc.project).toBe("dollar-pixels");
    expect(top?.doc.kind).toBe("deeplink");
    expect(top?.doc.href).toBe("https://dollar-pixels-david.vercel.app/p/the-wall");
  });
});
