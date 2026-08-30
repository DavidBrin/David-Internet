# 05 — HardHack 2026: Break-in Simulator (Jan 2026, UCSD hackathon)

Slug: `hardhack` · Fake domain: `hardhack.davids.net` · Archetype: **A** (whole-system simulation) + Story rail
Status: spec agreed 2026-08-29; **not built**.

## Summary

The whole hackathon system running in the browser as one connected simulation: a 2-D
cutaway of **the house we built**, with every physical component placed where it really
was and the wiring drawn over it; open the door and watch the ultrasonic sensor trip the
Uno's state machine, the JSON packet ride the UART wire to the ESP32, go up to the MQTT
broker, and land on a replica of the SwiftUI app — then flip the app's ARM toggle and watch
the command come back down. An architecture switcher redraws the same house for each of
the three hardware iterations from the weekend.

Half of this project was hardware (the house itself); the house panel is the hero.

## Source material

From `demos/hardhack2026_intrusion_system_raw/`:

| File | Role in demo | Notes |
|---|---|---|
| `intrusion-system/intrusion_uno/intrusion_uno.ino` + `config.h` | State machine (`NORMAL / ALERT / LOCKDOWN / ERROR`), 12 cm threshold, 3-reading confirmation, 500 ms sensor interval, 5 s status heartbeat, servo lock, buzzer, LEDs | Ported to TS as the simulation core |
| `intrusion-system/comm_protocol.h` (3 variants) | Packet formats `S` status, `A` alert, `K` ack, `C` config, `E` error; JSON over UART @ 9600 | Packet animation uses the exact field names |
| `intrusion_esp32/intrusion_esp32.ino`, `intrusion_r4_wifi/intrusion_r4_wifi.ino` | Gateway logic (UART ↔ WiFi/MQTT), reconnect behavior | Iterations 1 and 2 |
| `intrusion_esp32_consolidated/intrusion_esp32_consolidated.ino` (606 lines) | Iteration 3: single-board build with VCNL4040 proximity, LED strip, MQTT publish/subscribe, heartbeat | Final build |
| `WIRING_DIAGRAM.md`, `CONSOLIDATED_WIRING.md`, `LED_STRIP_INTEGRATION.md` | Pin maps for the three iterations → wiring overlay | Hand-written ASCII diagrams → authored SVG |
| `hardhackapp/hardhack2026/ContentView.swift` (273 lines, CocoaMQTT) | App replica: header "HARDHACK 2026", ONLINE/OFFLINE pill, "WATT'S UP?", ARMED toggle, LIVE TRANSMISSION LOG, "Reset Network Link" panic button | Replicated in HTML/CSS with the same copy |
| `README.md` (deployment guide) | Story beats; expected serial output used as the sim console text | **Scrub:** `UCSD_USERNAME=dabrin` line; teammate name inside the MQTT topic string |

No photos/video of the physical house exist (confirmed 2026-08-29) → the house is an
**authored SVG drawn from David's description**; Images tab uses stills of the simulation.

## Stage

### 1. The house (hero) — 2-D cutaway with wiring
- An SVG cutaway of the hackathon house (front door, a window, one interior wall) drawn
  from David's description (layout still to be provided — see Open questions): **HC-SR04** beside the door frame with its detection
  cone, **servo lock** on the door, **buzzer**, **green/red LEDs**, the **LED strip**
  along the roofline (iteration 3), the **Uno** and **ESP32-S3** boards on the back wall,
  battery/USB.
- **Wiring overlay** toggle: every wire from the pin maps drawn as a colored path from
  component pin to board pin, labeled (e.g. `TRIG → D9`, `ECHO → D10`, `SIG → D6`). Hover a
  component → its wires glow and the pin table from `WIRING_DIAGRAM.md` shows.
- **Interaction:** drag the door open (0–90°) or drag an intruder figure toward the door.
  The sensor cone measures distance to the nearest obstacle every 500 ms (the real
  `SENSOR_INTERVAL_MS`); readings stream into a mini serial console (`[SENSOR] Distance:
  45.3 cm`) that mirrors the README's expected output.
- **Animation:** door swing, sensor ping (expanding arc), servo horn rotating to lock,
  buzzer ripple + red LED strobe on ALERT, LED strip color chase (iteration 3).

### 2. State machine + sensor logic
- Beside the house: the four states as nodes; the active one glows; the confirmation
  counter (0/3) fills as consecutive readings fall under `THRESHOLD_CM = 12`; transitions
  animate along the edges exactly when `setSecurityState()` would fire; ERROR state shown
  when readings fall outside `MIN/MAX_DISTANCE`.
- Sliders: threshold (cm), confirmation count, sensor interval — the sim uses them live,
  so you can feel why 3 readings @ 500 ms was chosen (false-positive vs latency).
- "Armed" gate: when disarmed (from the phone), detections log but don't alarm — as in
  the firmware's armed-state check.

