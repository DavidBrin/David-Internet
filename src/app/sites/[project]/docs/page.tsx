/**
 * Cached docs route. Every registered project now has an encyclopedia article
 * on the Wikipedia replica, so these pages forward there (vercel.json issues
 * the real HTTP redirect in production; tests/wiki-redirects.test.ts guards
 * that the two stay in sync). The cached README rendering below is only a
 * fallback for a project that somehow has no wiki slug yet.
 */
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { manifests, getManifest } from "@/lib/manifests";
import { loadProjectMarkdown } from "@/lib/content.server";
import { hasWikiArticle, wikiUrlFor, wikiTitleFor } from "@/lib/wiki";
import type { SiteManifest } from "@/lib/types";
import CachedMarkdown from "../../CachedMarkdown";
import RedirectToWiki from "./RedirectToWiki";
import "../../sites.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return manifests.map((m) => ({ project: m.project }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ project: string }>;
}): Promise<Metadata> {
  const { project } = await params;
  const manifest = getManifest(project);
  if (!manifest) return { title: "Not found - David's Internet" };
  if (hasWikiArticle(project)) {
    return {
      title: `${manifest.displayName} - moved to Wikipedia`,
      description: manifest.tagline,
      robots: { index: false },
    };
  }
  return {
    title: `${manifest.displayName} - Documentation`,
    description: manifest.tagline,
  };
}

function WikiForward({ manifest }: { manifest: SiteManifest }) {
  const wikiUrl = wikiUrlFor(manifest.project);
  const articleTitle = wikiTitleFor(manifest.project) ?? manifest.displayName;
  return (
    <main
      className="cachedPage"
      style={{ "--cached-accent": manifest.accentColor } as CSSProperties}
    >
      <RedirectToWiki url={wikiUrl} />
      <header className="cachedHeader">
        <p className="cachedCrumb">
          {manifest.favicon} {manifest.fakeDomain} › docs
        </p>
        <h1 className="cachedTitle">This page has moved</h1>
        <p className="cachedTagline">
          {manifest.displayName}&apos;s documentation now lives as an encyclopedia
          article. Taking you to <a href={wikiUrl}>{articleTitle}</a> on
          David&apos;s Wikipedia.
        </p>
      </header>
    </main>
  );
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  const manifest = getManifest(project);
  if (!manifest) notFound();

  if (hasWikiArticle(project)) return <WikiForward manifest={manifest} />;

  const readme = loadProjectMarkdown(project, "README.md");
  const spec = loadProjectMarkdown(project, "SPEC.md");
  const hasDecisions = loadProjectMarkdown(project, "DECISIONS.md") !== null;

  return (
    <main
      className="cachedPage"
      style={{ "--cached-accent": manifest.accentColor } as CSSProperties}
    >
      <div className="cachedBanner">
        <div className="cachedBannerInner">
          <span className="cachedBannerDot" aria-hidden="true" />
          <p>
            This is David&apos;s Internet&apos;s cached copy of{" "}
            <strong>{manifest.fakeDomain}</strong>
            {manifest.liveUrl ? (
              <>
                . The live page is at{" "}
                <a href={manifest.liveUrl}>
                  {manifest.liveUrl.replace(/^https?:\/\//, "")}
                </a>
                .
              </>
            ) : (
              <>. The live deployment isn&apos;t up yet.</>
            )}{" "}
            What you&apos;re reading is the project&apos;s own documentation, vendored
            straight from the source repository.
          </p>
        </div>
        <div className="cachedBannerLinks">
          <Link href="/">David&apos;s Internet</Link>
          {hasDecisions ? (
            <Link href={`/sites/${manifest.project}/decisions`}>Design decisions</Link>
          ) : null}
        </div>
      </div>

      <header className="cachedHeader">
        <p className="cachedCrumb">
          {manifest.favicon} {manifest.fakeDomain} › docs
        </p>
        <h1 className="cachedTitle">{manifest.displayName} - Documentation</h1>
        <p className="cachedTagline">{manifest.tagline}</p>
      </header>

      {readme ? (
        <CachedMarkdown markdown={readme} project={manifest.project} />
      ) : (
        <p className="cachedEmpty">
          No README was vendored for this project. Run{" "}
          <code>pnpm sync-content</code> to pull it in.
        </p>
      )}

      {spec ? (
        <>
          <div className="cachedSectionRule">
            <hr />
            <p className="cachedSectionLabel">Specification</p>
          </div>
          <CachedMarkdown markdown={spec} project={manifest.project} />
        </>
      ) : null}

      <footer className="cachedFooter">
        <p>
          Cached from the {manifest.displayName} source repository.{" "}
          <Link href="/">Back to search</Link>
        </p>
      </footer>
    </main>
  );
}
