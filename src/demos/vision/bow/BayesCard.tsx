"use client";

import { useMemo, useState } from "react";
import type { BowResults } from "./types";

export default function BayesCard({ bayes }: { bayes: BowResults["bayes"] }) {
  const defaultPrior = bayes.totalSpam / (bayes.totalSpam + bayes.totalNotSpam);
  const [prior, setPrior] = useState(defaultPrior);

  const rows = useMemo(() => {
    return bayes.bins.map((bin, i) => {
      const pSpam = bayes.spamCounts[i] / bayes.totalSpam;
      const pNotSpam = bayes.notSpamCounts[i] / bayes.totalNotSpam;
      const num = prior * pSpam;
      const den = num + (1 - prior) * pNotSpam;
      const posterior = den > 0 ? num / den : 0;
      return { bin, pSpam, pNotSpam, posterior, map: posterior > 0.5 ? "Spam" : "Not spam" };
    });
  }, [bayes, prior]);

  const maxLik = Math.max(...rows.map((r) => Math.max(r.pSpam, r.pNotSpam)), 0.001);

  return (
    <div className="vsBwBayes">
      <div className="vsRow">
        <span className="vsChip">mirrors the HW3 Bayes exercise</span>
      </div>
      <div className="vsBwBayesLik">
        {rows.map((r) => (
          <div key={r.bin} className="vsBwBayesLikCol">
            <div className="vsBwBayesLikBars">
              <div
                className="vsBwBayesLikBar vsBwBayesLikBarSpam"
                style={{ height: `${(r.pSpam / maxLik) * 100}%` }}
                title={`P(bin | spam) = ${r.pSpam.toFixed(3)}`}
              />
              <div
                className="vsBwBayesLikBar vsBwBayesLikBarNot"
                style={{ height: `${(r.pNotSpam / maxLik) * 100}%` }}
                title={`P(bin | not spam) = ${r.pNotSpam.toFixed(3)}`}
              />
            </div>
            <span className="vsBwBayesBinLabel">{r.bin}</span>
          </div>
        ))}
      </div>
      <div className="vsBwBayesLegend">
        <span className="vsBwBayesSwatch vsBwBayesSwatchSpam" /> P(word count | spam)
        <span className="vsBwBayesSwatch vsBwBayesSwatchNot" /> P(word count | not spam)
      </div>

      <label className="vsSliderLabel vsBwBayesSlider">
        prior p(spam) =
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.01}
          value={prior}
          onChange={(e) => setPrior(Number(e.target.value))}
        />
        <span className="vsMono">{prior.toFixed(2)}</span>
      </label>

      <div className="vsBwBayesPost">
        {rows.map((r) => (
          <div key={r.bin} className="vsBwBayesPostCol">
            <div className="vsBwBayesPostTrack">
              <div
                className={`vsBwBayesPostFill${r.map === "Spam" ? " vsBwBayesPostFillSpam" : ""}`}
                style={{ height: `${r.posterior * 100}%` }}
              />
            </div>
            <span className="vsMono vsBwBayesPostVal">{r.posterior.toFixed(2)}</span>
            <span className={`vsBwBayesMap${r.map === "Spam" ? " vsBwBayesMapSpam" : ""}`}>{r.map}</span>
            <span className="vsBwBayesBinLabel">{r.bin}</span>
          </div>
        ))}
      </div>
      <p className="vsBwCaption">
        Posterior P(spam | word count bin) via Bayes&apos; rule, recomputed live as the prior moves; the MAP
        label flips per bin at posterior = 0.5.
      </p>
    </div>
  );
}
