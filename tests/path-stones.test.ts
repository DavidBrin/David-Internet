import { describe, expect, it } from "vitest";
import journeyData from "@content/path/journey";
import { getManifest } from "@/lib/manifests";
import { resolveJourney } from "@/lib/resolve-journey";
import { WIKIPEDIA_BASE_URL, WIKI_SLUGS, wikiUrlFor } from "@/lib/wiki";

const INERT_SLUGS = ["autonomous-car"] as const;

const NEW_LIVE = [
  ["modeling", "Early_3D_Modeling"],
  ["earlycode", "Early_Code"],
  ["p300", "P300_Speller"],
  ["crossteach", "Cross-Teaching_Segmentation"],
  ["sql", "SQL_Playground"],
] as const;

describe("Path stones", () => {
  const stones = resolveJourney(journeyData).phases.flatMap((p) => p.demos ?? []);
  const bySlug = new Map(stones.map((s) => [s.slug, s]));

  it("leaves autonomous-car without hrefs", () => {
    for (const slug of INERT_SLUGS) {
      const stone = bySlug.get(slug);
      expect(stone, `missing stone ${slug}`).toBeTruthy();
      expect(stone!.href).toBeUndefined();
      expect(stone!.wikiHref).toBeUndefined();
      expect(stone!.status).toBe("in-progress");
    }
  });

  it("does not keep placeholder stones for demos that are now live", () => {
    expect(bySlug.has("early-builds")).toBe(false);
    expect(bySlug.has("microct-segmentation")).toBe(false);
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
      } else if (manifest?.liveUrl) {
        expect(stone.href).toBe(manifest.liveUrl);
        expect(stone.status).toBe("live");
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

  it("links the five newest live demos to /demos/<slug> and their wiki articles", () => {
    for (const [slug, wikiSlug] of NEW_LIVE) {
      const stone = bySlug.get(slug);
      expect(stone, `missing stone ${slug}`).toBeTruthy();
      expect(stone!.status).toBe("live");
      expect(stone!.href).toBe(`/demos/${slug}`);
      expect(stone!.wikiHref).toBe(`${WIKIPEDIA_BASE_URL}/wiki/${wikiSlug}`);
    }
  });
});
