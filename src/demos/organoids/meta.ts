import type { DemoMeta } from "@/lib/demos";

const RAW = "demos/psychedelic_organoids_raw";

const meta: DemoMeta = {
  slug: "organoids",
  theme: { bg: "#fdf2f7", panel: "#f9e2ee" }, // culture-media pink — a year at the bench
  what: "a year of organoid electrophysiology, replayed chapter by chapter",
  why: "watching an analysis pipeline grow up teaches more than its final figure",
  when: "Voytek Lab, UC San Diego, Jul 2024 – Jun 2025",
  story: [
    {
      title: "Organoids, electrodes, psychedelics",
      body:
        "Cortical organoids grown on a 48-well multi-electrode array plate, dosed with psychedelics, recorded for ten minutes at a time over months. David's part: the entire signal-analysis pipeline — from Axion's raw broadband files to dose-response figures. This page replays that year chronologically; the page itself gets more polished as the analysis did.",
    },
    {
      title: "Chapter 1 — MATLAB first, because Axion",
      body:
        "Axion's MEA tooling speaks MATLAB, so the pipeline starts there: load the raw broadband, pull the downsampled LFP per well into one 6×8×time array, export spike times from the .spk files, save HDF5 for Python. The first Python notebook (ds_lfp_07-29-24) is 221 figures of pure looking-at-data.",
      anchor: "#raw",
    },
    {
      title: "Chapter 2 — what's in a spectrum",
      body:
        "The analytical lens for everything after: FOOOF (specparam — also Voytek Lab software) splits each well's power spectrum into an aperiodic 1/f background (offset, knee, exponent) and oscillatory peaks. Click any well and watch the decomposition happen. The fixed-vs-knee toggle previews a choice that matters later — organoid spectra bend, and knee mode follows the bend.",
      anchor: "#spectrum",
    },
    {
      title: "Chapter 3 — dose and time (Plate D, 5-MeO-DMT)",
      body:
        "The first real experiment: 5-MeO-DMT at 10 µM and 20 µM against methanol vehicle and blank wells, stim and no-stim rows, recorded from a day before dosing (D-1) to day 20. The plate view gains a dose overlay and a day slider; the parameter heatmap mode is where trends live. One well, one day, one notebook — which is how single notebooks reached 39 MB.",
      anchor: "#dose",
    },
    {
      title: "Chapter 4 — four compounds, sixty days (Plate F)",
      body:
        "The full design: psilocybin, LSD, and psilocin against vehicle, stim vs no-stim rows, D-1 to D60, fitted in knee mode. Spikes join the story — inter-spike intervals, burst detection per electrode, and network events when several electrodes in a well fire together. The dose-response boxplots at the end are the year's payoff figure.",
      anchor: "#compounds",
    },
    {
      title: "Chapter 5 — the library",
      body:
        "By June 2025 the per-day notebook era ends: 25 functions consolidated into General_LFP_analysis_functions.py — load, spectra, FOOOF arrays, windows, spikes, bursts, heatmaps, boxplots. The dependency map shows how a per-day notebook walks the library; every panel above cites the function it mirrors.",
      anchor: "#library",
    },
    {
      title: "Rebuilt for this page (2026-09-01)",
      body:
        "No lab data ships with this page: the interactive panels run on seeded synthetic signals — colored noise with dose-conditioned spectral parameters, labeled 'illustrative' wherever they appear — while the figures beside them are David's real rendered analysis outputs, extracted from the notebooks. The FOOOF fitting on this page is a TypeScript port of the real fooof 1.1 algorithm, fixture-tested against the Python package; the burst and network-event detectors are exact ports. Built with AI coding tools.",
    },
  ],
  sources: [
    { name: "lfp_processing.m", path: "demos/organoids_src/lfp_processing.m", lang: "matlab", note: "MATLAB: Axion raw broadband → per-well HDF5 (collaborator paths redacted)." },
    { name: "LFP_Preprocessing_broadband.m", path: "demos/organoids_src/LFP_Preprocessing_broadband.m", lang: "matlab", note: "MATLAB: downsampled LFP per well → one 6×8×time array in lfp_data.h5." },
    { name: "Spike_Processing.m", path: `${RAW}/Spike_Processing.m`, lang: "matlab", note: "MATLAB: .spk spike times + waveforms → spike_data.mat." },
    { name: "General_LFP_analysis_functions.py", path: `${RAW}/General_LFP_analysis_functions.py`, lang: "python", note: "The consolidated library (David Brin, 2024–2025): 25 functions from load_lfp to network_events. Chapter 5 maps it." },
    { name: "A_LFP_analysis_functions.py", path: `${RAW}/A_LFP_analysis_functions.py`, lang: "python", note: "The earlier Plate A-era function collection the library grew out of." },
    { name: "PlateF-D30.py", path: `${RAW}/code_scraped_from_large_notebooks/PlateF-D30.py`, lang: "python", note: "A representative per-day notebook (code cells scraped from the 29 MB original): the full walk through the library." },
    { name: "specparam.ts", path: "src/demos/organoids/core/specparam.ts", lang: "ts", note: "TS port of FOOOF 1.1's fit algorithm — robust aperiodic fit, iterative peak search, joint gaussian refit." },
    { name: "synth.ts", path: "src/demos/organoids/core/synth.ts", lang: "ts", note: "The seeded synthetic-data generator behind every interactive panel (illustrative, not lab data)." },
    { name: "bursts.ts", path: "src/demos/organoids/core/bursts.ts", lang: "ts", note: "Exact ports of isi_array / burst_rate / network_events." },
  ],
  sourceFooter:
    "Organoid culture, recordings, and experimental design by Voytek Lab collaborators; preprocessing, analysis pipeline, and figures by David. FOOOF/specparam is Voytek Lab software. Data is unpublished lab work — no recordings ship with this page, and it makes no claims about drug effects.",
};

export default meta;
