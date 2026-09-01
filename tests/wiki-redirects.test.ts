import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WIKIPEDIA_BASE_URL, WIKI_SLUGS, wikiUrlFor } from "@/lib/wiki";
import { manifests } from "@/lib/manifests";

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

  it("covers every registered replica manifest with a wiki slug (demos are internal)", () => {
    for (const m of manifests) {
      if (m.kind === "demo") continue;
      expect(WIKI_SLUGS[m.project], `no wiki slug for ${m.project}`).toBeTruthy();
    }
  });

  it("has one vercel.json redirect per project, pointing at its article", () => {
    const bySource = new Map(vercelJson.redirects.map((r) => [r.source, r.destination]));
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
