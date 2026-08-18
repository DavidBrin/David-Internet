/**
 * Snippet generation — FROZEN API (functionality team owns internals, signatures fixed).
 *
 * Google-style extraction: collapse the body to one line, find the ~maxLen window holding
 * the densest cluster of query terms, cut at word boundaries, add "…" at each cut point and
 * emit every query-term occurrence as a bold segment.
 */

export interface SnippetSegment {
  text: string;
  bold: boolean;
}

const ELLIPSIS = "…";
const WORD_SPLIT = /[^\p{L}\p{N}']+/u;
/** Query words this short are noise for highlighting purposes. */
const MIN_TERM_LENGTH = 2;

interface Occurrence {
  start: number;
  end: number;
  term: string;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function queryTerms(query: string): string[] {
  const seen = new Set<string>();
  for (const raw of query.toLowerCase().split(WORD_SPLIT)) {
    if (raw.length >= MIN_TERM_LENGTH) seen.add(raw);
  }
  // Longest first so "youtube" wins over "you" when both are present.
  return [...seen].sort((a, b) => b.length - a.length);
}

/** Whole-word-ish matches: exact words, plus short inflections of 4+ char terms. */
function findOccurrences(text: string, terms: string[]): Occurrence[] {
  if (!terms.length) return [];
  const pattern = terms.map(escapeRegExp).join("|");
  let re: RegExp;
  try {
    re = new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})([\\p{L}\\p{N}]*)`, "giu");
  } catch {
    return [];
  }

  const found: Occurrence[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const term = match[1];
    const suffix = match[2] ?? "";
    if (match[0].length === 0) {
      re.lastIndex += 1;
      continue;
    }
    const acceptable = suffix.length === 0 || (term.length >= 4 && suffix.length <= 3);
    if (acceptable) {
      found.push({ start: match.index, end: match.index + term.length + suffix.length, term });
    }
  }
  return found;
}

/** Move `index` forward/backward onto the nearest word boundary inside [0, len]. */
function snapStart(text: string, index: number): number {
  if (index <= 0) return 0;
  let i = index;
  while (i < text.length && !/\s/.test(text[i - 1])) i++;
  while (i < text.length && /\s/.test(text[i])) i++;
  return i >= text.length ? index : i;
}

function snapEnd(text: string, index: number): number {
  if (index >= text.length) return text.length;
  let i = index;
  while (i > 0 && !/\s/.test(text[i])) i--;
  while (i > 0 && /\s/.test(text[i - 1])) i--;
  return i <= 0 ? index : i;
}

function pushSegment(segments: SnippetSegment[], text: string, bold: boolean): void {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last && last.bold === bold) {
    last.text += text;
    return;
  }
  segments.push({ text, bold });
}

export function buildSnippet(body: string, query: string, maxLen = 300): SnippetSegment[] {
  const text = (body ?? "").replace(/\s+/gu, " ").trim();
  if (!text) return [];
  const limit = Math.max(1, Math.floor(maxLen));

  const terms = queryTerms(query ?? "");
  const occurrences = findOccurrences(text, terms);

  let start = 0;
  let end = Math.min(text.length, limit);

  if (occurrences.length) {
    // Densest window: for each occurrence taken as the first one in view, count how many
    // (and how many *distinct* terms) fit within `limit` characters after it.
    let bestIndex = 0;
    let bestScore = -1;
    let bestLast = 0;
    for (let i = 0; i < occurrences.length; i++) {
      const windowEnd = occurrences[i].start + limit;
      const distinct = new Set<string>();
      let count = 0;
      let last = i;
      for (let j = i; j < occurrences.length && occurrences[j].end <= windowEnd; j++) {
        distinct.add(occurrences[j].term.toLowerCase());
        count++;
        last = j;
      }
      const score = distinct.size * 1000 + count;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
        bestLast = last;
      }
    }

    const first = occurrences[bestIndex];
    const span = Math.min(limit, occurrences[bestLast].end - first.start);
    const lead = Math.floor(Math.max(0, limit - span) / 2);
    start = Math.max(0, first.start - lead);
    end = Math.min(text.length, start + limit);
    start = Math.max(0, Math.min(start, end - limit));
  }

  const snappedStart = snapStart(text, start);
  const snappedEnd = snapEnd(text, end);
  start = snappedStart;
  end = Math.max(snappedEnd, snappedStart + 1);
  if (end > text.length) end = text.length;

  const segments: SnippetSegment[] = [];
  let cursor = start;
  for (const occ of occurrences) {
    if (occ.start < start || occ.end > end) continue;
    if (occ.start < cursor) continue;
    pushSegment(segments, text.slice(cursor, occ.start), false);
    pushSegment(segments, text.slice(occ.start, occ.end), true);
    cursor = occ.end;
  }
  pushSegment(segments, text.slice(cursor, end), false);
  if (!segments.length) pushSegment(segments, text.slice(start, end), false);

  if (start > 0) {
    if (segments[0].bold) segments.unshift({ text: ELLIPSIS, bold: false });
    else segments[0].text = ELLIPSIS + segments[0].text;
  }
  if (end < text.length) {
    const last = segments[segments.length - 1];
    if (last.bold) segments.push({ text: ELLIPSIS, bold: false });
    else last.text += ELLIPSIS;
  }

  return segments;
}
