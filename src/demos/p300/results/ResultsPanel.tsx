"use client";

import { useEffect, useState } from "react";
import "./results.css";
import BarsChart from "./BarsChart";
import CurveChart from "./CurveChart";
import SentenceCompare from "./SentenceCompare";
import type { ResultsData } from "./types";

/** #results — model family results. Prefix pR.
 * Three zones: window-accuracy bars, the repetitions curve (hero), and the
 * spelled sentence vs. ground truth. Fetches its own data from
 * /demos/p300/results.json, per the panel contract in Stage.tsx. */
export default function ResultsPanel() {
  const [data, setData] = useState<ResultsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/demos/p300/results.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`results.json: ${r.status}`))))
      .then((json: ResultsData) => {
        if (!cancelled) setData(json);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="ppPanel">
      <h2 className="ppH2">What the numbers said</h2>
      <p className="ppIntro">
        Single 650&nbsp;ms windows are hard to call, but the speller never bets on one. It averages scores across
        repetitions before picking a row and a column. Below: every model&apos;s window accuracy, how character accuracy
        builds up as repetitions accumulate, and the actual 100-letter sentence the pipeline spelled.
      </p>

      {error && <p className="ppNote">Could not load results.json ({error}).</p>}
      {!data && !error && <p className="ppNote">Loading results…</p>}

      {data && (
        <>
          <p className="ppNote pR-dataNote">{data.note}</p>

          <div className="pR-zone">
            <h3 className="pR-h3">Window accuracy, by model</h3>
            <BarsChart binary={data.binary} mcnnMembers={data.mcnnMembers} />
          </div>

          <div className="pR-zone">
            <h3 className="pR-h3">Character accuracy vs. repetitions</h3>
            <CurveChart curve={data.spellerCurve} model={data.spellerModel} subject={data.subject} />
          </div>

          <div className="pR-zone">
            <h3 className="pR-h3">The sentence it spelled</h3>
            <SentenceCompare wordTrue={data.wordTrue} wordPred={data.wordPred} model={data.spellerModel} />
          </div>
        </>
      )}
    </div>
  );
}
