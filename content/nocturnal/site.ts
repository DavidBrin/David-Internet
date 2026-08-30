import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "nocturnal",
  kind: "demo",
  displayName: "Nocturnal Neuro",
  fakeDomain: "nocturnal.davids.net",
  liveUrl: "/demos/nocturnal",
  tagline: "From board to brainwave: a reworked OpenBCI Ganglion, its parts, and a real EEG recording you can filter.",
  description:
    "The EEG-wearable venture, told as hardware → signal → business. Explode a four-layer PCB (a KiCad rework of the open-hardware OpenBCI Ganglion) into its copper, mask and silkscreen layers, hover 140 footprints to see the BOM line behind each one and which parts were substituted for obsolete or overpriced originals, walk the four schematic sheets with hotspots that light up the matching parts on the board, then open a real 20-channel EEG recording and run the DSP notebook's pipeline on it live — lowpass and downsample, 60 Hz notch, common-average reference, and Welch coherence between any two electrodes. A short venture strip closes with the canvases from the Basement launch program.",
  accentColor: "#6366F1",
  favicon: "🌙",
  techStack: ["KiCad 8", "Gerber / Excellon", "DigiKey sourcing", "Cognionics EEG", "MNE", "neurodsp", "SciPy", "BrainVision / EDF", "TypeScript", "Canvas"],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#board",
      title: "PCB layer explorer — exploding stack",
      snippet:
        "Eight layers of a four-layer board rendered from the KiCad project, exploded apart on a tilted axis. Hover any footprint for its BOM line, substitution note and DigiKey order line.",
      keywords: ["pcb", "kicad", "layers", "gerber", "footprint", "bom", "ganglion", "exploded view"],
    },
    {
      path: "#schematic",
      title: "Schematic tour — four sheets with hotspots",
      snippet:
        "Analog front end, instrumentation amplifiers, input protection, references, sensors and the BLE module — each hotspot explains the block and pulses the parts on the board.",
      keywords: ["schematic", "mcp3912", "ad8237", "tvs", "input protection", "simblee", "afe"],
    },
    {
      path: "#eeg",
      title: "Brainwave lab — a real 20-channel recording",
      snippet:
        "Pick electrodes on a 10-20 head map, play the recording, toggle the notebook's pipeline (lowpass + downsample, 60 Hz notch, common-average reference) and watch the coherence spectrum between two channels.",
      keywords: ["eeg", "coherence", "welch", "notch", "downsample", "10-20", "brainwave", "cognionics", "alpha"],
    },
    {
      path: "#venture",
      title: "Venture strip — the launch-program canvases",
      snippet: "Business Model Canvas, Value Proposition Canvas and Empathy Map from the Basement launch program, Nov 2024.",
      keywords: ["business model canvas", "value proposition", "empathy map", "startup", "basement", "venture"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "eeg",
    "wearable",
    "sleep",
    "bipolar",
    "mental health",
    "nocturnal neuro",
    "openbci",
    "ganglion",
    "kicad",
    "pcb",
    "schematic",
    "bom",
    "digikey",
    "coherence",
    "brainwave",
    "cognionics",
    "neurodsp",
    "startup",
    "hardware",
    "biosignal",
  ],
  knowledgePanel: {
    type: "Interactive demo",
    facts: {
      Type: "EEG wearable venture (overnight EEG as objective data for mental-health diagnosis) — hardware, signal and business",
      Hardware: "4-layer rework of the OpenBCI Ganglion in KiCad — 140 footprints, 41 BOM lines, 4 substitutions",
      Data: "Own 20-channel EEG recording (Cognionics, 500 Hz) — shipped at 250 Hz, filtered live in the browser",
      Program: "The Basement (UC San Diego) launch program, Nov 2024",
      Provenance: "OpenBCI Ganglion is open-source hardware; the rework, sourcing, DSP and venture framing are David's",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