### 3. The wire — packets, gateway, broker, phone
- A schematic strip under the house: **Uno ⇄ ESP32 ⇄ WiFi/MQTT broker ⇄ phone**.
- Every event emits a real packet (`{"type":"A","ts":12345,"dist":25.5,"st":1}`) that
  **travels** along the UART line (9600 baud → a visible ~0.1 s trip), gets a `K` ack
  back, then is re-published as MQTT (`…/status`) up to the broker cloud and down to the
  phone; the 5 s `S` heartbeat pulses continuously.
- **Phone replica** (HTML/CSS, phone frame): same copy and layout as `ContentView.swift`
  — "HARDHACK 2026", ONLINE pill, "WATT'S UP?", SYSTEM ARMED / SYSTEM SECURE card with
  the red toggle, LIVE TRANSMISSION LOG filling in real time, "Reset Network Link".
  Flipping the toggle emits a `C` config packet that travels *down* the chain to the Uno
  and re-arms/disarms the house; "Reset Network Link" plays the WiFi/MQTT reconnect
  sequence from `connectToWiFi()` / `connectToMQTT()` (ONLINE pill flickers, reconnect
  counter increments).
- Failure toggles: "drop WiFi" (packets queue at the ESP32, heartbeat stops, phone shows
  OFFLINE), "UART noise" (a malformed packet → `E` error → `UART_MESSAGE_TIMEOUT_MS`).

### 4. Architecture switcher — three iterations
- Tabs: **① Uno + ESP32-S3 (UART gateway)** · **② Uno + Arduino R4 WiFi** · **③ ESP32-S3
  consolidated (+ VCNL4040, LED strip)**. Switching re-lays the boards and wires in the
  house (animated morph), swaps the pin table, and changes which firmware file the Source
  drawer opens. One line per tab on *why* the change happened.

## Story rail

1. HardHack 2026 in one line; the team (see Attribution) and the split of work.
2. Building the house — materials, the door mechanism, mounting the sensor (illustrated
   by the SVG; no photos exist).
3. Iteration ①: Uno for sensing, ESP32 for WiFi, and a JSON-over-UART protocol between
   them (why not one board first).
4. Iteration ②: swapping in the R4 WiFi; what broke.
5. Iteration ③: consolidating onto the ESP32-S3 with MQTT and the LED strip.
6. The iOS app: CocoaMQTT, arm/disarm, the transmission log.
7. What we'd do with another day.

## Source drawer

- Tabs: `intrusion_uno.ino`, `comm_protocol.h`, `intrusion_esp32_consolidated.ino`,
  `ContentView.swift`, the TS sim (`hardhack/sim.ts`).
- Firmware shown with credentials/usernames scrubbed (secrets were never copied).

## Assets

- `public/demos/hardhack/house.svg` (authored), `wiring/{iter1,iter2,iter3}.json` (pin
  maps transcribed from the markdown diagrams). No photos/video.

## Tech

- Sim core in TS: fixed-timestep loop (50 ms), sensor model (ray to nearest obstacle +
  ±0.5 cm noise), the Uno state machine as a direct port, packet queue with per-link
  latency, MQTT modeled as pub/sub in memory.
- Rendering: SVG house + CSS animations; packets as SVG circles on `<path>` with
  `offset-path`; phone replica is plain DOM.
- Tests: state-machine port vs. a table of scripted distance sequences (the 3-reading
  confirmation, hysteresis back to NORMAL, ERROR range).

## Manifest (`content/hardhack/site.ts`)

- displayName "HardHack 2026 — Break-in Detector", favicon "🚨", accent `#EF4444`.
- deepLinks: `/demos/hardhack#house`, `#state`, `#wire`, `#iterations`.
- techStack: Arduino Uno, ESP32-S3-Mini, Arduino R4 WiFi, HC-SR04, VCNL4040, SoftwareSerial
  UART, MQTT (PubSubClient), SwiftUI, CocoaMQTT.
- knowledgePanel facts: Event (HardHack 2026, UCSD) · Team of 4 · Sensors · Protocol
  (JSON over UART @ 9600 → MQTT) · Iterations (3 in one weekend).
- images: simulation stills (house, wiring overlay, phone replica).
- keywords: hardhack, hackathon, intrusion detection, arduino, esp32, mqtt, swiftui, ultrasonic.

## Attribution / scrubbing

- Team credited by **first names** (Brent, Alex, Aarnav, David) — full names not
  selected 2026-08-29; flip to full names if teammates are fine with it.
- Remove `UCSD_USERNAME=dabrin` from any README excerpt; replace the teammate name in the
  MQTT topic with `<team>` in displayed code.
- `xcuserdata/` (teammate's machine username) is not shipped.

## Out of scope

- Real MQTT connectivity, the "live video feed" mentioned in the README (not in the code),
  3-D house model.

## Resolved questions (2026-08-30)

1. **House layout:** David: "make a simple house diagram, keep it simple — the design of
   the house isn't important." → a schematic one-room cutaway: front door (left wall,
   reed switch + servo bolt), ultrasonic sensor facing the door, Uno + ESP32 on a table at
   the back wall, LED strip along the ceiling. No fidelity claims.
2. Judged iteration: unknown; the switcher shows all three without naming a "final".
3. No photos exist → drawn from description (2026-08-29).
