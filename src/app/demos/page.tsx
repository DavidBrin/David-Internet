/**
 * /demos — plain index of every interactive demo page.
 * Linked from the homepage; a stopgap until the wiki page replaces it.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { demos } from "@/lib/demos";
import { getManifest } from "@/lib/manifests";
import "./demos.css";

export const metadata: Metadata = {
  title: "Demos — David's Internet",
  description: "Interactive demo pages built into David's Internet.",
};

export default function DemosIndexPage() {
  return (
    <main className="demoPage">
      <div className="demoBar">
        <div className="demoBarInner">
          <Link href="/" className="demoBarHome">
            David&apos;s Internet
          </Link>
          <span className="demoBarSep" aria-hidden="true">
            ›
          </span>
          <span className="demoBarDomain">demos</span>
        </div>
      </div>

      <header className="demoHeader" style={{ borderLeftColor: "#4285F4" }}>
        <h1 className="demoTitle">Demos</h1>
        <p className="demoTagline">
          Interactive pages built from David&apos;s projects — each one simulates, renders or replays the real thing.
        </p>
      </header>

      <ul className="demoIndexList">
        {demos.map((d) => {
          const m = getManifest(d.slug);
          if (!m) return null;
          return (
            <li key={d.slug} className="demoIndexRow" style={{ borderLeftColor: m.accentColor }}>
              <Link href={`/demos/${d.slug}`} className="demoIndexLink">
                <span className="demoIndexFavicon" aria-hidden="true">
                  {m.favicon}
                </span>
                <span className="demoIndexText">
                  <span className="demoIndexName">{m.displayName}</span>
                  <span className="demoIndexTagline">{m.tagline}</span>
                  <span className="demoIndexChips">
                    <b>What</b> {d.what} · <b>When</b> {d.when}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="demoIndexFoot">
        More on the way — every project in the archive gets one. <Link href="/">Back to search</Link>
      </p>
    </main>
  );
}
