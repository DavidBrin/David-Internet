import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "spikes",
  kind: "demo",
  displayName: "Anatomy of a Spike",
  fakeDomain: "spikes.davids.net",
  liveUrl: "/demos/spikes",
  tagline: "A primate action potential detected, dissected, and re-fitted live — on real public data.",
  description:
    "Interactive demo of David's Voytek Lab spike-parameterization project: a real marmoset patch-clamp sweep (Primate Cell Type Database, DANDI:001776) scrubs under a cursor while spikes are detected, windowed, and fitted piece by piece with the lab's spikeparam model — LOWESS-smoothed derivative, inflection point, peak calipers, bounded exponential decay, and a two-skewed-Gaussian alternative at r² ≈ 0.999. The fitted parameters become sliders that regenerate a waveform, and the full cross-subject feature table is a brushable scatter that pulls up the matching real waveforms. All fits run client-side in a TypeScript port verified against the Python pipeline.",
  accentColor: "#F59E0B",
  favicon: "⚡",
  techStack: [
    "Python", "NumPy/SciPy", "pandas", "h5py / NWB", "DANDI", "statsmodels",
    "spikeparam (Voytek Lab)", "TypeScript", "Canvas/SVG",
  ],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#dissect",
      title: "The spike, dissected",
      snippet:
        "Scrub a real 50 kHz patch-clamp sweep; each detected spike snaps out and its fit animates in the order the code computes it — ramp, inflection, peak calipers, exponential tail.",
      keywords: ["spike detection", "action potential", "patch clamp", "lowess", "control points", "fit"],
    },
    {
      path: "#sandbox",
      title: "Parameter → shape sandbox",
      snippet:
        "Drag ramp slope, peak width, and decay rate to regenerate a waveform over a ghosted real spike; switch to the two-skewed-Gaussian model, or stitch a spike train with sim_patch.",
      keywords: ["generative model", "skewed gaussian", "exponential decay", "isi", "simulation"],
    },
    {
      path: "#population",
      title: "Population scatter",
      snippet:
        "2,600+ fitted spikes from ten marmosets: pick any two features, brush the scatter, and the selected spikes' real waveforms overlay with mean ± SD, next to the notebooks' group boxplots.",
      keywords: ["feature table", "brushing", "boxplot", "correlation", "metadata", "marmoset"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "spike", "action potential", "patch clamp", "spikeparam", "nwb", "dandi",
    "primate", "marmoset", "voytek", "electrophysiology", "lowess",
  ],
  knowledgePanel: {
    type: "Research analysis demo",
    facts: {
      Lab: "Voytek Lab, UC San Diego",
      Data: "Primate Cell Type Database — DANDI:001776 (CC-BY-4.0), marmoset patch-clamp NWB",
      Model: "ramp → inflection → peak → exponential decay; alt: sum of two skewed Gaussians",
      Features: "11 per spike (ramp, inflection, peak, decay, ISI, r²)",
      Package: "spikeparam — Voytek Lab (NIH R01 GM134363); David is a user, not an author",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
