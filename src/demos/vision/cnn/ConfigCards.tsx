"use client";

import type { FashionMnistRun } from "./types";

export default function ConfigCards({ runs }: { runs: FashionMnistRun[] }) {
  const best = Math.max(...runs.map((r) => r.testAcc));
  return (
    <div className="vsCnCards">
      {runs.map((r) => {
        const isBest = r.testAcc === best;
        return (
          <div key={`${r.config}-${r.dropout}`} className={`vsCnCard${isBest ? " vsCnCardBest" : ""}`}>
            {isBest && <span className="vsCnBadge">best</span>}
            <div className="vsCnCardTitle">
              {r.config}
              <span className="vsCnCardSub">{r.dropout ? "+ dropout" : "no dropout"}</span>
            </div>
            <div className="vsMono vsCnCardNum">{r.testAcc.toFixed(3)}</div>
            <div className="vsCnCardBarTrack">
              <div className="vsCnCardBarFill" style={{ width: `${r.testAcc * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
