"use client";

/**
 * Cross-Teaching Segmentation demo stage.
 *
 * Panel contracts (each panel is self-contained: fetches its own data from
 * /demos/crossteach/, owns its CSS file with its class prefix):
 *   exchange/ExchangePanel — #exchange section · prefix ctX
 *   training/TrainingPanel — #training section · prefix ctT
 *   arch/ArchPanel         — #architectures section · prefix ctA
 *   ladder/LadderPanel     — #ladder section · prefix ctL
 * Shared classes (crossteach.css): ctSection ctPanel ctIntro ctChip ctBtn
 * ctNote ctRow ctMono ctH2. NEVER scroll the page from an animation.
 * Trimap colors (shared): pet #14B8A6, background #1e293b, boundary #f59e0b.
 */
import "./crossteach.css";
import ExchangePanel from "./exchange/ExchangePanel";
import TrainingPanel from "./training/TrainingPanel";
import ArchPanel from "./arch/ArchPanel";
import LadderPanel from "./ladder/LadderPanel";

export default function Stage() {
  return (
    <div className="ctStage">
      <section id="exchange" className="ctSection">
        <ExchangePanel />
      </section>
      <section id="training" className="ctSection">
        <TrainingPanel />
      </section>
      <section id="architectures" className="ctSection">
        <ArchPanel />
      </section>
      <section id="ladder" className="ctSection">
        <LadderPanel />
      </section>
    </div>
  );
}
