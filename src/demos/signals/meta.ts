import type { DemoMeta } from "@/lib/demos";

const S = "demos/signals_src";

const meta: DemoMeta = {
  slug: "signals",
  theme: { bg: "#edf6f7", panel: "#e1eef0" }, // pale oscilloscope cyan — it's a lab-bench page
  what: "all five ECE 101 MATLAB labs, ported to the browser as live instruments",
  why: "signals are meant to be heard and poked, not just plotted",
  when: "UC San Diego, winter 2025",
  story: [
    {
      title: "MATLAB as the lab bench",
      body:
        "ECE 101 ran on Computer Explorations in Signals and Systems (Buck, Daniel, Singer): five Live Script labs, each a small experiment. Everything on this page is that MATLAB, ported to TypeScript and running in your browser — same data, same algorithms, same answers.",
    },
    {
      title: "Lab 1 — arrays are the whole trick",
      body:
        "The encrypted message is one long vector: magnitudes and phases packed into a complex signal, halves interleaved, and the order scrambled by randperm seeded with 2023. Every decryption step is an array operation — the permutation is just indexing. The page regenerates the exact permutation by running MATLAB's Mersenne Twister in TypeScript.",
      anchor: "#decrypt",
    },
    {
      title: "Lab 2 — modeling a room",
      body:
        "One reflection off a far wall is y[n] = x[n] + α·x[n−N]. The echo's fingerprint sits in the autocorrelation — a side peak at lag N = 5000 (227 ms at 22.05 kHz), height ratio ≈ α = 0.9. Inverting the echo is a feedback loop with N poles on a circle of radius α^(1/N): stable while α < 1, and audibly not once you push α past the unit circle.",
      anchor: "#echo",
    },
    {
      title: "Lab 3 — convolution as a matrix",
      body:
        "A horizontal moving-average blur is a banded Toeplitz matrix multiplying each image row; deblurring is inverting that matrix. The lab's mystery image hid a robot whose vanity plate reads I ♥ ECE101 — recovered exactly at blur length N = 464, the only length whose inverse lands every pixel back in [0,1]. And inverses are fragile: the blur's frequency response has nulls, and anything living near them (noise, quantization) gets amplified without bound — the whole reason Wiener filters exist.",
      anchor: "#deblur",
    },
    {
      title: "Lab 4 — the sampling theorem, seen and heard",
      body:
        "Sampled at 8192 Hz, a tone climbs in pitch only until Nyquist at 4096 Hz — past it, the spectral copies fold back and the pitch comes down. A chirp makes it unmistakable: the sweep bounces off Nyquist in the spectrogram while your ear hears it rise and fall.",
      anchor: "#aliasing",
    },
    {
      title: "Lab 5 — feedback makes the unstable stable",
      body:
        "A stick on a cart has poles at ±√(g/L) ≈ ±3.13 — one in the right half-plane, so it falls. Proportional feedback alone only moves the poles to the imaginary axis (it oscillates forever); adding derivative feedback k₁ = −25.8, k₂ = −8 puts a double pole at s = −4 — critically damped, θ(t) = t·e^(−4t). This lab is the bridge from signals to controls.",
      anchor: "#cartpole",
    },
    {
      title: "Rebuilt for this page (2026-08-30)",
      body:
        "The Live Scripts were mined for David's code and answers; the DSP was reimplemented in TypeScript with AI coding tools and tested against SciPy fixtures. The lab never recorded the final blur length, so the trial-and-error hunt was rerun for this page — it found N = 464, and found why the lab's deblurred images always kept faint ghosts: deblur.m's one-argument toeplitz() builds a symmetric matrix, while the lab's blur equation is causal (lower-triangular). Solved causally, the image comes back exactly — the double-exposure left over is the self-balancing robot rocking during the photo. MATLAB's rng/randperm was also reproduced exactly (MT19937 + sort-by-rand) so the decryption uses the real seed, not shipped indices.",
    },
  ],
  sources: [
    { name: "lab1.m", path: `${S}/lab1.m`, lang: "matlab", note: "Lab 1 — decryption chain, decimate/interpolate, complex roses. David's code cells, extracted from Lab_1_F23.mlx." },
    { name: "lab2.m", path: `${S}/lab2.m`, lang: "matlab", note: "Lab 2 — echo system, inverse filter, autocorrelation estimates. Extracted from Lab_2_F23.mlx." },
    { name: "lab3.m", path: `${S}/lab3.m`, lang: "matlab", note: "Lab 3 — deblurring trials and recursive filters. Extracted from Lab_3_F23.mlx." },
    { name: "deblur.m", path: `${S}/deblur.m`, lang: "matlab", note: "David's deblurring helper: the Toeplitz system solved with pinv." },
    { name: "lab4.m", path: `${S}/lab4.m`, lang: "matlab", note: "Lab 4 — aliasing experiments and the course's ctfts helper. Extracted from Lab_4_F23.mlx." },
    { name: "lab5.m", path: `${S}/lab5.m`, lang: "matlab", note: "Lab 5 — stick balancing: pole placement and hand-rolled simulation. Extracted from Lab_5_F23.mlx." },
    { name: "mt19937.ts", path: "src/demos/signals/dsp/mt19937.ts", lang: "ts", note: "MATLAB's rng + randperm reproduced in TypeScript — the page regenerates the secret permutation from seed 2023." },
    { name: "fft.ts", path: "src/demos/signals/dsp/fft.ts", lang: "ts", note: "Shared radix-2 FFT and autocorrelation used across the panels." },
    { name: "decrypt model", path: "src/demos/signals/decrypt/model.ts", lang: "ts", note: "TS port of the Lab 1 decryption chain." },
    { name: "echo model", path: "src/demos/signals/echo/model.ts", lang: "ts", note: "TS port of the Lab 2 echo estimation and inverse IIR filter." },
    { name: "deblur model", path: "src/demos/signals/deblur/model.ts", lang: "ts", note: "TS port of deblur.m — Toeplitz build and pseudoinverse solve." },
    { name: "aliasing model", path: "src/demos/signals/aliasing/model.ts", lang: "ts", note: "TS port of the Lab 4 sampling, sinc reconstruction, and chirp." },
    { name: "cartpole model", path: "src/demos/signals/cartpole/model.ts", lang: "ts", note: "TS port of the Lab 5 cart-pole dynamics with RK4 integration." },
    { name: "prep script", path: "scripts/demos/signals_prep.py", lang: "python", note: "Build-time prep: decodes the .mat data into small committed assets and SciPy test fixtures." },
  ],
  sourceFooter:
    "Lab templates and data are course material from ECE 101 (UC San Diego), adapted from Computer Explorations in Signals and Systems (Buck, Daniel, Singer); code and answers are David's. Audio clips are short course-provided excerpts.",
};

export default meta;
