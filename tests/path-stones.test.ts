import { describe, expect, it } from "vitest";
import journeyData from "@content/path/journey";
import { getManifest } from "@/lib/manifests";
import { resolveJourney } from "@/lib/resolve-journey";
import { WIKIPEDIA_BASE_URL, WIKI_SLUGS, wikiUrlFor } from "@/lib/wiki";

const INERT_SLUGS = ["autonomous-car", "microct-segmentation", "early-builds"] as const;

describe("Path stones", () => {
  const stones = resolveJourney(journeyData).phases.flatMap((p) => p.demos ?? []);
  const bySlug = new Map(stones.map((s) => [s.slug, s]));

  it("leaves autonomous-car, microct-segmentation, and early-builds without hrefs", () => {
    for (const slug of INERT_SLUGS) {
      const stone = bySlug.get(slug);
      expect(stone, `missing stone ${slug}`).toBeTruthy();
      expect(stone!.href).toBeUndefined();
      expect(stone!.wikiHref).toBeUndefined();
      expect(stone!.status).toBe("in-progress");
    }
  });

  it("gives every non-in-progress stone the expected href(s)", () => {
    const inert = new Set<string>(INERT_SLUGS);
    for (const stone of stones) {
      if (inert.has(stone.slug) || stone.status === "in-progress") {
        expect(stone.href, stone.slug).toBeUndefined();
        expect(stone.wikiHref, stone.slug).toBeUndefined();
        continue;
      }

      expect(stone.href, stone.slug).toBeTruthy();
      expect(stone.wikiHref, stone.slug).toBe(wikiUrlFor(stone.slug));
      expect(WIKI_SLUGS[stone.slug], `no wiki slug for ${stone.slug}`).toBeTruthy();

      const manifest = getManifest(stone.slug);
      if (manifest?.kind === "demo") {
        expect(stone.href).toBe(`/demos/${stone.slug}`);
        expect(stone.wikiHref).not.toBe(stone.href);
      } else {
        expect(stone.href).toBe(wikiUrlFor(stone.slug));
      }
    }
  });

  it("wires nocturnal to /demos/nocturnal and the Nocturnal_Neuro article", () => {
    const stone = bySlug.get("nocturnal");
    expect(stone?.status).toBe("live");
    expect(stone?.href).toBe("/demos/nocturnal");
    expect(stone?.wikiHref).toBe(`${WIKIPEDIA_BASE_URL}/wiki/Nocturnal_Neuro`);
  });
});
