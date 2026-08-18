/**
 * Renders vendored project markdown for the "cached copy" pages.
 * Content team owns this file.
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// Vendored markdown is David's own trusted content, so raw HTML (e.g. <img> grids
// inside README tables) is rendered rather than escaped.
import rehypeRaw from "rehype-raw";

/**
 * Vendored READMEs point at `docs/screenshots/x.png` relative to their own repo.
 * The sync script copies those PNGs to /content/<project>/screenshots/, so rewrite
 * the srcs to the vendored location; anything else is left alone (and may 404,
 * which is acceptable for a cached copy).
 */
export function rewriteRelativeAssets(markdown: string, project: string): string {
  const dest = `/content/${project}/screenshots/`;
  return markdown
    .replace(/(!\[[^\]]*\]\()(?:\.?\/)?docs\/screenshots\//g, `$1${dest}`)
    .replace(/(<img[^>]*\ssrc=")(?:\.?\/)?docs\/screenshots\//g, `$1${dest}`);
}

export default function CachedMarkdown({
  markdown,
  project,
}: {
  markdown: string;
  project: string;
}) {
  const source = rewriteRelativeAssets(markdown, project);
  return (
    <div className="cachedBody">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          table: ({ ...props }) => (
            <div className="cachedTableWrap">
              <table {...props} />
            </div>
          ),
          img: ({ ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...props} alt={typeof props.alt === "string" ? props.alt : ""} />
          ),
          a: ({ ...props }) => <a {...props} rel="noopener noreferrer" />,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
