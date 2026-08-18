import Link from "next/link";

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
        Or browse everything on <Link href="/about">About David&apos;s Internet</Link>.
      </p>
    </div>
  );
}
