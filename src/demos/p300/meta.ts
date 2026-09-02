import type { DemoMeta } from "@/lib/demos";

const SRC = "demos/p300_src";

const meta: DemoMeta = {
  slug: "p300",
  theme: { bg: "#f4f0fa", panel: "#e9e1f6" }, // violet - evoked potentials on a dark clinic screen
  what: "a 6x6 letter matrix flashing rows and columns until an averaged brain wave says which one you watched",
  why: "one P300 is buried in noise - the whole idea of an ERP speller is that fifteen averaged flashes aren't",
  when: "Triton Neurotech (UCSD), ML team - the open-source p300-speller CNN family on BCI Competition III",
  story: [
    {
      title: "A letter without a keystroke",
      body:
        "Triton Neurotech is UCSD's student brain-computer-interface team; David worked on the ML side. The problem their speller line of work addresses is assistive communication: a person who cannot move or speak watches a 6x6 grid of characters while rows and columns flash, and the EEG betrays which cell they were watching. No muscles involved - the signal is the P300, a positive voltage bump about 300 ms after a stimulus the brain considers relevant.",
      anchor: "#speller",
    },
    {
      title: "Twelve flashes, one oddball",
      body:
        "In one repetition, each of the 6 rows and 6 columns lights up once, in random order - 100 ms on, 75 ms off. Only 2 of those 12 flashes contain the watched letter, which makes them oddballs, and oddballs evoke the P300. A single response is far below the noise floor, so the paradigm repeats everything 15 times and averages: noise cancels, the P300 stays. The live speller above runs this exact cadence on synthetic EEG - watch the target-flash average separate from the non-target average as repetitions accumulate.",
      anchor: "#speller",
    },
    {
      title: "650 milliseconds at a time",
      body:
        "The pipeline never sees a raw recording: it sees windows. Each flash opens a 650 ms window across the electrodes (bandpassed 0.1-20 Hz, downsampled 240 to 120 Hz, z-scored per window), giving a 78-sample x N-channel patch - and P300 detection becomes binary image classification. The five-layer 1D CNN reads it in two moves: a kernel-size-1 convolution that mixes channels at each instant (a spatial filter over the scalp), then a temporal convolution that slides over the window.",
      anchor: "#classifier",
    },
    {
      title: "A family of small CNNs",
      body:
        "The project treats the architecture as a family of experiments. CNN1 is the base model on all 64 electrodes; CNN2a keeps only the 8 classic P300 sites (Fz, Cz, Pz, P3, P4, PO7, PO8, Oz); CNN2b picks its 8 electrodes by reading CNN1's first-layer weights; CNN2c tries whole lobes at a time; CNN3 forces a single spatial filter to see what one scalp pattern can do. MCNN1-3 are ensembles of five (or three) CNN1s trained on different subsets, averaging their votes. The head map below shows every subset on the 10-20 layout.",
      anchor: "#classifier",
    },
    {
      title: "What the numbers said",
      body:
        "On subject B's 100-letter test set (the runs committed in the notebooks), single windows are hard: 73.7-79.0% weighted accuracy across the single CNNs, with the ensembles at 78.8-79.6%. But the speller doesn't need single windows - it averages scores across repetitions before picking a row and a column. Character accuracy climbs from 37% after one repetition to 94% by twelve. The results panel shows the actual sentence the pipeline spelled, mistakes highlighted.",
      anchor: "#results",
    },
    {
      title: "Whose work is what (built 2026-09-01)",
      body:
        "Honesty box: the CNN family, notebooks and quoted results are the open-source p300-speller project by Manuel Carzaniga and Lorenzo Gualniera - the codebase archived here and studied on the ML team; David's role stayed on the ML side of Triton Neurotech's speller work, not the UI, and none of this page's numbers are his runs. The live speller is this page's own build: synthetic EEG (no BCI Competition data is shipped), with the notebook's letter-decoding logic ported to TypeScript and fixture-tested against the Python original. The classifier panel's spatial-filter weights are illustrative - no trained checkpoint was archived. TS widgets written with AI coding tools.",
    },
  ],
  sources: [
    { name: "P300speller decoding", path: `${SRC}/p300speller_extract.py`, lang: "python", note: "The speller pipeline (extracted from the notebook): windowing, per-flash CNN scores, mean_predictions over repetitions, row/column argmax, tie-breaking. The TS port in decode.ts mirrors this file." },
    { name: "CNN1", path: `${SRC}/cnn1_extract.py`, lang: "python", note: "The base model (extracted): preprocessing, the 5-layer 1D CNN with cecotti_normal init and scaled tanh, training with class weights, weighted test evaluation." },
    { name: "MCNN1", path: `${SRC}/mcnn1_extract.py`, lang: "python", note: "The ensemble variant (extracted): five CNN1s trained on five balanced subsets, averaged at prediction time." },
    { name: "cnn2a.py", path: `${SRC}/cnn2a.py`, lang: "python", note: "The 8-electrode variant as a plain script (from the repo's magician/ folder, vendored as-is): the classic P300 sites Fz, Cz, Pz, P3, P4, PO7, PO8, Oz." },
    { name: "decode.ts", path: "src/demos/p300/core/decode.ts", lang: "ts", note: "TS port of the notebook's letter decoding (sort/mean predictions, round_argmax, intersections, tie-breaking) - fixture-tested against the Python original." },
    { name: "eeg.ts", path: "src/demos/p300/core/eeg.ts", lang: "ts", note: "The synthetic EEG for the live sim: seeded 1/f-ish noise + occipital alpha + a P300 template on target flashes, plus the 100/75 ms flash scheduler." },
    { name: "prep script", path: "scripts/demos/p300_prep.py", lang: "python", note: "Build-time prep: compresses the README figures, packages the notebooks' committed results, builds the head-map layout + illustrative filters, writes the decode fixture." },
  ],
  sourceFooter:
    "Codebase and results: the p300-speller project by Manuel Carzaniga (Manucar) and Lorenzo Gualniera (Gualor), github.com/Manucar/p300-speller - archived and studied on Triton Neurotech's ML team (UCSD), where David worked on the ML side (not the UI). Data: BCI Competition III dataset II (Wadsworth Center; Blankertz et al.) - not shipped; the live sim is synthetic. Head-map electrode positions are approximate 10-20 layout.",
};

export default meta;
