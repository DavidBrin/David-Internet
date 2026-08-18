"use client";

/**
 * The results page. Everything below the header is derived from ?q= and ?tab=,
 * read client-side so the whole route can be statically exported.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createEngine } from "@/lib/search";
import { imageResults, videoResults } from "@/lib/media";
import { getManifest, manifests } from "@/lib/manifests";
import type { SearchDoc, SearchResult, SiteManifest } from "@/lib/types";
import SearchBox from "./SearchBox";
import Wordmark from "./Wordmark";
import Tabs, { tabHref } from "./Tabs";
import type { SearchTab } from "./Tabs";
import ResultItem from "./ResultItem";
import KnowledgePanelCard from "./KnowledgePanelCard";
import ImagesGrid from "./ImagesGrid";
import VideoList from "./VideoList";
import EmptyState from "./EmptyState";
import Footer from "./Footer";
import { AppsGridIcon } from "./Icons";

interface SearchPageClientProps {
  docs: SearchDoc[];
}

/**
 * Deterministic "search took N seconds" theatre: hashing the query keeps the
 * server-rendered shell and the client hydration byte-identical.
 */
function searchSeconds(query: string): string {
  let hash = 2166136261;
  for (let i = 0; i < query.length; i += 1) {
    hash ^= query.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const spread = Math.abs(hash % 41); // 0–40 → 0.20–0.60 s
  return (0.2 + spread / 100).toFixed(2);
}

function parseTab(raw: string | null): SearchTab {
  if (raw === "images" || raw === "videos") return raw;
  return "all";
}

/**
 * Should the top hit get a knowledge panel? Either the query names the project
 * outright, or its score clearly dominates the runner-up.
 */
function isStrongMatch(
  results: SearchResult[],
  manifest: SiteManifest | undefined,
  query: string,
): boolean {
  if (!manifest || !results.length) return false;
  const q = query.trim().toLowerCase();
  if (!q) return false;

  const name = manifest.displayName.toLowerCase();
  if (q === manifest.project.toLowerCase()) return true;
  if (q === name || name.includes(q) || q.includes(name)) return true;
  if (manifest.keywords.some((keyword) => keyword.toLowerCase() === q)) return true;

  const top = results[0].score;
  const runnerUp = results[1]?.score ?? 0;
  return top > 0 && top >= runnerUp * 1.5;
}

export default function SearchPageClient({ docs }: SearchPageClientProps) {
  const searchParams = useSearchParams();
  const query = (searchParams?.get("q") ?? "").trim();
  const tab = parseTab(searchParams?.get("tab") ?? null);

  const engine = useMemo(() => createEngine(docs), [docs]);
  const results = useMemo(() => (query ? engine.search(query) : []), [engine, query]);
  const correction = useMemo(
    () => (query ? engine.didYouMean(query) : null),
    [engine, query],
  );

  // Media tabs work without a query too: imageResults/videoResults return the
  // full gallery for an empty query (the homepage links straight to ?tab=images).
  const images = useMemo(
    () => (tab === "images" ? imageResults(manifests, query) : []),
    [tab, query],
  );
  const videos = useMemo(
    () => (tab === "videos" ? videoResults(manifests, query) : []),
    [tab, query],
  );

  const topDoc = results[0]?.doc;
  const topManifest = topDoc?.project ? getManifest(topDoc.project) : undefined;
  const showPanel = tab === "all" && isStrongMatch(results, topManifest, query);

  const count = tab === "images" ? images.length : tab === "videos" ? videos.length : results.length;
  const seconds = searchSeconds(`${query}|${tab}`);

  return (
    <div className="serp">
      <header className="serp-header">
        <div className="serp-header-top">
          <div className="serp-brand">
            <Link className="wordmark-link" href="/" aria-label="David's Internet home">
              <Wordmark className="serp-logo" />
            </Link>
          </div>
          <div className="serp-search">
            <SearchBox variant="serp" docs={docs} initialQuery={query} />
          </div>
          <div className="serp-header-right">
            <button type="button" className="icon-button" aria-label="David apps">
              <AppsGridIcon size={24} />
            </button>
            <Link className="avatar" href="/about" aria-label="About David">
              D
            </Link>
          </div>
        </div>
        <Tabs query={query} active={tab} />
      </header>

      <main className="serp-body">
        {!query && tab === "all" ? (
          <div className="serp-columns">
            <div className="serp-main">
              <div className="empty-state">
                <p className="empty-headline">Search David&apos;s Internet.</p>
                <p>
                  Type a project, a technology, or a thing you half-remember seeing. Everything
                  indexed here was built by David.
                </p>
                <p className="empty-links">
                  Not sure where to start? <Link href="/about">Read about this place</Link>.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="serp-columns">
            <div className={tab === "images" ? "serp-main serp-main--wide" : "serp-main"}>
              <div className="result-stats">
                About {count.toLocaleString("en-US")} result{count === 1 ? "" : "s"} ({seconds}{" "}
                seconds)
              </div>

              {tab === "all" && correction ? (
                <div className="did-you-mean">
                  Did you mean: <Link href={tabHref(correction, "all")}>{correction}</Link>
                </div>
              ) : null}

              {tab === "all" ? (
                results.length ? (
                  <div className="results">
                    {results.map((result) => (
                      <ResultItem key={result.doc.id} doc={result.doc} query={query} />
                    ))}
                  </div>
                ) : (
                  <EmptyState query={query} noun="documents" />
                )
              ) : null}

              {tab === "images" ? <ImagesGrid images={images} query={query} /> : null}
              {tab === "videos" ? <VideoList videos={videos} query={query} /> : null}
            </div>

            {showPanel && topManifest ? (
              <div className="serp-rail">
                <KnowledgePanelCard manifest={topManifest} />
              </div>
            ) : null}
          </div>
        )}
      </main>

      <Footer variant="serp" />
    </div>
  );
}
