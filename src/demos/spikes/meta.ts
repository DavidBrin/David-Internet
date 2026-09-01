import type { DemoMeta } from "@/lib/demos";

const LAB = "demos/spikeparam_raw/spikeparam";

const meta: DemoMeta = {
  slug: "spikes",
  theme: { bg: "#fbf5e9", panel: "#f5ecd6" }, // warm oscilloscope amber — patch-clamp bench
  what: "a primate action potential detected, dissected, and fitted live on real public data",
  why: "one spike has anatomy — a ramp, an inflection, a peak, a decay — and each part gets a number",
  when: "Voytek Lab, UC San Diego, 2024",
  story: [
    {
      title: "One spike, eleven numbers",
      body:
        "In the Voytek Lab, David's project was parameterizing intracellular action potentials: take a raw patch-clamp sweep, find every spike, and reduce each one to a handful of interpretable numbers — ramp slope, inflection point, peak width and sharpness, exponential decay rate. The lab's spikeparam package defines the model; this page runs it on real recordings, in your browser.",
    },
    {
      title: "Learning the lab's model",
      body:
        "spikeparam (a Voytek Lab package, NIH R01 GM134363) fits each windowed spike in a fixed order: smooth the derivative with LOWESS, find the inflection as the intersection of two line fits, open calipers at half-height for the peak width, then fit a bounded exponential down the tail. Panel 1 animates exactly that sequence. An alternative model — the sum of two skewed Gaussians — refits the same waveform with r² ≈ 0.999.",
      anchor: "#dissect",
    },
    {
      title: "Getting the data",
      body:
        "The recordings are marmoset cortical neurons from the Primate Cell Type Database (primatedatabase.com), published on DANDI as dandiset 001776 (CC-BY-4.0) — NWB files read with h5py, each sweep an 8-second current-clamp trace at 50 kHz. The notebooks' loader (extract_data) walked the acquisition group of each file; the page ships four real sweeps and the feature table from ten subjects.",
      anchor: "#dissect",
    },
    {
      title: "The parameters become sliders",
      body:
        "Fitting is a one-way street until you invert it: panel 2 turns the fitted parameters into sliders and regenerates a waveform from them (gen_fit_ramp + gen_fit_exp, or the two skewed Gaussians), with a real spike ghosted underneath to match by hand. The mini train at the bottom is sim_patch — spikes stitched together with exponential hyperpolarization at whatever ISI you dial in.",
      anchor: "#sandbox",
    },
    {
      title: "The MEGA dataframe",
      body:
        "Every sweep of every file went through the same pipeline into one growing table — monkey_df, affectionately the 'super mega df' in the code — then metadata joined on: species, brain region, cortical layer, sex, dendritic type. Panel 3 is that table as a live scatter: pick any two features, brush a region, and the real waveforms behind the selected points overlay on the right, with the group boxplots the notebooks drew beside them.",
      anchor: "#population",
    },
    {
      title: "Describing, not concluding",
      body:
        "The original statistics compared features across metadata groups (boxplots, overlapped average waveforms, ANOVA). That analysis is unpublished, so this page shows what was compared and how — not scientific conclusions. The shipped figures are David's own rendered outputs from the 2024 notebooks.",
    },
    {
      title: "Rebuilt for this page (2026-09-01)",
      body:
        "The TS port of spikeparam's fit (LOWESS, control points, bounded exponential fit) was written with AI coding tools and is fixture-tested against the real Python pipeline on the shipped sweeps — spike detection matches sample-for-sample. The live feature table was rebuilt from the current public release of the dataset (10 files, ~2,700 spikes, all Callithrix jacchus); the 2024 analysis in the figures also drew on macaque files from a pre-release version that the published dandiset has since superseded, so the figures show species and regions (LIP, Macaca) the rebuilt table doesn't contain. spikeparam is the lab's work — David is a user of the package, not an author.",
    },
  ],
  sources: [
    { name: "spike_functions.py", path: "demos/spike_proj_raw/spike_functions.py", lang: "python", note: "David's pipeline: NWB sweep loader, monkey_df / monkey_dict builders, boxplots and overlapped-waveform plots." },
    { name: "fit.py", path: `${LAB}/patch/fit/fit.py`, lang: "python", note: "spikeparam (Voytek Lab): the Spike class — detection, windowing, per-spike fitting, the features dataframe." },
    { name: "points.py", path: `${LAB}/patch/points/points.py`, lang: "python", note: "spikeparam (Voytek Lab): control points — LOWESS-smoothed derivative, inflection from two line fits." },
    { name: "intra.py", path: `${LAB}/patch/features/intra.py`, lang: "python", note: "spikeparam (Voytek Lab): ramp, peak, and bounded exponential-decay features." },
    { name: "skg/fit.py", path: `${LAB}/skg/fit.py`, lang: "python", note: "spikeparam (Voytek Lab): the skewed-gaussian spike model (sum of two skewed Gaussians)." },
    { name: "points.ts", path: "src/demos/spikes/core/points.ts", lang: "ts", note: "TS port of the control-point logic, LOWESS included — fixture-tested against the Python pipeline." },
    { name: "features.ts", path: "src/demos/spikes/core/features.ts", lang: "ts", note: "TS port of the ramp/peak/decay features with a small bounded Levenberg–Marquardt fitter." },
    { name: "prep script", path: "scripts/demos/spikes_prep.py", lang: "python", note: "Build-time prep: downloads a per-subject sample of DANDI:001776, runs the real spikeparam pipeline, writes assets + fixtures." },
  ],
  sourceFooter:
    "spikeparam is a Voytek Lab package (NIH R01 GM134363) — David used it, and the lab's files above are shown as lab code. Data: Primate Cell Type Database, DANDI:001776 (CC-BY-4.0). The statistical analysis is unpublished; this page describes methods, not findings.",
};

export default meta;
