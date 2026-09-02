"use client";

/**
 * #servers - "A URL is just a string." Prefix eS.
 *
 * Three zones: a request/response replay against TS ports of David's
 * ChatServer and DocSearchServer Handlers (logic.ts), the doc-search corpus
 * browsing that comes out of the same replay, and the ListExamples JUnit lab
 * (merge()'s planted bug, red-then-green). See src/demos/earlycode/meta.ts
 * story beats 3-4 for the framing this panel is illustrating.
 */
import { useEffect, useState } from "react";
import "../earlycode.css";
import "./servers.css";
import type { CorpusData, CorpusDoc } from "./logic";
import ReplayZone from "./ReplayZone";
import JUnitLab from "./JUnitLab";

export default function ServersPanel() {
  const [docs, setDocs] = useState<CorpusDoc[]>([]);
  const [corpusNote, setCorpusNote] = useState<string | null>(null);
  const [corpusError, setCorpusError] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/demos/earlycode/corpus.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`corpus.json: ${r.status}`))))
      .then((json: CorpusData) => {
        if (cancelled) return;
        setDocs(json.docs);
        setCorpusNote(json.note);
      })
      .catch((e: Error) => {
        if (!cancelled) setCorpusError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="elPanel">
      <span className="elEra">~2023, CSE 15L</span>
      <h2 className="elH2">A URL is just a string</h2>
      <p className="elIntro">
        CSE 15L handed out a tiny course-provided HTTP server ("wavelet") and the assignment was the Handler: parse
        the path, split the query on <span className="elMono">[=&amp;]</span>, build the response. The mini browser
        below replays requests against faithful TypeScript ports of David&apos;s chat and doc-search handlers -
        quirks included.
      </p>

      {corpusError && <p className="elNote">Couldn&apos;t load the search corpus: {corpusError}</p>}

      <ReplayZone docs={docs} corpusNote={corpusNote} reducedMotion={reducedMotion} />
      <JUnitLab reducedMotion={reducedMotion} />
    </div>
  );
}
