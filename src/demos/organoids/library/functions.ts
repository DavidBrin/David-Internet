/**
 * Data table for Chapter 5's dependency map. Every entry below is transcribed by hand from
 * `demos/psychedelic_organoids_raw/General_LFP_analysis_functions.py` (David Brin, 2024–25):
 * 25 top-level functions, in source order. (The file `import pickle`s but never defines a
 * pickle save/load helper — the consolidated library never grew one — so this map has no
 * pickle nodes, despite the working title once expecting ~26.)
 *
 * `mirror` hardcodes which earlier chapter panel on this page re-implements the same idea in
 * TypeScript, so the detail card can link out to it.
 */

export type StageId =
  | "load"
  | "spectra"
  | "windows"
  | "spikes"
  | "fooof"
  | "figures"
  | "bursts";

export interface Stage {
  id: StageId;
  label: string;
}

export const STAGES: Stage[] = [
  { id: "load", label: "load" },
  { id: "spectra", label: "spectra" },
  { id: "windows", label: "windows" },
  { id: "spikes", label: "spikes" },
  { id: "fooof", label: "fooof arrays" },
  { id: "figures", label: "figures" },
  { id: "bursts", label: "bursts" },
];

export interface Mirror {
  label: string;
  href: string;
}

export interface FnInfo {
  id: string;
  stage: StageId;
  signature: string;
  summary: string;
  mirror?: Mirror;
}

const CH_RAW: Mirror = { label: "Chapter 1 · raw voltage", href: "#raw" };
const CH_SPECTRUM: Mirror = { label: "Chapter 2 · what's in a spectrum", href: "#spectrum" };
const CH_DOSE: Mirror = { label: "Chapter 3 · dose and time", href: "#dose" };
const CH_COMPOUNDS: Mirror = { label: "Chapter 4 · four compounds, sixty days", href: "#compounds" };

