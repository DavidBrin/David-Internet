/**
 * Cached copy of a project's vendored documentation (README + SPEC).
 * Content team owns this file. Statically generated for every registered manifest.
 */
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { manifests, getManifest } from "@/lib/manifests";
import { loadProjectMarkdown } from "@/lib/content.server";
import CachedMarkdown from "../../CachedMarkdown";
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
  if (!manifest) return { title: "Not found — David's Internet" };
  return {
    title: `${manifest.displayName} — Documentation`,
    description: manifest.tagline,
  };
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  const manifest = getManifest(project);
  if (!manifest) notFound();

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
                {" "}
                — the live site is at{" "}
                <a href={manifest.liveUrl} target="_blank" rel="noopener noreferrer">
                  {manifest.liveUrl.replace(/^https?:\/\//, "")}
                </a>
                .
              </>
            ) : (
              <> — the live deployment isn&apos;t up yet.</>
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
        <h1 className="cachedTitle">{manifest.displayName} — Documentation</h1>
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
