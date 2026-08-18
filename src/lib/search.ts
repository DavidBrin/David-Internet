/**
 * Search engine — FROZEN API (functionality team owns internals, signatures fixed).
 * Runs fully client-side over a prebuilt SearchDoc[] (built server-side at build time).
 *
 * Implementation notes:
 * - MiniSearch index over title / keywords / snippet / body with heavy title+keyword boosts.
 * - Queries combine with OR (so a two-word query still returns partial matches) but results
 *   that match *all* query terms are re-weighted upward, which reproduces Google's habit of
 *   floating the full-phrase match to the top while still showing the long tail.
 * - No node-only imports: this module is safe to bundle into a client component.
 * - Deterministic: same docs + same query => same ordering (ties broken by doc id).
 */
import MiniSearch from "minisearch";
import type { SearchDoc, SearchDocKind, SearchResult } from "./types";

const INDEX_FIELDS = ["title", "keywords", "snippet", "body"] as const;

/** Field weights — title and keywords dominate, body is the tie-breaker. */
const FIELD_BOOST: Record<string, number> = {
  title: 8,
  keywords: 6,
  snippet: 2,
  body: 1,
};

/**
 * Per-kind weight. A site's home page should generally out-rank its sub-pages for a
 * bare project-name query, the way google.com/search?q=youtube leads with the homepage.
 */
const KIND_BOOST: Record<SearchDocKind, number> = {
  home: 1.6,
  deeplink: 1.0,
  docs: 0.9,
  decisions: 0.8,
  about: 1.0,
};

/** How much a result gains for covering every query term (AND-match preference). */
const COVERAGE_BONUS = 1.5;

const WORD_SPLIT = /[^\p{L}\p{N}']+/u;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(WORD_SPLIT)
    .filter((t) => t.length > 0);
}

function fieldValue(doc: SearchDoc, fieldName: string): string {
  const value = (doc as unknown as Record<string, unknown>)[fieldName];
  if (Array.isArray(value)) return value.join(" ");
  return typeof value === "string" ? value : "";
}

/** Optimal string alignment distance (Levenshtein + adjacent transpositions). */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) rows.push(new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2][j - 2] + 1);
      }
      rows[i][j] = best;
    }
  }
  return rows[a.length][b.length];
}

/** Distance we tolerate when proposing a correction, by length of the typed token. */
function maxCorrectionDistance(token: string): number {
  if (token.length <= 3) return 0;
  if (token.length <= 5) return 1;
  if (token.length <= 8) return 2;
  return 3;
}

export interface SearchEngine {
  /** Ranked full-text search. Empty query → []. */
  search(query: string): SearchResult[];
  /** Autocomplete suggestions for the dropdown (queries that would return hits). */
  suggest(prefix: string): string[];
  /** "Did you mean:" — a corrected query with more hits, or null. */
  didYouMean(query: string): string | null;
  readonly docs: SearchDoc[];
}

