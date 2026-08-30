# 07 — ESP32: From Heat to a 6.7 KB Brain (ECE 140, winter 2026)

Slug: `esp32` · Fake domain: `esp32.davids.net` · Archetype: **A** (interactive pipeline) + Story rail
Status: spec agreed 2026-08-29; **not built**.

## Summary

One throughline across the ECE 140 assignments: an AMG8833 8×8 thermal camera on an
ESP32-S3, its frames pushed over three different transports (serial → MQTT → WebSocket),
collected and labeled, turned into 65 features (64 pixels + a BFS largest-blob), trained
into a small dense net, quantized to INT8 (**6,672 bytes**), flashed as a C array, and run
on-device. The page runs every stage in the browser on real (anonymized) frames, ending
with the actual trained model classifying `present / empty` live. A side panel shows the
TA4 WiFi net-map on synthetic scans.

## Source material

`demos/tinyml_esp32_raw/` and `demos/esp32_iot_fastapi_raw/`:

| File / group | Stage | Notes |
|---|---|---|
| `esp32_iot_fastapi_raw/ta3_mqtt_thermal_camera/tutorial1_serial_delay/{esp32/src/main.cpp, python/thermal_viewer.py}` | Serial frames + viewer (interpolation) | Panel 1–2 |
| `ta3…/challenge1_mqtt_thermal/` (`ECE140_MQTT.cpp`, `main.cpp`, `thermal_viewer.py`, `thermal_data.csv`) and `challenge2_mqtt_request/` (`thermal_controller.py`: request/response over MQTT) | MQTT publish; request→reply handshake | Panel 2. `ECE140_WIFI/MQTT` helper classes are **course-provided** |
| `ta5_*` WebSocket collection client + browser labeling UI; dataset explorer `ANALYSIS.md` (+ histogram, mislabeled-sample figures) | WebSocket transport; labeling; dataset stats (22,054 frames, 50.6/49.4 balance; max-temp threshold ≈ 26–28 °C) | Panel 2–3; ANALYSIS text quoted in the Story rail |
| `tinyml_esp32_raw/lab_tutorial/scripts/{clean,features,train,export}.py`, `main.py` | Clean → 65 features (`_largest_connected_component` BFS, `_compute_blob_feature`) → Dense 32/16/1 (L2 0.005, GroupKFold k=5 by student, 50 epochs) → TFLite INT8 + C headers | Panel 3–4 |
| `tinyml_esp32_raw/tech_assignment_challenge_1/` (`features.py`, `tests/test_features.py`) and `…_challenge_2/` (`export.py`, `test_export.py`, `esp32/src/main.cpp`, `model_data.h`, `model.tflite`) | David's completed assignments incl. pytest suites; the ESP32 inference loop (`setupModel`, `runInference` quantize/dequantize) | Panel 4; the shipped weights come from **`tech_assignment_challenge_2/model.tflite`** (David-trained), not the course's `pretrained_model.keras` |
| `tech_assignment_challenge_2/thermal_dataset.csv` (17,610 rows, 64 px + label + `student_id`) | Frame source | **PII:** `student_id` = real UCSD PIDs → salted-hash at build; ship ~500-frame subset |
| `ta4_fastapi_wifi_netmap/` (`wifiscrape_webserver.py`: `/get_netscan`, `/netmap_graph`; `visualize.py`; ESP32 scanner) | WiFi net-map | Panel 5, synthetic SSIDs |
| `lab5_fastapi_survey/`, `week4` REST LED | Not shown (one line in the Story) | Filler |

## Stage — a pipeline you scroll through, each stage live

### 1. Thermal camera
- 8×8 grid replaying real frames from the anonymized subset at the sensor's ~10 fps;
  play/pause/scrub; **interpolation toggle** (nearest ↔ bicubic, as `thermal_viewer.py`
  does) and a colormap picker. Label badge (`present`/`empty`) from the dataset.
- Sequences chosen so a person walks in and out; the max-pixel readout shows the ~26–28 °C
  boundary from `ANALYSIS.md`.

### 2. Transport switcher — Serial → MQTT → WebSocket
- The same frame stream drawn as packets moving from the ESP32 chip to the laptop through
  the chosen pipe:
  - **Serial:** a byte stream ticking at 115200 baud (frame = 64 floats as CSV line),
    `delay()` visible as gaps;
  - **MQTT:** ESP32 → broker → subscriber, topic labels; the challenge-2 **request /
    response** handshake animates (`request` topic → ESP32 grabs a frame → `response`);
  - **WebSocket:** persistent connection, frames + label messages flowing both ways from
    the browser labeling UI (a mini replica: keyboard `p`/`e` labels the frame).
- Readouts: bytes/frame, frames/s, latency; a "drop the link" button shows reconnect
  behavior from `ECE140_MQTT.cpp`.

### 3. Features — the BFS blob
- Threshold slider over the frame; the **BFS flood** animates cell by cell from the
  hottest seed, painting the largest connected component; blob size becomes feature 65.
  The 65-vector fills on the right, then the StandardScaler (`model_params.h` mean/scale)
  normalizes it (bars re-scale).
