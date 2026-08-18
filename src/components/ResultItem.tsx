import { Fragment } from "react";
import { buildSnippet } from "@/lib/snippets";
import { getManifest } from "@/lib/manifests";
import type { SearchDoc } from "@/lib/types";

interface ResultItemProps {
  doc: SearchDoc;
  query: string;
}

/** "youtube.davids.net › watch" → "youtube.davids.net". */
function domainOf(displayUrl: string): string {
  return displayUrl.split("›")[0].trim();
}

export default function ResultItem({ doc, query }: ResultItemProps) {
  const manifest = doc.project ? getManifest(doc.project) : undefined;
  const domain = domainOf(doc.displayUrl);
  const siteName = manifest?.displayName || domain || "David's Internet";

  const segments = doc.body ? buildSnippet(doc.body, query) : [];
  const hasSnippetText = segments.some((segment) => segment.text.trim().length > 0);

  return (
    <div className="result">
      <div className="result-head">
        <span className="result-favicon" aria-hidden="true">
          {doc.favicon || "🔎"}
        </span>
        <div className="result-site">
          <div className="result-sitename">{siteName}</div>
          <cite className="result-url">{doc.displayUrl || domain}</cite>
        </div>
      </div>

      <a
        className="result-title-link"
        href={doc.href}
        {...(doc.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        <h3 className="result-title">{doc.title}</h3>
      </a>

      <div className="result-snippet">
        {hasSnippetText
          ? segments.map((segment, index) =>
              segment.bold ? (
                <b key={index}>{segment.text}</b>
              ) : (
                <Fragment key={index}>{segment.text}</Fragment>
              ),
            )
          : doc.snippet}
      </div>
    </div>
  );
}