export const FUNCTIONS: FnInfo[] = [
  // ---- load ----
  {
    id: "load_lfp",
    stage: "load",
    signature: "load_lfp(filename)",
    summary: "loads a preprocessed LFP file into one 3D array of recordings by well",
    mirror: CH_RAW,
  },
  {
    id: "load_spikes",
    stage: "load",
    signature: "load_spikes(mat_file_path)",
    summary: "loads spike times from a .mat file, formatted 6×8×4×4 by well and electrode",
    mirror: CH_COMPOUNDS,
  },

  // ---- spectra ----
  {
    id: "plot_one_pspectrum",
    stage: "spectra",
    signature: 'plot_one_pspectrum(sig, name="", fs_ds=100)',
    summary: "plots one Welch power spectrum for a single recording",
    mirror: CH_SPECTRUM,
  },
  {
    id: "plot_all_pspectra",
    stage: "spectra",
    signature: "plot_all_pspectra(ds_wells_data, fs_ds=100, n_rows=6, n_cols=8)",
    summary: "plots Welch power spectra for every well in the 6×8 grid",
    mirror: CH_SPECTRUM,
  },
  {
    id: "fooof_all_pspectra",
    stage: "spectra",
    signature: 'fooof_all_pspectra(ds_wells_data, fs_ds=100, fmode="knee", n_rows=6, n_cols=8)',
    summary: "fits and reports a FOOOF model for every well's power spectrum",
    mirror: CH_SPECTRUM,
  },

  // ---- windows ----
  {
    id: "ds_power_windows",
    stage: "windows",
    signature: 'ds_power_windows(sig, inc, name="", fs_ds=100)',
    summary: "plots the power spectrum of every fixed-size window of a 600s recording",
    mirror: CH_DOSE,
  },
  {
    id: "fooof_on_windows",
    stage: "windows",
    signature: 'fooof_on_windows(sig, inc, name="", fs_ds=100, fmode="knee")',
    summary: "same as ds_power_windows but fits and reports FOOOF per window",
    mirror: CH_DOSE,
  },
  {
    id: "fooof_wind_thresh",
    stage: "windows",
    signature:
      'fooof_wind_thresh(binary_activity, ds_wells_data, window_size, num_windows=6, fs_ds=100, fmode="knee", n_rows=6, n_cols=8)',
    summary: "fits FOOOF only on the windows plot_num_spikes_hist flagged active",
    mirror: CH_DOSE,
  },
  {
    id: "ndsp_wind_thresh",
    stage: "windows",
    signature:
      "ndsp_wind_thresh(binary_activity, ds_wells_data, window_size, num_windows=6, fs_ds=100, n_rows=6, n_cols=8)",
    summary: "same as fooof_wind_thresh but plots raw neurodsp spectra instead of fitting",
    mirror: CH_DOSE,
  },

  // ---- spikes ----
  {
    id: "spike_spacial_visualization",
    stage: "spikes",
    signature: "spike_spacial_visualization(spike_times_array, n_rows=6, n_cols=8)",
    summary: "heatmaps spike counts per well and per electrode across the plate",
    mirror: CH_COMPOUNDS,
  },
  {
    id: "spike_threshold_vis",
    stage: "spikes",
    signature: "spike_threshold_vis(spike_times_array, threshold=20, n_rows=6, n_cols=8)",
    summary: "colors each electrode green if its spike count crosses a threshold",
    mirror: CH_COMPOUNDS,
  },
  {
    id: "find_and_plot_active_spike_windows",
    stage: "spikes",
    signature:
      "find_and_plot_active_spike_windows(spike_times_array, window_size, threshold=0, n_rows=6, n_cols=8)",
    summary: "finds and bar-plots per-electrode spike counts across time windows, sorted by activity",
    mirror: CH_COMPOUNDS,
  },
  {
    id: "spikes_by_well",
    stage: "spikes",
    signature: "spikes_by_well(spike_times_array, n_rows=6, n_cols=8)",
    summary: "consolidates per-electrode spike times into one sorted array per well",
    mirror: CH_COMPOUNDS,
  },
  {
    id: "plot_num_spikes_hist",
    stage: "spikes",
    signature:
      "plot_num_spikes_hist(spike_times_by_well, window_size, num_windows=6, threshold=500, n_rows=6, n_cols=8)",
    summary: "histograms spike counts per window above a threshold; returns the binary active-window array",
    mirror: CH_COMPOUNDS,
  },

  // ---- fooof arrays ----
  {
    id: "set_fm_array",
    stage: "fooof",
    signature: 'set_fm_array(ds_wells_data, fs_ds=100, fmode="knee", n_rows=6, n_cols=8)',
    summary: "fits a FOOOF model per well and returns the 6×8 array of fitted objects",
    mirror: CH_SPECTRUM,
  },
  {
    id: "set_fm_array_one_outlier",
    stage: "fooof",
    signature:
      'set_fm_array_one_outlier(ds_wells_data, fs_ds=100, fmode="knee", n_rows=6, n_cols=8, indices=[-1, -1])',
    summary: "same as set_fm_array but skips one specified well",
    mirror: CH_SPECTRUM,
  },

  // ---- figures ----
  {
    id: "param_heatmap",
    stage: "figures",
    signature: 'param_heatmap(fm_array, fmode="knee", n_rows=6, n_cols=8)',
    summary: "heatmaps the fitted aperiodic offset / knee / exponent / R² across the plate",
    mirror: CH_DOSE,
  },
  {
    id: "plot_variability",
    stage: "figures",
    signature: 'plot_variability(fm_array, dose_grid, n_rows=6, n_cols=8, fmode="knee")',
    summary: "bar-plots the standard deviation of aperiodic parameters within each dose group",
    mirror: CH_COMPOUNDS,
  },
  {
    id: "plot_aperiodic_boxplot",
    stage: "figures",
    signature: 'plot_aperiodic_boxplot(fm_array, dose_grid, fmode="knee", n_rows=6, n_cols=8)',
    summary: "boxplots aperiodic offset / knee / exponent grouped by dose",
    mirror: CH_COMPOUNDS,
  },
  {
    id: "plot_peak_boxplot",
    stage: "figures",
    signature: "plot_peak_boxplot(fm_array, n_rows=6, n_cols=8)",
    summary: "boxplots each well's first fitted peak's center frequency, power, and bandwidth",
    mirror: CH_COMPOUNDS,
  },
  {
    id: "plot_peak_boxplot2",
    stage: "figures",
    signature: "plot_peak_boxplot2(fm_array, dose_grid, n_rows=6, n_cols=8)",
    summary: "boxplots peak count and every peak's parameters grouped by dose",
    mirror: CH_COMPOUNDS,
  },
  {
    id: "plot_peak_binary_heatmap",
    stage: "figures",
    signature: "plot_peak_binary_heatmap(fm_array, n_rows=6, n_cols=8)",
    summary: "heatmaps whether each well has any fitted FOOOF peak at all",
    mirror: CH_COMPOUNDS,
  },

  // ---- bursts ----
  {
    id: "isi_array",
    stage: "bursts",
    signature: "isi_array(spike_times_array)",
    summary: "computes inter-spike intervals for every electrode in the 6×8×4×4 grid",
    mirror: CH_COMPOUNDS,
  },
  {
    id: "burst_rate",
    stage: "bursts",
    signature: "burst_rate(isi_arr, isi_thresh=1.0, min_spikes=3)",
    summary: "counts bursts — runs of short ISIs — per electrode and heatmaps them by well",
    mirror: CH_COMPOUNDS,
  },
  {
    id: "network_events",
    stage: "bursts",
    signature: "network_events(spike_times_array, isi_thresh=1, min_spikes=3)",
    summary: "counts synchronized multi-electrode spike events per well within a time window",
    mirror: CH_COMPOUNDS,
  },
];

