/**
 * Cached copy of a project's DECISIONS.md.
 * Content team owns this file. Statically generated for every registered manifest,
 * including the ones with no decisions doc (they get a short placeholder page).
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
    title: `${manifest.displayName} — Design decisions`,
    description: manifest.tagline,
  };
}

export default async function DecisionsPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  const manifest = getManifest(project);
  if (!manifest) notFound();

  const decisions = loadProjectMarkdown(project, "DECISIONS.md");

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
            What you&apos;re reading is the project&apos;s own decision log, vendored
            straight from the source repository.
          </p>
        </div>
        <div className="cachedBannerLinks">
          <Link href="/">David&apos;s Internet</Link>
          <Link href={`/sites/${manifest.project}/docs`}>Documentation</Link>
        </div>
      </div>

      <header className="cachedHeader">
        <p className="cachedCrumb">
          {manifest.favicon} {manifest.fakeDomain} › decisions
        </p>
        <h1 className="cachedTitle">{manifest.displayName} — Design decisions</h1>
        <p className="cachedTagline">{manifest.tagline}</p>
      </header>

      {decisions ? (
        <CachedMarkdown markdown={decisions} project={manifest.project} />
      ) : (
        <div className="cachedEmpty">
          <p>
            No decisions doc for this project. {manifest.displayName} didn&apos;t keep a
            separate DECISIONS.md — the reasoning that would live here is folded into its
            README instead.
          </p>
          <p>
            <Link href={`/sites/${manifest.project}/docs`}>
              Read the {manifest.displayName} documentation →
            </Link>
          </p>
        </div>
      )}

      <footer className="cachedFooter">
        <p>
          Cached from the {manifest.displayName} source repository.{" "}
          <Link href="/">Back to search</Link>
        </p>
      </footer>
    </main>
  );
}
