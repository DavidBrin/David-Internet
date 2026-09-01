# HardHack 2026 — Break-in Detector — demo page

Live at [/demos/hardhack](/demos/hardhack). This page is a demo built inside David's Internet: the archive it was made from lives in `demos/hardhack2026_intrusion_system_raw/` (the team's hackathon firmware, wiring docs, and iOS app), scrubbed source copies for the drawer in `demos/hardhack_src/`, and the simulation in `src/demos/hardhack/`.

## What is on the page

One connected simulation (`src/demos/hardhack/sim/core.ts`) drives four sections:

**The house.** A schematic SVG cutaway of the hackathon build — front door on a servo bolt, HC-SR04 beside the frame with its detection cone, VCNL4040, buzzer, LEDs, boards on the back wall, WS2812 strip along the roofline (iteration 3). Drag the door or the intruder; the sensor samples every 500 ms (the firmware's `SENSOR_READ_INTERVAL_MS`) into a live serial console. A wiring overlay draws every wire from the team's hand-written pin maps.

**The state machine.** The Uno firmware ported line for line: 2-sample moving average, 12 cm threshold (11 cm in iteration 3), 3-consecutive-readings confirmation, the armed-state gate that logs but suppresses the alarm when the phone disarms the system. Threshold, confirmation count, and sensor interval are live sliders. The firmware's LOCKDOWN and ERROR states exist in the enum but are never entered — the sim is faithful to that too.

**The wire.** Every event is a real packet from `comm_protocol.h` — S status / A alert up, K ack / C config down — riding the UART at a visible 9600 baud (about 1 ms per character), republished over MQTT, landing on an HTML/CSS replica of the team's SwiftUI app ("WATT'S UP?", ONLINE pill, ARMED toggle, live transmission log, Reset Network Link). Failure toggles: drop the WiFi (packets queue at the gateway, the phone goes OFFLINE) and inject UART noise (a malformed packet draws an E error).

**Three iterations.** ① Uno + ESP32-S3 gateway (with the 1 kΩ/2 kΩ voltage divider), ② Uno + Arduino R4 WiFi (5 V logic, no divider; the R4 firmware's comments record the retreat from campus WPA2-Enterprise to a personal hotspot), ③ everything consolidated on the ESP32-S3. Switching rewires the house and swaps the pin tables.

## What was completed or fixed

- The simulation is a TypeScript port written with AI coding tools (2026-08-31), table-tested against scripted intrusion sequences (`tests/hardhack-sim.test.ts`): confirmation counting, recovery, the armed gate, out-of-range handling, packet formats, WiFi-drop queueing, and the per-iteration thresholds.
- No photos of the physical house exist; the cutaway is an authored schematic drawn from David's description (layout simplified by request — "the design of the house isn't important"). The wiring is transcribed from `WIRING_DIAGRAM.md` / `CONSOLIDATED_WIRING.md` / `LED_STRIP_INTEGRATION.md`.
- Honest detail kept from the docs: the LED strip's red→green→blue cycle is deliberately decoupled from the security logic ("purely aesthetic, runs regardless of system state").

## Building

```
pnpm test    # includes the state-machine port tests
```

No build-time assets — everything on the page is computed client-side.

## Attribution / scrubbing

Team of four at HardHack 2026 (UC San Diego, January 2026): Brent, Alex, Aarnav, David. Firmware and app are the team's hackathon code. Displayed sources are scrubbed copies: the MQTT topic's teammate name is replaced with `<team>`, and no credentials or usernames ship (the raw README's `UCSD_USERNAME` line is not excerpted).
