"use client";

import HousePanel from "./house/HousePanel";
import StatePanel from "./state/StatePanel";
import WirePanel from "./wire/WirePanel";
import IterationsPanel from "./iterations/IterationsPanel";
import { SimProvider } from "./sim/store";
import "./hardhack.css";

export default function HardhackStage() {
  return (
    <SimProvider>
      <section className="demoPanel" id="house">
        <div className="demoPanelHead">
          <h2>The house</h2>
          <p>a schematic cutaway of the hackathon build — drag the door or walk the intruder in, and watch the ultrasonic cone catch them</p>
        </div>
        <HousePanel />
      </section>

      <section className="demoPanel" id="state">
        <div className="demoPanelHead">
          <h2>The state machine</h2>
          <p>the Uno firmware, ported line for line — 3 consecutive readings under the threshold arm the alarm; the phone&apos;s ARMED switch gates it</p>
        </div>
        <StatePanel />
      </section>

      <section className="demoPanel" id="wire">
        <div className="demoPanelHead">
          <h2>The wire</h2>
          <p>every packet rides the real protocol — JSON over UART at 9600 baud, an MQTT hop, and a replica of the SwiftUI app at the end</p>
        </div>
        <WirePanel />
      </section>

      <section className="demoPanel" id="iterations">
        <div className="demoPanelHead">
          <h2>Three iterations, one weekend</h2>
          <p>Uno + ESP32 gateway → Uno + R4 WiFi → everything consolidated on the ESP32-S3</p>
        </div>
        <IterationsPanel />
      </section>
    </SimProvider>
  );
}
