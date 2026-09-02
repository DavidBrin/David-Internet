import type { Journey } from "./journey";
import { getManifest } from "./manifests";
import { resolveHref } from "./types";
import { hasWikiArticle, wikiUrlFor } from "./wiki";

/**
 * Fill Path stones from the manifest registry and wiki slug map. Authored
 * journey data only carries slugs; this is what makes a built stone a link
 * (and keeps in-progress stones inert).
 *
 * Live demos → `/demos/<slug>` plus a distinct encyclopedia `wikiHref`.
 * Replicas → Wikipedia article URL (href and wikiHref; no live replica yet).
 */
export function resolveJourney(journey: Journey): Journey {
  return {
    ...journey,
    phases: journey.phases.map((phase) => ({
      ...phase,
      demos: phase.demos?.map((demo) => {
        if (demo.status === "in-progress") return demo;

        const wikiHref = hasWikiArticle(demo.slug) ? wikiUrlFor(demo.slug) : undefined;
        const manifest = getManifest(demo.slug);

        if (!manifest) {
          if (!wikiHref) return demo;
          return { ...demo, href: wikiHref, wikiHref, status: "docs" as const };
        }

        const href =
          manifest.kind === "demo" ? `/demos/${demo.slug}` : resolveHref(manifest, "/");

        return {
          ...demo,
          href,
          status: manifest.kind === "demo" || manifest.liveUrl ? ("live" as const) : ("docs" as const),
          ...(wikiHref ? { wikiHref } : {}),
        };
      }),
    })),
  };
}
