"use client";

/**
 * Early 3D Modeling demo stage.
 *
 * Panel contracts (each panel is self-contained: fetches its data from
 * /demos/modeling/, owns its CSS file with its class prefix):
 *   gallery/GalleryPanel — #inventor section · prefix mG
 *   vex/VexPanel         — #vex section      · prefix mV
 * Shared classes (modeling.css): mdSection mdPanel mdH2 mdIntro mdChip mdBtn
 * mdNote mdRow mdMono. NEVER scroll the page from an animation.
 * Accent #F59E0B on workshop grey.
 */
import "./modeling.css";
import GalleryPanel from "./gallery/GalleryPanel";
import VexPanel from "./vex/VexPanel";

export default function Stage() {
  return (
    <div className="mdStage">
      <section id="inventor" className="mdSection">
        <GalleryPanel />
      </section>
      <section id="vex" className="mdSection">
        <VexPanel />
      </section>
    </div>
  );
}