- "Run the tests" button replays `test_features.py` cases as pass ticks.

### 4. Train → quantize → deploy → infer
- **Train:** loss/accuracy curves per GroupKFold fold (pre-computed at build from the
  real pipeline, shown as an animated replay); a fold selector highlights which hashed
  student groups were held out (this is why GroupKFold, in one sentence).
- **Quantize:** the live net (65→32→16→1, weights extracted from `model.tflite` at build)
  runs on the current frame in **float32 and INT8 side by side**: activations as two
  columns of bars, the scale/zero-point per tensor, and the final probabilities (usually
  identical, occasionally not — that's the point). Size counter: Keras ≈ 30 KB → TFLite
  INT8 = 6,672 B.
- **Deploy:** `model_data.h` bytes stream into a chip graphic (progress like a flash
  upload), then the ESP32 inference loop (`runInference`: quantize → invoke →
  dequantize) runs on panel 1's stream with the verdict and confidence overlaid on the
  thermal grid. Latency readout uses the real on-device number if it was logged
  (else omitted).

### 5. WiFi net-map (TA4)
- ESP32 scans → `POST /get_netscan` → FastAPI → `/netmap_graph`: a force-directed graph
  of SSIDs/channels/RSSI. **Synthetic** scan data (real SSIDs/BSSIDs identify neighbors);
  "rescan" animates new nodes joining, RSSI as edge length.

## Story rail

1. ECE 140 in one line; the thermal camera as the recurring sensor.
2. Serial first, then MQTT (why pub/sub), then request/response, then WebSockets for a
   labeling UI — what each transport bought.
3. Collecting a class-wide dataset; the `ANALYSIS.md` findings (balance, the temperature
   threshold, mislabeled samples).
4. Feature engineering: why a BFS blob beats a max-temperature threshold.
5. TinyML: GroupKFold by student, L2, then INT8 and why 6.7 KB matters on an ESP32.
6. Tests as part of the assignment (`test_features.py`, `test_export.py`).
7. Side quest: the WiFi net-map.

## Source drawer

- Tabs: `features.py`, `train.py`, `export.py`, `esp32/src/main.cpp` (inference),
  `ECE140_MQTT.cpp` (marked course-provided), `thermal_controller.py`,
  `wifiscrape_webserver.py`, the TS ports (`esp32/net.ts`, `esp32/bfs.ts`).
- Single footer line: course scaffolding (WiFi/MQTT helpers, starter TODOs) by ECE 140
  staff; completions, tests, and models by David.

## Assets (`scripts/sync-demos.ts` → `public/demos/esp32/`)

| Asset | Build | Size |
|---|---|---|
| `frames.json` | ~500 frames from `thermal_dataset.csv`: 64 × int8 (°C×4), label, `sid` = salted SHA-256 prefix; sequences kept contiguous by `created_at` | ~40 KB gz |
| `model.json` | Weights/biases + quant params parsed from `model.tflite` (flatbuffer) at build; scaler from `model_params.h` | ~10 KB |
| `training.json` | Per-fold curves from re-running `train.py` once at build (or from logs) | < 20 KB |
| `netmap.json` | Synthetic scan set | < 5 KB |
| `figures/*.webp` | ANALYSIS histogram + mislabeled-sample figures | < 200 KB |

## Tech

- TS: dense-net forward pass (float + simulated INT8 with per-tensor affine quant
  matching TFLite's scheme), BFS, StandardScaler, bicubic upsample; canvas for the grid
  and packet lanes; SVG force graph (d3-force or a 60-line custom sim).
- Tests: TS forward pass equals TFLite interpreter output on 50 frames (fixture from
  Python at build); BFS blob equals `features.py` on the same frames.

## Manifest (`content/esp32/site.ts`)

- displayName "ESP32 Thermal TinyML", favicon "🌡️", accent `#F97316`.
- deepLinks: `/demos/esp32#camera`, `#transport`, `#features`, `#tinyml`, `#netmap`.
- techStack: ESP32-S3, AMG8833, PlatformIO, MQTT, WebSockets, FastAPI, TensorFlow/Keras,
  TFLite Micro, scikit-learn, pytest, uv.
- knowledgePanel facts: Sensor · Transports (3) · Dataset (22k frames, class-wide) ·
  Model (65→32→16→1, INT8, 6,672 B) · Tests.
- keywords: esp32, tinyml, tflite, thermal camera, amg8833, mqtt, websocket, fastapi,
  quantization.

## Attribution / privacy

- `student_id` hashed with a build-time salt (not committed); only ~500 frames ship; 8×8
  thermal frames are not identifiable.
- WiFi scans are synthetic; no real SSID/BSSID ships.
- Course helpers labeled once in the drawer footer.

## Out of scope

- Running TFLite Micro in the browser (the TS forward pass stands in), live hardware,
  the survey app.

## Open questions

None — scope and PII handling decided 2026-08-29.
