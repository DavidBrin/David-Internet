/**
 * "How this works" — the footer explainer for the David search engine,
 * the way Google's footer links to "How Search works". Reuses the About
 * page's styling for visual consistency.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { manifests } from "@/lib/manifests";
import "../about/about.css";

export const metadata: Metadata = {
  title: "How this works — David's Internet",
  description:
    "What the David search engine is, what it searches through, and why every result is something David built.",
};

export default function HowThisWorksPage() {
  return (
    <main className="aboutPage">
      <div className="aboutBar">
        <div className="aboutBarInner">
          <span>davids.net › how-search-works</span>
          <Link href="/">David&apos;s Internet</Link>
        </div>
      </div>

      <div className="aboutMain">
        <header className="aboutHeader">
          <p className="aboutCrumb">🔍 davids.net</p>
          <h1 className="aboutName">How this works</h1>
          <p className="aboutRole">A search engine for one person&apos;s internet</p>
        </header>

        <p className="aboutLede">
          David&apos;s Internet is a portfolio dressed up as a search engine. It looks
          like Google because, for this tiny parallel internet, it <em>is</em> Google:
          the front door to every &quot;website&quot; that exists here — and every one of
          them is a project David built from scratch.
        </p>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">What it searches through</h2>
          <p>
            The index covers {manifests.length} sites — full-scale working replicas of
            real products (an issue tracker, a video platform, a block editor, a
            fighting game, a prediction market, and more), each rebuilt from the ground
            up. For every site it indexes the homepage, the pages worth deep-linking
            into, and the project&apos;s own documentation and design-decision logs, so
            one query can surface several results from the same site — just like the
            real thing.
          </p>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">How results work</h2>
          <p>
            Results show a fake display URL (like <code>youtube.davids.net</code>) but
            link to the real destination: the live deployment when a site is up, or its
            &quot;cached copy&quot; — the project&apos;s vendored documentation — until
            then. The Images tab is built from real screenshots of each project;
            autocomplete, &quot;did you mean&quot;, and I&apos;m Feeling Lucky all run
            against the same index, entirely in your browser.
          </p>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">Why it exists</h2>
          <p>
            It&apos;s a portfolio you explore instead of scroll: type a technology, a
            product name, or a thing you half-remember, and see what David has built.
            For the person behind it, see <Link href="/about">About David</Link>.
          </p>
        </section>

        <footer className="aboutFooter">
          <p>
            David&apos;s Internet — making the web smaller since 2025.{" "}
            <Link href="/">Back to search</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
