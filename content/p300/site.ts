import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "p300",
  kind: "demo",
  displayName: "P300 Speller",
  fakeDomain: "p300.davids.net",
  liveUrl: "/demos/p300",
  tagline: "Spell letters with an evoked potential: a live 6x6 flashing matrix, an ERP rising out of averaged noise, and the CNN family that decodes it.",
  description:
    "Interactive demo of the P300 brain-computer-interface speller studied on Triton Neurotech's ML team (David's team; the codebase is the open-source p300-speller project by Carzaniga & Gualniera, on BCI Competition III dataset II). A 6x6 character matrix flashes rows and columns at the real cadence (100 ms on / 75 ms off, 15 repetitions) over scrolling synthetic 8-channel EEG; target flashes carry a P300 that only becomes visible as epochs average, and the repo's actual letter-decoding logic - ported to TypeScript and fixture-tested - accumulates row/column scores until the letter locks in. A second panel maps the 1D-CNN family (CNN1-3, MCNN1-3) onto a 64-electrode head map with every electrode-subset variant, and a results panel shows the committed notebook outputs: ~73-80% window accuracy and a speller that climbs from 37% to 94% of letters correct as repetitions accumulate.",
  accentColor: "#A855F7",
  favicon: "\u{1F9E0}",
  techStack: [
    "Python", "Keras", "NumPy", "SciPy", "BCI Competition III", "TypeScript", "Canvas",
  ],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#speller",
      title: "The live speller",
      snippet:
        "Pick a target letter and watch the matrix flash at 100 ms / 75 ms while synthetic EEG scrolls beneath; the target-flash average grows a P300, row/column scores accumulate, and the letter locks in. SNR slider shows why more repetitions help.",
      keywords: ["p300", "erp", "flashing matrix", "averaging", "oddball", "speller"],
    },
    {
      path: "#classifier",
      title: "From a window to a classifier",
      snippet:
        "The 650 ms x 64-channel window as the CNN's input image, the five-layer 1D CNN, and a 10-20 head map with every electrode subset the project tried - 8 prefixed channels, the learned 8, and the six lobes.",
      keywords: ["cnn", "eeg channels", "10-20 system", "spatial filters", "electrodes"],
    },
    {
      path: "#results",
      title: "The model family results",
      snippet:
        "Committed notebook outputs for subject B: window-classification accuracy for CNN1-3 and the MCNN ensembles, and character accuracy climbing 37% to 94% over 15 repetitions - with the actual 100-letter test sentence it spelled.",
      keywords: ["accuracy", "results", "mcnn", "ensembles", "repetitions", "bci competition"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "p300", "bci", "brain computer interface", "speller", "erp", "eeg", "cnn",
    "triton neurotech", "bci competition iii",
  ],
  knowledgePanel: {
    type: "Team project demo",
    facts: {
      Team: "Triton Neurotech (UCSD) - David on the ML team",
      Codebase: "open-source p300-speller (Carzaniga & Gualniera), studied by the team",
      Data: "BCI Competition III dataset II - 2 subjects, 64-channel EEG",
      Models: "8 variants: CNN1, CNN2a/b/c, CNN3, MCNN1-3",
      "On this page": "live speller sim on synthetic EEG; decoding logic ported + fixture-tested; results quoted from the notebooks",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
