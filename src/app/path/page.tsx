/**
 * /path — "The Path": the river journey through David's life.
 * Server side: resolve demo hrefs through the manifest registry (live URL or
 * docs fallback stays single-sourced), then hand the whole journey to the
 * client renderer. Statically exported like everything else.
 */
import type { Metadata } from "next";
import journeyData from "@content/path/journey";
import { resolveJourney } from "@/lib/resolve-journey";
import PathClient from "@/components/path/PathClient";
import "./path.css";

export const metadata: Metadata = {
  title: "The Path - David's Internet",
  description:
    "Follow the river: a scroll-born stream that flows through the chapters of David's life, from the Sierra Nevada to the sea.",
};

export default function PathPage() {
  return <PathClient journey={resolveJourney(journeyData)} />;
}
