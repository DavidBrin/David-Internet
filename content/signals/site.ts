import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "signals",
  kind: "demo",
  displayName: "Signals & Systems Lab",
  fakeDomain: "signals.davids.net",
  liveUrl: "/demos/signals",
  tagline: "All five ECE 101 MATLAB labs, live in the browser — hear them, see them, poke them.",
  description:
    "Interactive demo of the ECE 101 (UC San Diego) MATLAB labs, ported to TypeScript: decrypt a scrambled audio message step by step (magnitude/phase unpacking, halves, and a seeded permutation), cancel a real echo with an inverse IIR filter and watch its poles approach the unit circle, deblur an image by inverting a Toeplitz system and see why inverses are fragile, hear a sinusoid and a chirp alias as the sampling rate drops, and balance a stick on a cart with proportional-derivative feedback while moving the closed-loop poles by hand. Audio plays through Web Audio; every algorithm runs client-side.",
  accentColor: "#06B6D4",
  favicon: "〰️",
  techStack: ["MATLAB (Live Scripts)", "Signal Processing Toolbox", "TypeScript", "Web Audio", "Canvas"],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#decrypt",
      title: "Decrypt the message — Lab 1",
      snippet:
        "An encrypted speech signal hides behind a magnitude/phase packing and a secret permutation. Undo each step and listen as noise reassembles into words.",
      keywords: ["audio decryption", "permutation", "magnitude phase", "randperm", "matlab"],
    },
    {
      path: "#echo",
      title: "Echo cancellation — Lab 2",
      snippet:
        "Find the echo's delay and strength in the autocorrelation, build the inverse IIR filter, and hear the room disappear. Push α past 1 and watch the poles cross the unit circle.",
      keywords: ["echo cancellation", "inverse filter", "autocorrelation", "pole zero", "stability"],
    },
    {
      path: "#deblur",
      title: "Image deblurring — Lab 3",
      snippet:
        "A moving-average blur written as a Toeplitz matrix, inverted with a pseudoinverse. Slide the blur length, deblur row by row, and see noise explode at the filter's nulls.",
      keywords: ["deblurring", "toeplitz", "pseudoinverse", "moving average", "frequency response"],
    },
    {
      path: "#aliasing",
      title: "Aliasing — Lab 4",
      snippet:
        "Drop the sampling rate on a sinusoid and hear the pitch fold at Nyquist; sweep a chirp and watch its spectrogram bounce.",
      keywords: ["aliasing", "undersampling", "nyquist", "chirp", "bandlimited interpolation"],
    },
    {
      path: "#cartpole",
      title: "Stick balancing — Lab 5",
      snippet:
        "An inverted pendulum on a cart, unstable open-loop. Drag the feedback gains, move the closed-loop poles into the left half-plane, and ride out a gust.",
      keywords: ["feedback", "stabilization", "cart pole", "inverted pendulum", "pole placement"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "signals and systems",
    "matlab",
    "echo cancellation",
    "deblurring",
    "aliasing",
    "cart pole",
    "inverse filter",
    "ece 101",
    "autocorrelation",
    "toeplitz",
    "sampling theorem",
    "feedback control",
    "pole placement",
    "web audio",
  ],
  knowledgePanel: {
    type: "Interactive demo",
    facts: {
      Course: "ECE 101 — Linear Systems Fundamentals (UC San Diego, winter 2025)",
      Labs: "5 of 5, all live in the browser",
      "Audio panels": "3 — decryption, echo cancellation, aliasing (Web Audio)",
      Text: "Computer Explorations in Signals and Systems (Buck, Daniel, Singer)",
      Ported: "MATLAB → TypeScript; FFT, IIR filters, SVD pseudoinverse, RK4 — tested against SciPy fixtures",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
