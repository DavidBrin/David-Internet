import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "hardhack",
  kind: "demo",
  displayName: "HardHack 2026 — Break-in Detector",
  fakeDomain: "hardhack.davids.net",
  liveUrl: "/demos/hardhack",
  tagline: "The whole hackathon system running in the browser — open the door and watch the alert ride the wire to the phone.",
  description:
    "Interactive simulation of a break-in detection system built at HardHack 2026 (UC San Diego's hardware hackathon): a schematic cutaway of the model house with an HC-SR04 ultrasonic sensor watching the door, the Arduino Uno's state machine ported line for line (12 cm threshold, 3-reading confirmation, armed-state gate), JSON packets travelling the UART wire at a visible 9600 baud to an ESP32 gateway, up to an MQTT broker, and onto a replica of the team's SwiftUI app — flip its ARMED toggle and the command rides all the way back down. An architecture switcher replays the weekend's three hardware iterations.",
  accentColor: "#EF4444",
  favicon: "🚨",
  techStack: [
    "Arduino Uno",
    "ESP32-S3-Mini",
    "Arduino R4 WiFi",
    "HC-SR04",
    "VCNL4040",
    "SoftwareSerial UART",
    "MQTT (PubSubClient)",
    "SwiftUI",
    "CocoaMQTT",
    "TypeScript",
  ],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#house",
      title: "The house — sensors in place",
      snippet:
        "A cutaway of the hackathon house: drag the door open or walk an intruder toward it and the ultrasonic cone measures every 500 ms, streaming readings into a live serial console.",
      keywords: ["ultrasonic sensor", "hc-sr04", "intrusion detection", "wiring diagram"],
    },
    {
      path: "#state",
      title: "The state machine",
      snippet:
        "NORMAL to ALERT takes three consecutive readings under the threshold. Tune the threshold, confirmation count, and sensor interval live and feel the false-positive/latency tradeoff.",
      keywords: ["state machine", "arduino firmware", "debouncing", "threshold"],
    },
    {
      path: "#wire",
      title: "The wire — UART, MQTT, phone",
      snippet:
        "Every event is a real JSON packet riding UART at 9600 baud, republished over MQTT, landing on a replica of the SwiftUI app. Drop the WiFi and watch packets queue at the gateway.",
      keywords: ["uart", "json protocol", "mqtt", "swiftui", "packet animation"],
    },
    {
      path: "#iterations",
      title: "Three architectures in one weekend",
      snippet:
        "Uno + ESP32-S3 gateway with a voltage divider, then Uno + Arduino R4 WiFi, then everything consolidated onto the ESP32-S3 with a WS2812 strip — the house rewires itself as you switch.",
      keywords: ["esp32", "arduino r4", "hardware iteration", "hackathon"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "hardhack",
    "hackathon",
    "intrusion detection",
    "arduino",
    "esp32",
    "mqtt",
    "swiftui",
    "ultrasonic",
    "uart",
    "home security",
    "ucsd",
    "state machine",
    "iot",
  ],
  knowledgePanel: {
    type: "Interactive demo",
    facts: {
      Event: "HardHack 2026 — UC San Diego hardware hackathon, January 2026",
      Team: "4 — Brent, Alex, Aarnav, David",
      Sensors: "HC-SR04 ultrasonic + VCNL4040 proximity, fused with an OR",
      Protocol: "JSON over UART @ 9600 baud → MQTT (S/A/K/C/E message types)",
      Iterations: "3 architectures in one weekend, all simulated on this page",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
