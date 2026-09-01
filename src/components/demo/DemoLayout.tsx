/**
 * Chrome shared by every demo page: breadcrumb bar, header with what/why/when chips,
 * the Story rail, the per-demo stage (children), and the Source drawer.
 * Server component; only SourceDrawer and the stage itself are client code.
 */
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import type { SiteManifest } from "@/lib/types";
import type { DemoMeta } from "@/lib/demos";
import SourceDrawer, { type SourceTab } from "./SourceDrawer";

export default function DemoLayout({
  manifest,
  meta,
  sources,
  children,
}: {
  manifest: SiteManifest;
  meta: DemoMeta;
  sources: SourceTab[];
  children: ReactNode;
}) {
  return (
    <main
      className="demoPage"
      style={
        {
          "--demo-accent": manifest.accentColor,
          ...(meta.theme ? { "--demo-bg": meta.theme.bg } : null),
          ...(meta.theme?.panel ? { "--demo-panel": meta.theme.panel } : null),
        } as CSSProperties
      }
    >
      <div className="demoBar">
        <div className="demoBarInner">
          <Link href="/" className="demoBarHome">
            David&apos;s Internet
          </Link>
          <span className="demoBarSep" aria-hidden="true">
            ›
          </span>
          <span className="demoBarDomain">
            {manifest.favicon} {manifest.fakeDomain}
          </span>
          <nav className="demoBarLinks" aria-label="Page links">
            <a href="#story">Story</a>
            <a href="#stage">Demo</a>
            <a href="#source">Source</a>
            {manifest.docs.readme ? (
              <Link href={`/sites/${manifest.project}/docs`}>About this page</Link>
            ) : null}
          </nav>
        </div>
      </div>

      <header className="demoHeader">
        <h1 className="demoTitle">{manifest.displayName}</h1>
        <p className="demoTagline">{manifest.tagline}</p>
        <ul className="demoChips">
          <li>
            <b>What</b> {meta.what}
          </li>
          {meta.why ? (
            <li>
              <b>Why</b> {meta.why}
            </li>
          ) : null}
          <li>
            <b>When</b> {meta.when}
          </li>
        </ul>
      </header>

      <div className="demoBody">
        <aside className="demoStory" id="story" aria-label="Story">
          <h2 className="demoStoryHeading">Story</h2>
          <ol className="demoStoryList">
            {meta.story.map((beat, i) => (
              <li key={i} className="demoStoryBeat">
                {beat.anchor ? (
                  <a href={beat.anchor} className="demoStoryTitle">
                    {beat.title}
                  </a>
                ) : (
                  <span className="demoStoryTitle">{beat.title}</span>
                )}
                <p className="demoStoryBody">{beat.body}</p>
              </li>
            ))}
          </ol>
        </aside>

        <section className="demoStage" id="stage" aria-label="Demo">
          {children}
        </section>
      </div>

      <SourceDrawer tabs={sources} footer={meta.sourceFooter} />

      <footer className="demoFooter">
        <Link href="/">Back to search</Link>
      </footer>
    </main>
  );
}
