import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "esp32",
  kind: "demo",
  displayName: "ESP32 Thermal TinyML",
  fakeDomain: "esp32.davids.net",
  liveUrl: "/demos/esp32",
  tagline: "From 64 pixels of heat to a 6,672-byte INT8 brain — every stage of the pipeline live in the browser.",
  description:
    "Interactive demo of the ECE 140 (UC San Diego) hardware track: an AMG8833 8×8 thermal camera on an ESP32-S3, its frames pushed over three transports (serial → MQTT → WebSocket), pooled into a 22,054-frame class dataset, turned into 76 features (including a BFS largest-blob you can watch flood-fill), trained into a small dense network with GroupKFold by student, quantized to INT8 — 6,672 bytes — and run with faithful TFLite integer kernels next to the float32 model, classifying present/empty on real anonymized frames. Plus the WiFi net-map side quest on synthetic scans.",
  accentColor: "#F97316",
  favicon: "🌡️",
  techStack: [
    "ESP32-S3",
    "AMG8833",
    "PlatformIO",
    "MQTT",
    "WebSockets",
    "FastAPI",
    "TensorFlow/Keras",
    "TFLite Micro",
    "scikit-learn",
    "pytest",
    "TypeScript",
  ],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#camera",
      title: "The thermal camera",
      snippet:
        "Real 8×8 frames from the class dataset replayed at the sensor's ~10 fps — scrub the stream, toggle nearest vs bicubic interpolation, and watch the max-pixel readout cross the 26–28 °C boundary.",
      keywords: ["amg8833", "thermal camera", "heatmap", "interpolation"],
    },
    {
      path: "#transport",
      title: "Serial → MQTT → WebSocket",
      snippet:
        "The same frame stream rides three different pipes: CSV over serial with delay() gaps, MQTT publish plus a request/response handshake, and a WebSocket feeding a labeling UI.",
      keywords: ["mqtt", "websocket", "serial", "iot transport", "request response"],
    },
    {
      path: "#features",
      title: "76 features and a BFS blob",
      snippet:
        "Ambient normalization against each frame's own median, intensity stats, and a breadth-first flood fill that finds the largest warm region — animated cell by cell over the live frame.",
      keywords: ["feature engineering", "bfs", "connected components", "normalization"],
    },
    {
      path: "#tinyml",
      title: "Train → quantize → deploy",
      snippet:
        "GroupKFold training curves, float32 vs INT8 activations side by side with their scales and zero-points, 6,672 bytes flashing into a chip, and live inference on the camera stream.",
      keywords: ["tinyml", "tflite", "int8 quantization", "groupkfold", "edge ai"],
    },
    {
      path: "#netmap",
      title: "WiFi net-map",
      snippet:
        "The TA4 side quest: ESP32 WiFi scans POSTed to FastAPI and drawn as a force-directed graph of SSIDs by channel and RSSI — synthetic scans, real pipeline.",
      keywords: ["wifi scan", "fastapi", "force directed graph", "esp32"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "esp32",
    "tinyml",
    "tflite",
    "thermal camera",
    "amg8833",
    "mqtt",
    "websocket",
    "fastapi",
    "quantization",
    "int8",
    "machine learning",
    "edge ai",
    "ece 140",
    "groupkfold",
  ],
  knowledgePanel: {
    type: "Interactive demo",
    facts: {
      Sensor: "AMG8833 — 8×8 thermal array, ~10 fps, on an ESP32-S3",
      Transports: "3 — serial CSV, MQTT (publish + request/response), WebSocket",
      Dataset: "22,054 class-wide frames (50.6% empty / 49.4% present); ~500 anonymized frames ship",
      Model: "Dense 76→32→16→1, L2 0.005, GroupKFold by student → INT8 TFLite, 6,672 bytes",
      Verified: "TS ports tested against features.py and the TFLite interpreter (build-time fixtures)",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