export const FUNCTION_MAP: Record<string, FnInfo> = Object.fromEntries(
  FUNCTIONS.map((fn) => [fn.id, fn])
);

/** Data-flow dependency edges: [fromId, toId]. Drawn as curved edges on the map. */
export const EDGES: [string, string][] = [
  // load_lfp feeds everything that takes ds_wells_data / a well signal
  ["load_lfp", "plot_one_pspectrum"],
  ["load_lfp", "plot_all_pspectra"],
  ["load_lfp", "fooof_all_pspectra"],
  ["load_lfp", "ds_power_windows"],
  ["load_lfp", "fooof_on_windows"],
  ["load_lfp", "fooof_wind_thresh"],
  ["load_lfp", "ndsp_wind_thresh"],
  ["load_lfp", "set_fm_array"],
  ["load_lfp", "set_fm_array_one_outlier"],

  // load_spikes feeds everything that takes spike_times_array
  ["load_spikes", "spike_spacial_visualization"],
  ["load_spikes", "spike_threshold_vis"],
  ["load_spikes", "find_and_plot_active_spike_windows"],
  ["load_spikes", "spikes_by_well"],
  ["load_spikes", "isi_array"],
  ["load_spikes", "network_events"],

  // spikes_by_well -> plot_num_spikes_hist -> the windowed-threshold fits
  ["spikes_by_well", "plot_num_spikes_hist"],
  ["plot_num_spikes_hist", "fooof_wind_thresh"],
  ["plot_num_spikes_hist", "ndsp_wind_thresh"],

  // fm_array producers feed every parameter figure
  ["set_fm_array", "param_heatmap"],
  ["set_fm_array", "plot_variability"],
  ["set_fm_array", "plot_aperiodic_boxplot"],
  ["set_fm_array", "plot_peak_boxplot"],
  ["set_fm_array", "plot_peak_boxplot2"],
  ["set_fm_array", "plot_peak_binary_heatmap"],
  ["set_fm_array_one_outlier", "param_heatmap"],
  ["set_fm_array_one_outlier", "plot_aperiodic_boxplot"],

  // isi_array -> burst_rate
  ["isi_array", "burst_rate"],
];

