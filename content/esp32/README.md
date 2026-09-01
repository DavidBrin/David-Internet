# ESP32 Thermal TinyML — demo page

Live at [/demos/esp32](/demos/esp32). This page is a demo built inside David's Internet: the raw material lives in `demos/tinyml_esp32_raw/` and `demos/esp32_iot_fastapi_raw/` (the ECE 140 labs and tech assignments), the build script in `scripts/demos/esp32.ts` + `esp32_prep.py`, and the page code in `src/demos/esp32/`.

## What is on the page

The full pipeline, each stage running live on real (anonymized) frames:

**Thermal camera.** ~500 frames from the class dataset replayed at the AMG8833's ~10 fps, in contiguous per-contributor sequences with label transitions — scrub, pause, switch nearest↔bicubic interpolation and colormap, and watch the max-pixel readout against the 26–28 °C boundary the dataset analysis found.

**Three transports.** The same frame drawn as bytes on a serial line (with the tutorial's `delay()` gaps), as MQTT publishes plus the request/response handshake from the challenge, and as WebSocket traffic feeding a mini replica of the labeling UI (`p`/`e` to label). Drop the link and watch the reconnect behavior.

**76 features.** The tech-assignment pipeline ported to TypeScript (`core/features.ts`): per-frame ambient normalization, intensity stats, and eight spatial features — with the BFS largest-blob flood fill animated cell by cell over the live frame, and the pytest cases replayed as pass ticks.

**Train → quantize → deploy → infer.** Per-fold GroupKFold curves from re-running the real training config at build time; the deployed model (weights and quant params parsed out of `model.tflite`) run float32 and INT8 side by side with scales and zero-points visible (`core/net.ts` re-implements the TFLite integer kernels); the 6,672-byte C array streaming into a chip graphic; live present/empty verdicts on the camera stream.

**WiFi net-map.** The TA4 side quest as a force-directed SSID graph — synthetic scans (real SSIDs/BSSIDs would identify neighbors), real pipeline shape.

## What was completed or fixed

- The TS ports were written with AI coding tools (2026-08-31) and tested against fixtures generated from the real pipeline (`tests/fixtures/esp32-{features,net}.json`): David's `features.py` output on real frames, Keras float probabilities, and the TFLite interpreter's int8 activations layer by layer.
- Correction to the spec: it described 65 features (the lab tutorial's pipeline); the deployed tech-assignment pipeline is **76** features, and 76 is what ships.

## Building

```
pnpm sync-demos esp32   # needs py -3.12 with numpy/pandas/sklearn/tensorflow/PIL
pnpm test               # includes the features + int8-kernel fixture tests
```

The prep re-runs the 5-fold training once (a few minutes); outputs are committed so builds elsewhere need no Python.

## Attribution / privacy

Course scaffolding (`ECE140_WIFI`/`ECE140_MQTT` helpers, starter TODOs) by ECE 140 staff (UC San Diego, winter 2026); completions, tests, and the deployed model are David's. Contributor `student_id`s are salted-hash prefixes (the salt is generated per build and never persisted); only ~500 of 17,610 frames ship; 8×8 thermal frames identify no one. WiFi scans are synthetic.
