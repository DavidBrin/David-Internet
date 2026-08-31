# Signals & Systems Lab — demo page

Live at [/demos/signals](/demos/signals). This page is a demo built inside David's Internet, not a vendored project: the archive it was made from lives in `demos/signals_systems_matlab_raw/` (the five ECE 101 Live Scripts and their `.mat` data), David's extracted code in `demos/signals_src/`, and the build script in `scripts/demos/signals.ts` + `signals_prep.py`.

## What is on the page

All five ECE 101 (UC San Diego, winter 2025) MATLAB labs from *Computer Explorations in Signals and Systems* (Buck, Daniel, Singer), ported to TypeScript and running client-side:

**Lab 1 — Decrypt the message.** The course's encrypted speech signal (`Lab_1_F23.mat`, 248 304 samples at 44.1 kHz) undone step by step: magnitude/phase unpacking, re-joining split halves, and inverting a secret permutation. The permutation is regenerated in the browser from seed 2023 with a TypeScript MT19937 — MATLAB's `rng(2023); randperm(N)` is argsort-of-rand over the same Mersenne Twister double stream, verified against NumPy. The recognizable message is the *flipped* signal, exactly as the lab intends.

**Lab 2 — Echo cancellation.** The course's echoed voice clip (`echo_F23.mat`, 22.05 kHz). The autocorrelation's side peak sits at exactly lag 5000 (227 ms); the height ratio α/(1+α²) caps at 0.5 and the measured 0.5021 (a quantization edge case) is clamped. The inverse IIR filter `1/(1+αz^-N)` recovers the voice; pushing α past 1 walks the N poles across the unit circle and the panel auto-mutes as the output diverges.

**Lab 3 — Image deblurring.** The lab's mystery image (`Lab3_F23.mat`) hid a self-balancing robot with a California vanity plate "I ♥ ECE101" (AUG 2024). The lab never recorded the answer, so the trial-and-error hunt was rerun for this page: the blur is the lab equation's *causal* length-N moving average and **N = 464** — the unique length whose triangular solve puts every pixel back in [0, 1] (out-of-range fraction exactly 0; ≥0.002 at N±1). The page ships the recovered plate crop and lets you re-blur/deblur it live, with the Toeplitz band, the blur's frequency-response nulls, and a noise toggle showing why naive inverses are fragile.

**Lab 4 — Aliasing.** Generated on the page: a sinusoid sampled at 8192 Hz, undersampled by M with bandlimited (sinc) reconstruction — hear the pitch fold at Nyquist; and the lab's chirp whose spectrogram bounces off Nyquist while you listen.

**Lab 5 — Stick balancing.** The cart-pole from Buck §11.1, integrated live (RK4, linearized or nonlinear). Open loop falls (poles ±√9.8); proportional feedback only reaches the imaginary axis; David's PD gains k₁ = −25.8, k₂ = −8 place a double pole at −4 (θ(t) = t·e^(−4t)). Drag the gains, watch the s-plane, ride out a gust.

## What was completed or fixed

- The DSP was reimplemented in TypeScript with AI coding tools (2026-08-30) and every port is tested against SciPy/NumPy fixtures generated at prep time (`tests/fixtures/signals-lab*.json`, `tests/signals-*.test.ts`).
- The Lab 3 blur length was not recorded in the Live Script (David's last trials were 375/450/550); the search was rerun and pinned N = 464. It also surfaced why the lab's own reconstructions kept faint ghosts: `deblur.m` uses MATLAB's one-argument `toeplitz()`, which builds a *symmetric* matrix, while the lab's blur equation is causal (lower-triangular). Solved causally the image returns exactly — the remaining double exposure is the self-balancing robot rocking during the photo.
- MATLAB's `rng`/`randperm` was reproduced exactly (MT19937 + sort-by-rand) rather than shipping half a megabyte of permutation indices.

## Building

```
pnpm sync-demos signals    # needs py -3.12 with numpy/scipy/Pillow
pnpm test                  # includes the fixture tests for all five TS ports
```

Outputs are committed (`public/demos/signals/`: two Lab 1 bins, the Lab 2 clip, the Lab 3 crop — ~760 KB total), so the site builds without Python.

## Attribution

Lab templates and data are course material from ECE 101 (UC San Diego), adapted from *Computer Explorations in Signals and Systems* (Buck, Daniel, Singer, Prentice Hall); code and answers are David's. Audio clips are short course-provided excerpts.
