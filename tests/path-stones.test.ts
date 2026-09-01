import { describe, expect, it } from "vitest";
import journeyData from "@content/path/journey";
import { getManifest } from "@/lib/manifests";
import { resolveJourney } from "@/lib/resolve-journey";
import { resolveHref } from "@/lib/types";
import { wikiUrlFor } from "@/lib/wiki";

const IN_PROGRESS = new Set(["early-builds", "autonomous-car", "microct-segmentation"]);

describe("Path stones", () => {
  const stones = resolveJourney(journeyData).phases.flatMap((p) => p.demos ?? []);

  it("leaves in-progress stones without hrefs", () => {
    for (const slug of IN_PROGRESS) {
      const stone = stones.find((s) => s.slug === slug);
      expect(stone, `missing stone ${slug}`).toBeTruthy();
      expect(stone!.href).toBeUndefined();
      expect(stone!.wikiHref).toBeUndefined();
      expect(stone!.status).toBe("in-progress");
    }
  });

  it("gives every built stone a clickable href from its manifest", () => {
    for (const stone of stones) {
      if (stone.status === "in-progress") continue;
      const manifest = getManifest(stone.slug);
      expect(manifest, `no manifest for ${stone.slug}`).toBeTruthy();
      expect(stone.href).toBe(resolveHref(manifest!, "/"));
    }
  });

  it("pairs live demos with a distinct wiki article link", () => {
    for (const stone of stones) {
      if (stone.status !== "live") continue;
      expect(stone.wikiHref).toBe(wikiUrlFor(stone.slug));
      expect(stone.wikiHref).not.toBe(stone.href);
      expect(stone.href).toMatch(/^\/demos\//);
    }
  });

  it("sends replica stones to their wiki articles", () => {
    for (const stone of stones) {
      if (stone.status !== "docs") continue;
      expect(stone.href).toBe(wikiUrlFor(stone.slug));
    }
  });
});
