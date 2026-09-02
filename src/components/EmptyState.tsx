import Link from "next/link";
import { WIKIPEDIA_BASE_URL } from "@/lib/wiki";

interface EmptyStateProps {
  query: string;
  /** What was not matched: "documents", "image results", "video results". */
  noun?: string;
}

/** Google's zero-results block, verbatim in structure. */
export default function EmptyState({ query, noun = "documents" }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-headline">
        Your search - <span className="empty-query">{query}</span> - did not match any {noun}.
      </p>
      <p>Suggestions:</p>
      <ul className="empty-suggestions">
        <li>Make sure all words are spelled correctly.</li>
        <li>Try different keywords.</li>
        <li>Try more general keywords.</li>
        <li>Try fewer keywords.</li>
      </ul>
      <p className="empty-links">
        Browse <Link href="/about">About David</Link> or{" "}
        <a href={WIKIPEDIA_BASE_URL} target="_blank" rel="noopener noreferrer">
          Wikipedia
        </a>
        .
      </p>
    </div>
  );
}
