import type { DemoMeta } from "@/lib/demos";

const meta: DemoMeta = {
  slug: "nocturnal",
  what: "a reworked OpenBCI Ganglion board, its schematic and BOM, and a real EEG recording with the DSP pipeline running live",
  why: "an overnight EEG wearable as objective data for mental-health diagnosis — hardware first, then signal, then the business case",
  when: "Nov 2024 – Feb 2025",
  story: [
    {
      title: "Start from open hardware",
      body:
        "The idea was an EEG headband you could sleep in, recording night after night at home so a clinician has objective data rather than a questionnaire. Rather than design an analog front end from scratch, the prototype started from OpenBCI's Ganglion — a four-channel biosensing board published as open hardware — and reworked it: re-captured in KiCad 8, re-laid-out, and re-sourced part by part.",
      anchor: "#board",
    },
    {
      title: "What “rework” meant",
      body:
        "The project's own files, not OpenBCI's: 140 footprints on a 61 mm four-layer octagon, a BOM of 41 lines, and a report of every symbol rescued from the old libraries. The layer stack on this page is rendered straight from that .kicad_pcb.",
      anchor: "#board",
    },
    {
      title: "Sourcing",
      body:
        "Four parts were obsolete or overpriced and were swapped with checked equivalents — a Kemet 1 µF for the Murata, a Samsung 47 µF, a 100 V X7R upgrade for the 0.1 µF decouplers, an onsemi supervisor variant. Two parts could not be sourced at all: the Simblee BLE module (discontinued) and the Seeed microSD socket. The DigiKey order for everything else came to $64.28.",
      anchor: "#board",
    },
    {
      title: "The signal chain",
      body:
        "Four AD8237 instrumentation amplifiers feed an MCP3912 four-channel 24-bit delta-sigma front end; TVS arrays protect the electrode inputs, DIP switches pick between the header pins and the input pads, and a DAC-driven reference sets the bias. The schematic tour walks each block and lights up the matching parts on the board.",
      anchor: "#schematic",
    },
    {
      title: "Recording HELLOworld",
      body:
        "A first recording with a lab Cognionics headset — 20 EEG electrodes in the 10-20 layout at 500 Hz, about a minute long, exported as BrainVision. The header's impedance table tells the story: Cz, T3, C4 and A2 had poor contact, and A2 is almost entirely 60 Hz mains. It ships here at 250 Hz as 16-bit integers, and everything you see is computed from it in the browser.",
      anchor: "#eeg",
    },
    {
      title: "The DSP notebook, finished",
      body:
        "The notebook loaded the recording with MNE, computed Welch coherence between channel pairs, and had a filter-and-downsample cell that was never finished. Each step is ported to TypeScript here — FIR lowpass and decimation (the completed cell), a 60 Hz notch, common-average referencing, Welch cross-spectra — and the ports are tested against SciPy on a slice of the recording. Coherence between electrode pairs — how much two regions oscillate together at each frequency — was the feature the venture wanted to track across nights.",
      anchor: "#eeg",
    },
    {
      title: "The business case",
      body:
        "The Basement's launch program at UC San Diego framed it as a diagnostic aid: overnight EEG plus a model to help psychiatrists tell bipolar disorder from depression, sold as a headset and a monitoring subscription. A Business Model Canvas, a Value Proposition Canvas and an Empathy Map from November 2024 close the page; the venture stopped at this prototype.",
      anchor: "#venture",
    },
  ],
  sources: [
    { name: "dsp.py", path: "demos/nocturnal_src/dsp.py", lang: "python", note: "The DSP notebook as a script, with the unfinished filter/downsample cell completed (2026-08-30)." },
    { name: "filters.ts", path: "src/demos/nocturnal/eeg/filters.ts", lang: "ts", note: "TypeScript port of the FIR lowpass / notch / decimate and common-average reference — tested against SciPy." },
    { name: "coherence.ts", path: "src/demos/nocturnal/eeg/coherence.ts", lang: "ts", note: "Welch PSD, cross-spectrum and magnitude-squared coherence (the notebook's compute_functional_coherence)." },
    { name: "Ganglion_01_BOM_CSV.csv", path: "demos/nocturnal_neuro_raw/kicad_ganglion_pcb/Ganglion_01_BOM_CSV.csv", lang: "csv", note: "The BOM with David's substitution notes (right-hand columns)." },
    { name: "nocturnal.ts", path: "scripts/demos/nocturnal.ts", lang: "ts", note: "Build-time prep: kicad-cli exports, SVG simplifier, footprint parser, BOM merge." },
    { name: "nocturnal_prep.py", path: "scripts/demos/nocturnal_prep.py", lang: "python", note: "Build-time prep: EEG re-encode, SciPy test fixture, DigiKey order, PDF rasters." },
    { name: "HARDWARE_FILES.md", path: "demos/nocturnal_src/HARDWARE_FILES.md", lang: "markdown", note: "What is in the KiCad project (not shipped) and how each asset on this page was derived from it." },
  ],
  sourceFooter:
    "OpenBCI Ganglion hardware design files are open hardware by OpenBCI, Inc. (see HARDWARE_FILES.md for the licence); the KiCad rework, sourcing notes, DSP work and canvases are David's. The EEG recording is David's own.",
};

export default meta;
