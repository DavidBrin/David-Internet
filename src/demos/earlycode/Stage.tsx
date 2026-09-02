"use client";

/**
 * Early Code demo stage — a timeline: each panel is one era, and the visual
 * style modernizes down the page (terminal-dark for 2021 C++, plain-editor
 * grey for CSE 12, browser-chrome for the servers, clean whiteboard for
 * Aho-Corasick).
 *
 * Panel contracts (each panel is self-contained: fetches its data from
 * /demos/earlycode/, owns its CSS file with its class prefix):
 *   cpp/CppPanel         — #cpp section     · prefix eC
 *   cse12/Cse12Panel     — #cse12 section   · prefix eJ
 *   servers/ServersPanel — #servers section · prefix eS
 *   aho/AhoPanel         — #aho section     · prefix eA
 * Shared classes (earlycode.css): elSection elPanel elH2 elIntro elChip elBtn
 * elNote elRow elMono elEra. NEVER scroll the page from an animation.
 * Accent #64748B (slate).
 */
import "./earlycode.css";
import CppPanel from "./cpp/CppPanel";
import Cse12Panel from "./cse12/Cse12Panel";
import ServersPanel from "./servers/ServersPanel";
import AhoPanel from "./aho/AhoPanel";

export default function Stage() {
  return (
    <div className="elStage">
      <section id="cpp" className="elSection">
        <CppPanel />
      </section>
      <section id="cse12" className="elSection">
        <Cse12Panel />
      </section>
      <section id="servers" className="elSection">
        <ServersPanel />
      </section>
      <section id="aho" className="elSection">
        <AhoPanel />
      </section>
    </div>
  );
}
