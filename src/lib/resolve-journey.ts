import type { Journey } from "./journey";
import { getManifest } from "./manifests";
import { resolveHref } from "./types";
import { hasWikiArticle, wikiUrlFor } from "./wiki";

/**
 * Fill Path stones from the manifest registry. Authored journey data only
 * carries slugs; this is what makes a built stone a link (and keeps
 * in-progress stones inert).
 */
export function resolveJourney(journey: Journey): Journey {
  return {
    ...journey,
    phases: journey.phases.map((phase) => ({
      ...phase,
      demos: phase.demos?.map((demo) => {
        const manifest = getManifest(demo.slug);
        if (!manifest || demo.status === "in-progress") return demo;
        const href = resolveHref(manifest, "/");
        return {
          ...demo,
          href,
          status: manifest.liveUrl ? ("live" as const) : ("docs" as const),
          ...(hasWikiArticle(demo.slug) ? { wikiHref: wikiUrlFor(demo.slug) } : {}),
        };
      }),
    })),
  };
}
