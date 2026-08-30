/**
 * /path — "The Path": the river journey through David's life.
 * Server side: resolve demo hrefs through the manifest registry (live URL or
 * docs fallback stays single-sourced), then hand the whole journey to the
 * client renderer. Statically exported like everything else.
 */
import type { Metadata } from "next";
import journeyData from "@content/path/journey";
import type { Journey } from "@/lib/journey";
import { getManifest } from "@/lib/manifests";
import { resolveHref } from "@/lib/types";
import PathClient from "@/components/path/PathClient";
import "./path.css";

export const metadata: Metadata = {
  title: "The Path — David's Internet",
  description:
    "Follow the river: a scroll-born stream that flows through the chapters of David's life, from the Sierra Nevada to the sea.",
};

function resolveJourney(journey: Journey): Journey {
  return {
    ...journey,
    phases: journey.phases.map((phase) => ({
      ...phase,
      demos: phase.demos?.map((demo) => {
        const manifest = getManifest(demo.slug);
        if (!manifest || demo.status === "in-progress") return demo;
        return {
          ...demo,
          href: resolveHref(manifest, "/"),
          status: manifest.liveUrl ? ("live" as const) : ("docs" as const),
        };
      }),
    })),
  };
}

export default function PathPage() {
  return <PathClient journey={resolveJourney(journeyData)} />;
}
