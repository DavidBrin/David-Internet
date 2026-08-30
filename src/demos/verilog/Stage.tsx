"use client";

import { useEffect, useState } from "react";
import ViterbiPanel, { type Phase } from "./viterbi/ViterbiPanel";
import WavePanel from "./viterbi/WavePanel";
import ResultsTable from "./viterbi/ResultsTable";
import RtlPane from "./viterbi/RtlPane";
import ModuleShelf from "./shelf/ModuleShelf";
import type { SimJson } from "./viterbi/simTypes";
import "./verilog.css";

export default function VerilogStage() {
  const [sim, setSim] = useState<SimJson | null>(null);
  const [phase, setPhase] = useState<Phase>("encoder");
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/demos/verilog/viterbi.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: SimJson | null) => {
        if (!cancelled) setSim(j);
      })
      .catch(() => {
        if (!cancelled) setSim(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <section className="demoPanel" id="viterbi">
        <div className="demoPanelHead">
          <h2>Viterbi decoder</h2>
          <p>encoder → noisy channel → trellis → traceback, and the SystemVerilog it animates</p>
        </div>
        <div className="vitSplit">
          <ViterbiPanel sim={sim} onPhase={setPhase} onCycle={setCycle} />
          <RtlPane phase={phase} />
        </div>
      </section>

      <section className="demoPanel" id="waves">
        <div className="demoPanelHead">
          <h2>Logic analyzer</h2>
          <p>waveforms from the build-time Icarus Verilog run of the same RTL</p>
        </div>
        <WavePanel sim={sim} followCycle={cycle} />
        <ResultsTable sim={sim} />
      </section>

      <section className="demoPanel" id="shelf">
        <ModuleShelf />
      </section>
    </>
  );
}
