/**
 * Images / Videos tab results — FROZEN API (functionality team owns internals).
 *
 * Deliberately simple scoring (no MiniSearch): the media corpus is tiny, and an empty query
 * must show the whole gallery in manifest order — exactly like Google Images with no filter.
 */
import type { ImageResult, SiteManifest, VideoResult } from "./types";
import { resolveHref } from "./types";

const WORD_SPLIT = /[^\p{L}\p{N}']+/u;

/** Field weights: what a media item "is about", strongest signal first. */
const WEIGHTS = {
  project: 5,
  displayName: 5,
  keywords: 4,
  caption: 3,
  fakeDomain: 2,
  targetPath: 2,
} as const;

type WeightedField = { text: string; weight: number };

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(WORD_SPLIT)
    .filter(Boolean);
}

function manifestFields(manifest: SiteManifest): WeightedField[] {
  return [
    { text: manifest.project, weight: WEIGHTS.project },
    { text: manifest.displayName, weight: WEIGHTS.displayName },
    { text: manifest.keywords.join(" "), weight: WEIGHTS.keywords },
    { text: manifest.fakeDomain, weight: WEIGHTS.fakeDomain },
  ];
}

function entryFields(manifest: SiteManifest, caption: string, targetPath: string): WeightedField[] {
  return [
    ...manifestFields(manifest),
    { text: caption, weight: WEIGHTS.caption },
    { text: targetPath, weight: WEIGHTS.targetPath },
  ];
}

/**
 * Sum of per-token field hits: a whole-word hit scores the field weight, a prefix/substring
 * hit scores half. Matching *every* query token earns a 1.5x bonus so AND-matches lead.
 */
function scoreFields(fields: WeightedField[], tokens: string[]): number {
  if (!tokens.length) return 1;
  let total = 0;
  let matchedTokens = 0;

  for (const token of tokens) {
    let best = 0;
    for (const field of fields) {
      const words = tokenize(field.text);
      if (words.includes(token)) {
        best = Math.max(best, field.weight);
      } else if (words.some((w) => w.startsWith(token) || (token.length >= 4 && w.includes(token)))) {
        best = Math.max(best, field.weight * 0.5);
      }
    }
    if (best > 0) matchedTokens++;
    total += best;
  }

  if (!total) return 0;
  return matchedTokens === tokens.length ? total * 1.5 : total;
}

interface Scored<T> {
  value: T;
  score: number;
  order: number;
}

/**
 * Weak hits are dropped: a query like "linear.davids.net" technically touches every entry
 * (every fake domain contains "davids" and "net"), but only the strong matches are results.
 */
const RELEVANCE_CUTOFF = 0.4;

function rank<T>(entries: Scored<T>[], hasQuery: boolean): T[] {
  let kept = entries;
  if (hasQuery) {
    const top = entries.reduce((max, e) => Math.max(max, e.score), 0);
    const floor = top * RELEVANCE_CUTOFF;
    kept = entries.filter((e) => e.score > 0 && e.score >= floor);
  }
  return kept
    .slice()
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.order - b.order))
    .map((e) => e.value);
}

export function imageResults(manifests: SiteManifest[], query: string): ImageResult[] {
  const tokens = tokenize((query ?? "").trim());
  const hasQuery = tokens.length > 0;
  const scored: Scored<ImageResult>[] = [];
  let order = 0;

  for (const manifest of manifests) {
    for (const image of manifest.images) {
      const fields = entryFields(manifest, image.caption, image.targetPath);
      scored.push({
        order: order++,
        score: hasQuery ? scoreFields(fields, tokens) : 1,
        value: {
          project: manifest.project,
          siteName: manifest.displayName,
          fakeDomain: manifest.fakeDomain,
          image,
          href: resolveHref(manifest, image.targetPath),
        },
      });
    }
  }

  return rank(scored, hasQuery);
}

export function videoResults(manifests: SiteManifest[], query: string): VideoResult[] {
  const tokens = tokenize((query ?? "").trim());
  const hasQuery = tokens.length > 0;
  const scored: Scored<VideoResult>[] = [];
  let order = 0;

  for (const manifest of manifests) {
    for (const video of manifest.videos) {
      const fields = entryFields(manifest, video.caption, video.targetPath);
      scored.push({
        order: order++,
        score: hasQuery ? scoreFields(fields, tokens) : 1,
        value: {
          project: manifest.project,
          siteName: manifest.displayName,
          fakeDomain: manifest.fakeDomain,
          video,
          href: resolveHref(manifest, video.targetPath),
        },
      });
    }
  }

  return rank(scored, hasQuery);
}
