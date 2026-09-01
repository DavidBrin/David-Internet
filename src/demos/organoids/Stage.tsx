"use client";

import RawPanel from "./raw/RawPanel";
import SpectrumPanel from "./spectrum/SpectrumPanel";
import DosePanel from "./dose/DosePanel";
import CompoundsPanel from "./compounds/CompoundsPanel";
import LibraryPanel from "./library/LibraryPanel";
import "./organoids.css";

/**
 * Five chronological chapters. The visual polish intentionally ramps:
 * ch. 1–2 carry the "lab notebook" aesthetic (ogNotebook), ch. 3 introduces
 * the dose palette, ch. 4–5 use the full design language (ogPolished).
 */
export default function OrganoidsStage() {
  return (
    <>
      <section className="demoPanel ogChapter ogNotebook" id="raw">
        <div className="demoPanelHead">
          <div className="ogChapterTag">Chapter 1 · Jul–Aug 2024</div>
          <h2>Raw voltage</h2>
          <p>
            one well&rsquo;s LFP streaming by while the MATLAB chain that produced it — Axion raw,
            bandpass, downsample, HDF5 — toggles stage by stage
          </p>
        </div>
        <RawPanel />
      </section>

      <section className="demoPanel ogChapter ogNotebook" id="spectrum">
        <div className="demoPanelHead">
          <div className="ogChapterTag">Chapter 2 · Sep 2024 · Plate A</div>
          <h2>What&rsquo;s in a spectrum</h2>
          <p>
            click a well: the power spectrum draws in log-log, the aperiodic 1/f fit slides
            underneath, and Gaussian peaks pop out one at a time — FOOOF, animated
          </p>
        </div>
        <SpectrumPanel />
      </section>

      <section className="demoPanel ogChapter" id="dose">
        <div className="demoPanelHead">
          <div className="ogChapterTag">Chapter 3 · Oct–Dec 2024 · Plate D</div>
          <h2>Dose and time</h2>
          <p>
            5-MeO-DMT 10/20 µM vs vehicle: the plate gains a dose overlay and a D-1→D20 day
            slider; heatmap mode is where the trends live
          </p>
        </div>
        <DosePanel />
      </section>

      <section className="demoPanel ogChapter ogPolished" id="compounds">
        <div className="demoPanelHead">
          <div className="ogChapterTag">Chapter 4 · Nov 2024 – Jan 2025 · Plate F</div>
          <h2>Four compounds, sixty days</h2>
          <p>
            psilocybin / LSD / psilocin / vehicle, stim vs no-stim — spike rasters, burst and
            network-event detection, and the dose-response boxplots
          </p>
        </div>
        <CompoundsPanel />
      </section>

      <section className="demoPanel ogChapter ogPolished" id="library">
        <div className="demoPanelHead">
          <div className="ogChapterTag">Chapter 5 · Jun 2025</div>
          <h2>The library</h2>
          <p>
            25 functions, one dependency map — watch a per-day notebook light up the calls from
            load_lfp to network_events
          </p>
        </div>
        <LibraryPanel />
      </section>
    </>
  );
}
