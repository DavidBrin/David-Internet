"use client";

/**
 * P300 Speller demo stage.
 *
 * Panel contracts (each panel is self-contained: fetches its own data from
 * /demos/p300/, owns its CSS file with its class prefix):
 *   speller/SpellerPanel       — #speller section    · prefix pS
 *   classifier/ClassifierPanel — #classifier section · prefix pC
 *   results/ResultsPanel       — #results section    · prefix pR
 * Shared classes (p300.css): ppSection ppPanel ppH2 ppIntro ppChip ppBtn
 * ppNote ppRow ppMono. NEVER scroll the page from an animation.
 * Accent #A855F7; target highlights use #7e22ce on #faf5ff.
 */
import "./p300.css";
import SpellerPanel from "./speller/SpellerPanel";
import ClassifierPanel from "./classifier/ClassifierPanel";
import ResultsPanel from "./results/ResultsPanel";

export default function Stage() {
  return (
    <div className="ppStage">
      <section id="speller" className="ppSection">
        <SpellerPanel />
      </section>
      <section id="classifier" className="ppSection">
        <ClassifierPanel />
      </section>
      <section id="results" className="ppSection">
        <ResultsPanel />
      </section>
    </div>
  );
}
