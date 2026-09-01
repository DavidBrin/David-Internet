"use client";

/**
 * arXiv Semantic Graph demo stage.
 *
 * Panel contracts (each panel is self-contained: fetches its own data from
 * /demos/arxiv/, owns its CSS file with its class prefix):
 *   graph/GraphPanel   — renders BOTH the #graph and #recommend sections
 *                        (shared selection state) · prefix axG
 *   apriori/AprioriCard — #apriori card · prefix axA
 *   gn/GnCard           — #girvan-newman card · prefix axN
 *   spectral/SpectralCard — #spectral card · prefix axS
 * Shared classes (arxiv.css): axSection axPanel axIntro axChip axBtn axNote
 * axRow axMono. NEVER scroll the page from an animation.
 */
import "./arxiv.css";
import GraphPanel from "./graph/GraphPanel";
import AprioriCard from "./apriori/AprioriCard";
import GnCard from "./gn/GnCard";
import SpectralCard from "./spectral/SpectralCard";

export default function Stage() {
  return (
    <div className="axStage">
      {/* GraphPanel renders <section id="graph"> and <section id="recommend"> itself */}
      <GraphPanel />

      <div className="axCardsHead">
        <h2 className="axH2">The from-scratch algorithms</h2>
        <p className="axIntro">
          The course built this machinery by hand before using libraries. Three of David's weekly
          exercises, live: frequent pairs on real shopping baskets, communities by edge
          betweenness, and the same split read off the Laplacian's spectrum.
        </p>
      </div>

      <section id="apriori" className="axSection">
        <AprioriCard />
      </section>
      <section id="girvan-newman" className="axSection">
        <GnCard />
      </section>
      <section id="spectral" className="axSection">
        <SpectralCard />
      </section>
    </div>
  );
}