/** One step of the "replay PlateF-D30" animation: a real cell from the scraped notebook. */
export interface ReplayStep {
  cell: number;
  /** One or more real lines of code from that cell, logged verbatim. */
  code: string[];
  /** Node ids that light up for this step. */
  nodes: string[];
  /** Source node ids whose edges into `nodes` should glow (subset of EDGES). */
  via: string[];
}

/**
 * The real call order of
 * demos/psychedelic_organoids_raw/code_scraped_from_large_notebooks/PlateF-D30.py.
 * Cells 14 and 16 (building `dose_grid`) aren't function calls, so they're skipped here —
 * every other cell in the notebook appears as one step.
 */
export const REPLAY_STEPS: ReplayStep[] = [
  {
    cell: 3,
    code: [
      'lfp_data = load_lfp(r"...\\PlateF\\d30\\lfp_data.h5")',
      'spike_times = load_spikes(r"...\\PlateF\\d30\\spike_data.mat")',
    ],
    nodes: ["load_lfp", "load_spikes"],
    via: [],
  },
  {
    cell: 4,
    code: ["plot_all_pspectra(lfp_data)"],
    nodes: ["plot_all_pspectra"],
    via: ["load_lfp"],
  },
  {
    cell: 5,
    code: ['fooof_all_pspectra(lfp_data, fs_ds = 100, fmode = "fixed")'],
    nodes: ["fooof_all_pspectra"],
    via: ["load_lfp"],
  },
  {
    cell: 6,
    code: ["spike_spacial_visualization(spike_times)"],
    nodes: ["spike_spacial_visualization"],
    via: ["load_spikes"],
  },
  {
    cell: 7,
    code: ["spike_threshold_vis(spike_times)"],
    nodes: ["spike_threshold_vis"],
    via: ["load_spikes"],
  },
  {
    cell: 8,
    code: ["find_and_plot_active_spike_windows(spike_times, 100, threshold = 10)"],
    nodes: ["find_and_plot_active_spike_windows"],
    via: ["load_spikes"],
  },
  {
    cell: 9,
    code: [
      "spike_times_by_well = spikes_by_well(spike_times)",
      "binary_activity = plot_num_spikes_hist(spike_times_by_well, 100, num_windows = 6, threshold = 300)",
    ],
    nodes: ["spikes_by_well", "plot_num_spikes_hist"],
    via: ["load_spikes", "spikes_by_well"],
  },
  {
    cell: 10,
    code: ['fooof_wind_thresh(binary_activity, lfp_data, 100, fmode = "fixed")'],
    nodes: ["fooof_wind_thresh"],
    via: ["plot_num_spikes_hist", "load_lfp"],
  },
  {
    cell: 11,
    code: ["ndsp_wind_thresh(binary_activity, lfp_data, 100)"],
    nodes: ["ndsp_wind_thresh"],
    via: ["plot_num_spikes_hist", "load_lfp"],
  },
  {
    cell: 12,
    code: ["fm_array = set_fm_array(lfp_data, fmode = 'fixed')"],
    nodes: ["set_fm_array"],
    via: ["load_lfp"],
  },
  {
    cell: 13,
    code: ['param_heatmap(fm_array, fmode = "fixed")'],
    nodes: ["param_heatmap"],
    via: ["set_fm_array"],
  },
  {
    cell: 15,
    code: ['plot_variability(fm_array, dose_grid, fmode = "fixed")'],
    nodes: ["plot_variability"],
    via: ["set_fm_array"],
  },
  {
    cell: 17,
    code: ['plot_aperiodic_boxplot(fm_array,  dose_grid, fmode = "fixed")'],
    nodes: ["plot_aperiodic_boxplot"],
    via: ["set_fm_array"],
  },
  {
    cell: 18,
    code: ["plot_peak_boxplot(fm_array)"],
    nodes: ["plot_peak_boxplot"],
    via: ["set_fm_array"],
  },
  {
    cell: 19,
    code: ["plot_peak_binary_heatmap(fm_array)"],
    nodes: ["plot_peak_binary_heatmap"],
    via: ["set_fm_array"],
  },
];
