/**
 * FROZEN CONTRACT — shared types for David's Internet.
 * All teams build against these shapes. Changes go through the orchestrator only.
 */

/** A route on a replica worth surfacing as its own search result. */
export interface DeepLink {
  path: string;
  title: string;
  snippet: string;
  keywords: string[];
}

/** An entry for the Images tab: thumbnail linking out to the live page it depicts. */
export interface MediaImage {
  /** Path under /public, e.g. "/content/youtube/screenshots/replica-home-1920.png" */
  src: string;
  caption: string;
  /** Route on the replica this image depicts, e.g. "/watch" */
  targetPath: string;
}

/** An entry for the Videos tab. */
export interface MediaVideo {
  /** Path under /public or an absolute URL (R2/Supabase for large files). */
  src: string;
  poster?: string;
  caption: string;
  targetPath: string;
  /** Display duration like "0:24" */
  duration?: string;
}

export interface KnowledgePanel {
  /** e.g. "Web application", "Browser game" */
  type: string;
  /** Ordered label → value facts. */
  facts: Record<string, string>;
}

/** One vendored project ("site" on David's Internet). Lives at content/<project>/site.ts */
export interface SiteManifest {
  /** Slug, matches the content/<project> directory. */
  project: string;
  displayName: string;
  /** Fake breadcrumb domain, e.g. "youtube.davids.net" */
  fakeDomain: string;
  /**
   * Live deployment base URL (no trailing slash), e.g. "https://youtube-david.vercel.app".
   * null = not deployed yet → all links fall back to the internal docs page.
   */
  liveUrl: string | null;
  tagline: string;
  description: string;
  /** CSS color used for favicon monogram / accents. */
  accentColor: string;
  /** Single emoji used as the site's favicon in results. */
  favicon: string;
  techStack: string[];
  needsDatabase: boolean;
  deepLinks: DeepLink[];
  images: MediaImage[];
  videos: MediaVideo[];
  /** Queries that should strongly match this site. */
  keywords: string[];
  knowledgePanel?: KnowledgePanel;
  /** Which vendored markdown docs exist under content/<project>/. */
  docs: { readme: boolean; spec: boolean; decisions: boolean };
  /**
   * "replica" (default): a vendored external project. "demo": an interactive page that
   * lives inside this repo at /demos/<project>; liveUrl is then that internal route.
   */
  kind?: "replica" | "demo";
}

/** true when a manifest's liveUrl leaves David's Internet (http/https) rather than an internal route. */
export function isExternalUrl(url: string | null | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

export type SearchDocKind = "home" | "deeplink" | "docs" | "decisions" | "about";

/** One indexed document = one search result. This is the seam between search lib and UI. */
export interface SearchDoc {
  id: string;
  /** Project slug, or null for site-level pages like /about. */
  project: string | null;
  kind: SearchDocKind;
  title: string;
  snippet: string;
  /** Full text used for indexing + snippet extraction (not rendered directly). */
  body: string;
  /** Fake breadcrumb, e.g. "youtube.davids.net › watch" */
  displayUrl: string;
  /** Real href: live deployment URL, or internal fallback like /sites/youtube/docs */
  href: string;
  keywords: string[];
  /** Emoji favicon for the result row. */
  favicon: string;
  accentColor: string;
  /** true if href leaves David's Internet (live deployment). */
  external: boolean;
}

/** A ranked result returned by the search engine. */
export interface SearchResult {
  doc: SearchDoc;
  score: number;
}

export interface ImageResult {
  project: string;
  siteName: string;
  fakeDomain: string;
  image: MediaImage;
  /** Resolved real link target for the click-through. */
  href: string;
}

export interface VideoResult {
  project: string;
  siteName: string;
  fakeDomain: string;
  video: MediaVideo;
  href: string;
}

/** Resolve a replica path to its real href: live deployment, or internal docs fallback. */
export function resolveHref(manifest: SiteManifest, path: string): string {
  if (manifest.liveUrl) {
    if (path === "/" || path === "") return manifest.liveUrl;
    return manifest.liveUrl.replace(/\/$/, "") + path;
  }
  return `/sites/${manifest.project}/docs`;
}

/** Build the Google-style breadcrumb display URL: "domain › seg1 › seg2". */
export function displayUrlFor(fakeDomain: string, path: string): string {
  const segs = path.split("/").filter(Boolean).map((s) => s.replace(/\[|\]/g, ""));
  return [fakeDomain, ...segs].join(" › ");
}
