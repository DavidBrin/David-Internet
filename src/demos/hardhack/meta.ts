import type { DemoMeta } from "@/lib/demos";

const R = "demos/hardhack_src";

const meta: DemoMeta = {
  slug: "hardhack",
  theme: { bg: "#fbf1ef", panel: "#f6e3df" }, // alarm-red tint — a security system's page
  what: "the whole hackathon system as one connected simulation: house, firmware, protocol, phone",
  why: "half the project was hardware — the only way to demo it now is to rebuild the physics",
  when: "HardHack 2026, UC San Diego, January 2026",
  story: [
    {
      title: "One weekend at HardHack",
      body:
        "HardHack 2026 is UCSD's hardware hackathon. Four of us — Brent, Alex, Aarnav, David — built a break-in detection system in a weekend: a model house with a sensored front door, an Arduino reading the sensors, a WiFi gateway pushing everything to MQTT, and an iOS app to arm and disarm it. The hardware went through three architectures before Sunday.",
    },
    {
      title: "The house",
      body:
        "The physical build was half the work: a door on a servo bolt, an HC-SR04 ultrasonic ranger beside the frame staring across the doorway, a VCNL4040 proximity sensor, buzzer, status LEDs, and boards on the back wall. No photos of it survived the weekend, so the cutaway here is a schematic redrawing — the layout is simplified, the wiring is real. Drag the door or the intruder and the sensor cone measures every 500 ms, exactly like the firmware's SENSOR_READ_INTERVAL_MS.",
      anchor: "#house",
    },
    {
      title: "Iteration ① — Uno + ESP32-S3 gateway",
      body:
        "The Uno owns the sensors and the whole state machine; an ESP32-S3-Mini exists only to give it WiFi. They talk JSON over UART at 9600 baud — S status, A alert, K ack, C config, E error, straight from comm_protocol.h — with a 1 kΩ/2 kΩ voltage divider dropping the Uno's 5 V TX to 3.33 V so it doesn't damage the ESP32's input. An alert crosses the wire in about 50 ms; you can watch it.",
      anchor: "#wire",
    },
    {
      title: "Iteration ② — swap in the R4 WiFi",
      body:
        "Same Uno, same protocol, but an Arduino R4 WiFi as the gateway: both boards speak 5 V logic, so the voltage divider goes away and one toolchain covers everything. The campus WPA2-Enterprise network is what fought back — the R4 firmware's comments show the retreat to a personal hotspot.",
      anchor: "#iterations",
    },
    {
      title: "Iteration ③ — one board to rule them all",
      body:
        "By Sunday everything lived on the ESP32-S3: sensors, servo, buzzer, LEDs, WiFi, MQTT — no UART link left to debug. The threshold got retuned from 12 cm to 11 cm, state changes publish straight to the broker, and a 30-pixel WS2812 strip went up along the roofline. Honest detail from the docs: the strip's red→green→blue cycle is deliberately decoupled from the security logic — 'purely aesthetic, runs regardless of system state.'",
      anchor: "#iterations",
    },
    {
      title: "WATT'S UP? — the iOS app",
      body:
        "The phone side is SwiftUI with CocoaMQTT: an ONLINE pill, a SYSTEM ARMED / SYSTEM SECURE card with the red toggle, a live transmission log, and a Reset Network Link panic button. Flipping ARMED publishes {\"type\":\"C\",\"cmd\":\"ON\"} down the chain — the firmware parses it with indexOf, and a disarmed system logs intrusions but keeps the alarm quiet. The replica here runs the same copy against the simulated broker.",
      anchor: "#wire",
    },
    {
      title: "Rebuilt for this page (2026-08-31)",
      body:
        "The simulation is a TypeScript port of the real firmware, written with AI coding tools: the Uno's moving average, the 3-consecutive-readings confirmation, the armed-state gate, and the exact packet strings, table-tested against scripted intrusion sequences. One faithful quirk: the firmware defines four states — NORMAL, ALERT, LOCKDOWN, ERROR — but nothing in the shipped code ever enters the last two. The sim doesn't either.",
      anchor: "#state",
    },
  ],
  sources: [
    { name: "sim core.ts", path: "src/demos/hardhack/sim/core.ts", lang: "ts", note: "The TypeScript simulation: firmware port, UART/WiFi links, packets, phone. Primary source of this page." },
    { name: "intrusion_uno.ino", path: `${R}/intrusion_uno.ino`, lang: "cpp", note: "The Arduino Uno firmware — sensors, state machine, alarm, UART to the gateway (iterations 1–2)." },
    { name: "config.h", path: `${R}/config.h`, lang: "cpp", note: "Pin map and tuning constants: 12 cm threshold, 3-reading confirmation, 500 ms sensor interval." },
    { name: "comm_protocol.h", path: `${R}/comm_protocol.h`, lang: "cpp", note: "The JSON-over-UART protocol both boards implement: S / A / K / C / E messages at 9600 baud." },
    { name: "consolidated.ino", path: `${R}/intrusion_esp32_consolidated.ino`, lang: "cpp", note: "Iteration 3: the whole system on one ESP32-S3 — MQTT publish/subscribe, VCNL4040, WS2812 strip. MQTT topic scrubbed to <team>." },
    { name: "ContentView.swift", path: `${R}/ContentView.swift`, lang: "swift", note: "The iOS app (SwiftUI + CocoaMQTT) the phone replica copies. MQTT topic scrubbed to <team>." },
  ],
  sourceFooter:
    "Team of four at HardHack 2026 (UCSD): Brent, Alex, Aarnav, David. Firmware and app are the team's hackathon code (credentials and usernames scrubbed); the browser simulation is a TypeScript port written with AI coding tools for this page, 2026-08-31.",
};

export default meta;
