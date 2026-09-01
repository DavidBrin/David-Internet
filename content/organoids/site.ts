import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "organoids",
  kind: "demo",
  displayName: "Organoids on Psychedelics",
  fakeDomain: "organoids.davids.net",
  liveUrl: "/demos/organoids",
  tagline: "A year of organoid electrophysiology — MATLAB to FOOOF to dose-response — replayed as chapters.",
  description:
    "Scroll-through demo of David's Voytek Lab project analyzing cortical organoids on a 48-well MEA plate under psychedelics (5-MeO-DMT, psilocybin, LSD, psilocin). Five chronological chapters: raw LFP preprocessing in MATLAB, FOOOF spectral parameterization animated peak by peak, a dose-overlay plate with a day slider and parameter heatmaps, spike rasters with burst and network-event detection plus dose-response boxplots, and an animated dependency map of the final 25-function analysis library. Interactive panels run on clearly-labeled synthetic data (no lab recordings ship); the real figures from the notebooks sit alongside each panel.",
  accentColor: "#EC4899",
  favicon: "🧫",
  techStack: [
    "Python", "NumPy/SciPy", "neurodsp", "FOOOF / specparam", "MATLAB", "HDF5",
    "Axion MEA", "TypeScript", "Canvas/SVG",
  ],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#raw",
      title: "Chapter 1 — Raw voltage",
      snippet:
        "A well's LFP streams by at 100 Hz while the MATLAB chain that produced it — Axion raw, bandpass, downsample, HDF5 — toggles stage by stage.",
      keywords: ["lfp", "matlab", "preprocessing", "axion", "mea", "downsample"],
    },
    {
      path: "#spectrum",
      title: "Chapter 2 — What's in a spectrum",
      snippet:
        "Click a well: its power spectrum draws in log-log, the aperiodic 1/f fit slides underneath, and Gaussian peaks pop out one at a time — FOOOF, animated.",
      keywords: ["fooof", "specparam", "power spectrum", "aperiodic", "exponent", "knee"],
    },
    {
      path: "#dose",
      title: "Chapter 3 — Dose and time",
      snippet:
        "Plate D: 5-MeO-DMT 10/20 µM vs vehicle with a D-1→D20 day slider; flip the plate into parameter-heatmap mode and scrub days to watch exponents drift.",
      keywords: ["5-meo-dmt", "dose", "heatmap", "day slider", "plate d", "baseline"],
    },
    {
      path: "#compounds",
      title: "Chapter 4 — Four compounds, sixty days",
      snippet:
        "Plate F: psilocybin / LSD / psilocin / vehicle, stim vs no-stim. A 48-well raster sweeps while bursts glow and network events band across wells; boxplots group by compound.",
      keywords: ["psilocybin", "lsd", "psilocin", "burst", "network events", "boxplot", "raster"],
    },
    {
      path: "#library",
      title: "Chapter 5 — The library",
      snippet:
        "25 functions, one dependency map: watch a per-day notebook light up load → spectra → FOOOF → windows → spikes → bursts → figures in call order.",
      keywords: ["library", "dependency map", "refactor", "functions", "pipeline"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "organoid", "mea", "psychedelic", "fooof", "specparam", "lfp", "5-meo-dmt",
    "psilocybin", "lsd", "psilocin", "voytek", "burst", "network event",
  ],
  knowledgePanel: {
    type: "Research analysis demo",
    facts: {
      Lab: "Voytek Lab, UC San Diego",
      Model: "cortical organoids on a 48-well MEA (6×8, 16 electrodes/well)",
      Compounds: "5-MeO-DMT (10/20 µM); psilocybin · LSD · psilocin; vehicle controls",
      Timeline: "D-1 baseline → D60, Jul 2024 – Jun 2025",
      Method: "FOOOF aperiodic/periodic parameterization; burst + network-event detection",
      Data: "interactive panels are synthetic (labeled); figures are real analysis outputs",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
