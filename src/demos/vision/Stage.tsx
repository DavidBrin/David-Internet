"use client";

/**
 * Computer Vision demo stage — four panels in course order.
 *
 * Panel contracts (each panel is self-contained: fetches its own data from
 * /demos/vision/, owns its CSS file with its class prefix):
 *   stereo/StereoPanel    — #stereo   prefix vsSt   (face/, heightmap, worker solve)
 *   epipolar/EpipolarPanel — #epipolar prefix vsEp  (epipolar/data.json + images)
 *   bow/BowPanel          — #bow      prefix vsBw   (bow/, vocab sprite, results)
 *   cnn/CnnPanel          — #cnn      prefix vsCn   (cnn/curves.json)
 * Shared classes (vision.css): vsSection vsPanel vsIntro vsChip vsBtn vsNote
 * vsFigStrip (via <FigStrip/>). NEVER scroll the page from an animation.
 */
import "./vision.css";
import StereoPanel from "./stereo/StereoPanel";
import EpipolarPanel from "./epipolar/EpipolarPanel";
import BowPanel from "./bow/BowPanel";
import CnnPanel from "./cnn/CnnPanel";

export default function Stage() {
  return (
    <div className="vsStage">
      <section id="stereo" className="vsSection">
        <h2 className="vsH2">
          <span className="vsNum">1</span> Photometric stereo &amp; relighting
        </h2>
        <p className="vsIntro">
          Four photos of the same face, each lit from a known direction. Solve ~24,000 per-pixel
          least-squares systems for the surface normals and albedo, integrate the gradients into
          depth, then drag the light anywhere — the face re-renders from the recovered surface.
        </p>
        <StereoPanel />
      </section>

      <section id="epipolar" className="vsSection">
        <h2 className="vsH2">
          <span className="vsNum">2</span> Epipolar geometry, corners &amp; matching
        </h2>
        <p className="vsIntro">
          The 8-point algorithm turns 13 hand-clicked correspondences into the fundamental matrix —
          click anywhere on one dino view and its epipolar line lands on the other. Below: the
          corner detector with live sliders, and SSD racing NCC along the line.
        </p>
        <EpipolarPanel />
      </section>

      <section id="bow" className="vsSection">
        <h2 className="vsH2">
          <span className="vsNum">3</span> Bag-of-words faces
        </h2>
        <p className="vsIntro">
          Interest points → 11×11 patches → a 100-word k-means vocabulary → histograms → k-NN. The
          vocabulary below is real, rebuilt at build time from the course's face set; the accuracy
          table is the archived run.
        </p>
        <BowPanel />
      </section>

      <section id="cnn" className="vsSection">
        <h2 className="vsH2">
          <span className="vsNum">4</span> CNN &amp; transfer curves
        </h2>
        <p className="vsIntro">
          The learning half, precomputed: a small CNN on FashionMNIST by optimizer and dropout, the
          learning-rate study, and STL-10 transfer learning with a frozen conv stack — all numbers
          from the archived winter-2025 run.
        </p>
        <CnnPanel />
      </section>
    </div>
  );
}
