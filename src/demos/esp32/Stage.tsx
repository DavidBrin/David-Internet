"use client";

import CameraPanel from "./camera/CameraPanel";
import TransportPanel from "./transport/TransportPanel";
import FeaturesPanel from "./features/FeaturesPanel";
import TinymlPanel from "./tinyml/TinymlPanel";
import NetmapPanel from "./netmap/NetmapPanel";
import { FrameProvider } from "./core/frameStore";
import "./esp32.css";

export default function Esp32Stage() {
  return (
    <FrameProvider>
      <section className="demoPanel" id="camera">
        <div className="demoPanelHead">
          <h2>The thermal camera</h2>
          <p>real frames from the class dataset at the AMG8833&apos;s ~10 fps — scrub, interpolate, and watch a person walk in and out</p>
        </div>
        <CameraPanel />
      </section>

      <section className="demoPanel" id="transport">
        <div className="demoPanelHead">
          <h2>Three transports</h2>
          <p>the same 64 numbers ride serial CSV, MQTT publish and request/response, then a WebSocket with a labeling UI on the far end</p>
        </div>
        <TransportPanel />
      </section>

      <section className="demoPanel" id="features">
        <div className="demoPanelHead">
          <h2>76 features — the BFS blob</h2>
          <p>ambient normalization, intensity stats, and a breadth-first flood that finds the largest warm region, animated cell by cell</p>
        </div>
        <FeaturesPanel />
      </section>

      <section className="demoPanel" id="tinyml">
        <div className="demoPanelHead">
          <h2>Train → quantize → deploy → infer</h2>
          <p>GroupKFold curves, float32 vs INT8 side by side, 6,672 bytes streaming into a chip, and the live verdict on the camera panel&apos;s stream</p>
        </div>
        <TinymlPanel />
      </section>

      <section className="demoPanel" id="netmap">
        <div className="demoPanelHead">
          <h2>Side quest: WiFi net-map</h2>
          <p>ESP32 scan → FastAPI → a force-directed graph of (synthetic) SSIDs by channel and RSSI</p>
        </div>
        <NetmapPanel />
      </section>
    </FrameProvider>
  );
}
