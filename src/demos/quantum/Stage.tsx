"use client";

import BlochPanel from "./bloch/BlochPanel";
import CircuitPanel from "./circuit/CircuitPanel";
import SimonPanel from "./simon/SimonPanel";
import GroverPanel from "./grover/GroverPanel";
import "./quantum.css";

export default function QuantumStage() {
  return (
    <>
      <section className="demoPanel" id="bloch">
        <div className="demoPanelHead">
          <h2>Bloch sphere</h2>
          <p>one qubit as geometry — every gate is a rotation you can watch</p>
        </div>
        <BlochPanel />
      </section>

      <section className="demoPanel" id="circuit">
        <div className="demoPanelHead">
          <h2>Circuit builder</h2>
          <p>drag gates onto the wires; a playhead sweeps and the amplitudes morph</p>
        </div>
        <CircuitPanel />
      </section>

      <section className="demoPanel" id="simon">
        <div className="demoPanelHead">
          <h2>Simon&apos;s algorithm</h2>
          <p>an oracle with a secret: pairing, interference, and a GF(2) solver closing in — plus Deutsch–Jozsa and Bernstein–Vazirani</p>
        </div>
        <SimonPanel />
      </section>

      <section className="demoPanel" id="grover">
        <div className="demoPanelHead">
          <h2>Grover iterator</h2>
          <p>the group project: flip the marked amplitude, reflect about the mean, repeat ⌊π/4·√(N/M)⌋ times — and no more</p>
        </div>
        <GroverPanel />
      </section>
    </>
  );
}
