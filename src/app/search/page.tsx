import { Suspense } from "react";
import { loadAllSearchDocs } from "@/lib/content.server";
import SearchPageClient from "@/components/SearchPageClient";
import Wordmark from "@/components/Wordmark";

/**
 * The route is fully static; the query itself lives in ?q= and is read on the
 * client, which is why the client half sits behind a Suspense boundary.
 */
export default function SearchPage() {
  const docs = loadAllSearchDocs();

  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchPageClient docs={docs} />
    </Suspense>
  );
}

/** Header-only shell so the prerendered HTML is not a blank page. */
function SearchSkeleton() {
  return (
    <div className="serp">
      <header className="serp-header">
        <div className="serp-header-top">
          <div className="serp-brand">
            <Wordmark className="serp-logo" />
          </div>
        </div>
      </header>
      <main className="serp-body" />
    </div>
  );
}
