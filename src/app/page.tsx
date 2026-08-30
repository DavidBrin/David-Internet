import Link from "next/link";
import { loadAllSearchDocs } from "@/lib/content.server";
import SearchBox from "@/components/SearchBox";
import Wordmark from "@/components/Wordmark";
import Footer from "@/components/Footer";
import { AppsGridIcon } from "@/components/Icons";

export default function HomePage() {
  // Built at export time; shipped to the client for autocomplete + Feeling Lucky.
  const docs = loadAllSearchDocs();

  return (
    <div className="home">
      <nav className="topnav" aria-label="Account and apps">
        <Link className="topnav-link" href="/search?tab=images">
          Images
        </Link>
        <Link className="topnav-link" href="/demos">
          Demos
        </Link>
        <Link className="topnav-link" href="/about">
          About
        </Link>
        <button type="button" className="icon-button" aria-label="David apps">
          <AppsGridIcon size={24} />
        </button>
        <Link className="avatar" href="/about" aria-label="About David">
          D
        </Link>
      </nav>

      <main className="home-main">
        <h1 className="home-logo">
          <Wordmark title="David's Internet" />
        </h1>

        <div className="home-search">
          <SearchBox variant="home" docs={docs} autoFocus />
        </div>

        <p className="home-river-link">
          <Link href="/path">Follow the river →</Link>
        </p>
      </main>

      <Footer variant="home" />
    </div>
  );
}