export function createEngine(docs: SearchDoc[]): SearchEngine {
  const mini = new MiniSearch<SearchDoc>({
    idField: "id",
    fields: [...INDEX_FIELDS],
    // The full doc is kept alongside the index so results carry the whole SearchDoc.
    storeFields: ["id"],
    extractField: fieldValue,
  });
  mini.addAll(docs);

  /** id → doc, so a hit can be rehydrated into the frozen SearchDoc shape. */
  const byId = new Map<string, SearchDoc>();
  /** Stable position, used as the final deterministic tie-break. */
  const order = new Map<string, number>();
  docs.forEach((doc, i) => {
    byId.set(doc.id, doc);
    order.set(doc.id, i);
  });

  /** Every token that appears anywhere in the corpus — used to spot "unknown" words. */
  const knownTokens = new Set<string>();
  /** Curated correction targets (keywords, title words, project slugs) → frequency. */
  const candidateTerms = new Map<string, number>();

  for (const doc of docs) {
    for (const field of INDEX_FIELDS) {
      for (const token of tokenize(fieldValue(doc, field))) knownTokens.add(token);
    }
    const curated = [...doc.keywords, doc.title, doc.project ?? ""].join(" ");
    for (const token of tokenize(curated)) {
      if (token.length < 3) continue;
      candidateTerms.set(token, (candidateTerms.get(token) ?? 0) + 1);
    }
  }
  const knownList = [...knownTokens];

  const baseSearchOptions = {
    boost: FIELD_BOOST,
    prefix: true,
    fuzzy: 0.2,
    combineWith: "OR" as const,
    boostDocument: (id: unknown) => {
      const doc = byId.get(String(id));
      return doc ? KIND_BOOST[doc.kind] ?? 1 : 1;
    },
  };

  function runSearch(query: string): SearchResult[] {
    const q = query.trim();
    if (!q) return [];
    const queryTokens = tokenize(q);
    if (!queryTokens.length) return [];

    const raw = mini.search(q, baseSearchOptions);
    const results: SearchResult[] = [];
    for (const hit of raw) {
      const doc = byId.get(String(hit.id));
      if (!doc) continue;
      const matched = new Set((hit.queryTerms ?? []).map((t) => t.toLowerCase()));
      const coverage = queryTokens.length ? matched.size / queryTokens.length : 0;
      results.push({ doc, score: hit.score * (1 + COVERAGE_BONUS * coverage) });
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (order.get(a.doc.id) ?? 0) - (order.get(b.doc.id) ?? 0);
    });
    return results;
  }

  /** true when the token plausibly exists in the corpus (exact, prefix, or simple plural). */
  function isKnownToken(token: string): boolean {
    if (knownTokens.has(token)) return true;
    if (token.endsWith("s") && knownTokens.has(token.slice(0, -1))) return true;
    if (knownTokens.has(`${token}s`)) return true;
    if (token.length < 3) return true;
    // Prefix search means a partially typed word is a legitimate query, not a typo.
    // The reverse (token extending a known word, e.g. "youtubexxx") gets NO prefix
    // hits, so it must stay eligible for correction.
    return knownList.some((k) => k.startsWith(token));
  }

  function correctToken(token: string): string | null {
    const limit = maxCorrectionDistance(token);
    if (limit === 0) return null;
    let best: string | null = null;
    let bestDistance = Infinity;
    let bestFreq = -1;
    for (const [term, freq] of candidateTerms) {
      if (Math.abs(term.length - token.length) > limit) continue;
      const d = editDistance(token, term);
      if (d > limit) continue;
      // Closest wins; then the most widely used term; then alphabetical (determinism).
      const better =
        d < bestDistance ||
        (d === bestDistance && freq > bestFreq) ||
        (d === bestDistance && freq === bestFreq && best !== null && term < best);
      if (better) {
        best = term;
        bestDistance = d;
        bestFreq = freq;
      }
    }
    return best;
  }

  return {
    docs,
    search: runSearch,

    suggest(prefix: string): string[] {
      const p = prefix.trim().toLowerCase();
      if (!p) return [];

      // score → higher is better. Curated keyword completions sit above index suggestions
      // so that 1–2 character prefixes still produce the obvious, hand-picked answers.
      const scored = new Map<string, number>();
      const bump = (text: string, score: number) => {
        const key = text.trim().toLowerCase();
        // Echoing exactly what was typed is not a suggestion.
        if (!key || key === p) return;
        const current = scored.get(key);
        if (current === undefined || score > current) scored.set(key, score);
      };

      const promptTokens = p.split(WORD_SPLIT).filter(Boolean);
      const lastToken = promptTokens[promptTokens.length - 1] ?? p;
      /** Keep autoSuggest phrases roughly as long as what was typed — no word salad. */
      const maxWords = Math.max(1, promptTokens.length);
      for (const doc of docs) {
        for (const keyword of doc.keywords) {
          const k = keyword.toLowerCase();
          if (k === p) continue;
          if (k.startsWith(p)) {
            bump(k, 1000 + (candidateTerms.get(k) ?? 1) + 1 / (k.length + 1));
          } else if (lastToken !== p && k.startsWith(lastToken)) {
            // Multi-word prefix: complete the last word, keep the words already typed.
            const phrase = [...promptTokens.slice(0, -1), k].join(" ");
            bump(phrase, 500 + (candidateTerms.get(k) ?? 1) + 1 / (k.length + 1));
          }
        }
      }

      try {
        for (const s of mini.autoSuggest(p, {
          ...baseSearchOptions,
          fuzzy: p.length >= 4 ? 0.2 : false,
        })) {
          const words = s.suggestion.split(WORD_SPLIT).filter(Boolean);
          if (words.length > maxWords) continue;
          // A completion must keep the words the user already finished typing.
          const keepsPrefix = promptTokens
            .slice(0, -1)
            .every((t) => words.some((w) => w.startsWith(t)));
          if (!keepsPrefix) continue;
          bump(s.suggestion, s.score);
        }
      } catch {
        // autoSuggest can throw on a query with no indexable tokens — curated list stands.
      }

      return [...scored.entries()]
        .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
        .map(([text]) => text)
        .slice(0, 8);
    },

    didYouMean(query: string): string | null {
      const q = query.trim();
      if (!q) return null;
      const tokens = tokenize(q);
      if (!tokens.length) return null;

      let changed = false;
      const corrected = tokens.map((token) => {
        if (isKnownToken(token)) return token;
        const fix = correctToken(token);
        if (!fix || fix === token) return token;
        changed = true;
        return fix;
      });
      if (!changed) return null;

      const suggestion = corrected.join(" ");
      if (suggestion === q.toLowerCase()) return null;
      // Only offer a correction that actually finds something.
      if (!runSearch(suggestion).length) return null;
      return suggestion;
    },
  };
}

/** "I'm Feeling Lucky": href of a random result-worthy destination. */
export function feelingLucky(docs: SearchDoc[], random: () => number = Math.random): string {
  const homes = docs.filter((d) => d.kind === "home");
  const pool = homes.length ? homes : docs;
  if (!pool.length) return "/about";
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  return pool[index].href;
}
