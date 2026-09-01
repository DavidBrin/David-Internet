"use client";

import DissectPanel from "./dissect/DissectPanel";
import SandboxPanel from "./sandbox/SandboxPanel";
import PopulationPanel from "./population/PopulationPanel";
import { SpikesProvider } from "./store";
import "./spikes.css";

export default function SpikesStage() {
  return (
    <SpikesProvider>
      <section className="demoPanel" id="dissect">
        <div className="demoPanelHead">
          <h2>The spike, dissected</h2>
          <p>
            a real marmoset patch-clamp sweep (DANDI:001776) — scrub it, watch each spike get detected,
            windowed, and fitted in the exact order spikeparam computes it
          </p>
        </div>
        <DissectPanel />
      </section>

      <section className="demoPanel" id="sandbox">
        <div className="demoPanelHead">
          <h2>Parameter → shape sandbox</h2>
          <p>
            the fit inverted: drag the fitted parameters and regenerate a waveform over a ghosted real
            spike — ramp + exponential model, or two skewed Gaussians, plus a sim_patch spike train
          </p>
        </div>
        <SandboxPanel />
      </section>

      <section className="demoPanel" id="population">
        <div className="demoPanelHead">
          <h2>Population</h2>
          <p>
            ~2,700 fitted spikes from ten subjects: pick two features, brush the scatter, and the
            selected spikes&rsquo; real waveforms overlay beside the notebooks&rsquo; group boxplots
          </p>
        </div>
        <PopulationPanel />
      </section>
    </SpikesProvider>
  );
}
