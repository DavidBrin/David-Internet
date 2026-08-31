# 13 — Signals & Systems (ECE 101, winter 2025)

Slug: `signals` · Fake domain: `signals.davids.net` · Archetype: **A** (five live simulations, audio + image) + Story rail
Status: spec agreed 2026-08-30; **built 2026-08-30** - all five labs live; Lab 3 blur pinned N=464 (causal, not deblur.m's symmetric toeplitz); MATLAB rng/randperm reproduced in TS (MT19937 + sort-by-rand, seed 2023); alpha-ratio clamp for Lab 2 (raw ratio 0.5021 > 0.5 cap); 192-test suite incl. SciPy fixtures for all five ports.

## Summary

All five ECE 101 MATLAB labs, ported to the browser as things you can hear, see, and
poke: unscramble an encrypted audio message, cancel an echo with an inverse filter,
deblur an image with a Toeplitz system, watch a sinusoid and a chirp alias as you drop
the sampling rate, and balance a stick on a cart with feedback. A search of the machine
(2026-08-30) found no other signals coursework — these five are the complete set
(`OneDrive/Documents/UCSD classes/ECE 101/` holds only these labs plus exam PDFs and the
textbook).

## Source material

`demos/signals_systems_matlab_raw/` (Live Scripts read via their `document.xml`):

| Lab | What it does (from the `.mlx`) | Data | Panel |
|---|---|---|---|
| `Lab_1_F23.mlx` — Deciphering an audio message | `X` is a complex vector: real = magnitude, imag = phase of `W`, whose real/imag halves are the first/second half of a **permuted** speech signal `Z = Y(perm)`; undo magnitude/phase → concatenate → inverse permutation with the secret seed → play | `Lab_1_F23.mat` (X, Fs; 1.9 MB) | 1 |
| `Lab_2_F23.mlx` — Echo cancellation via inverse filtering (Buck §2.10) | `y[n] = x[n] + α x[n−N]`; find N and α (autocorrelation), build the inverse IIR filter `1/(1+αz^−N)`, recover x; stability discussion | `echo_F23.mat` (y, Fs = 22050; 432 KB) | 2 |
| `Lab_3_F23.mlx` — DT filters: non-recursive (image deblurring) & recursive | Blur = horizontal moving average of length X as a Toeplitz matrix `H`; `freqz` of the blur; deblur with `pinv` (`deblur.m`: `N = Y * pinv(H')`); recursive-filter part | `Lab3_F23.mat` (34 MB — image(s); a small crop ships) | 3 |
| `Lab_4_F23.mlx` — Aliasing due to undersampling (Buck §7.1) | Sample `sin(Ω₀t)` at 8192 Hz, then undersample; bandlimited (sinc) interpolation; the same with a **chirp**; CTFT ↔ DTFT ↔ DTFS relationships | Generated | 4 |
| `Lab_5_F23.mlx` (+ `Lab_5_F23.pdf`) — Feedback stabilization: stick balancing (Buck §11.1) | Cart-pole `L θ̈ = g sin θ − a cos θ + L x`; linearize; unstable open loop; proportional + derivative feedback `a = K₁θ + K₂θ̇`; pole placement; simulate with disturbance `x(t)` | Generated | 5 |

`deblur.m` is David's helper; the labs are course-authored templates (Buck/Daniel/Singer
*Computer Explorations*) with David's code and answers. Textbook not shipped.

## Stage — five panels, each a small instrument

### 1. Decrypt the message (audio)
- The scrambled signal shown as magnitude/phase strips; buttons apply each inverse step
  in order — **un-pack magnitude/phase → re-form W → un-split halves → un-permute**
  (permutation indices shipped, seed shown) — the waveform re-assembles piece by piece
  and a "play" button plays the current state through Web Audio (noise → speech).
- Asset: `Lab_1_F23.mat` decoded at build to 16-bit mono at the original Fs, trimmed to
  the message (≤ 300 KB) + `perm.json`.

### 2. Echo cancellation (audio)
- Play the echoed clip; the **autocorrelation** plot draws in and its side-peak marks N
  (the lag), α from the peak ratio — both draggable to show what a wrong estimate
  sounds like.
- The inverse filter's block diagram (feedback delay line `z^−N`, gain −α) animates
  samples flowing through; **pole-zero plot** shows the N poles on a circle of radius
  α^(1/N) → stable while α < 1 (slider α past 1 → poles cross the unit circle, output
  blows up, audio auto-mutes).
- A/B: echoed vs recovered, waveform + spectrogram.

### 3. Image deblurring
- A small grayscale crop from `Lab3_F23.mat` (shipped ≤ 100 KB) blurred with a length-X
  moving average; X slider. The **Toeplitz matrix** is drawn as a banded strip; the
  blur's **frequency response** (`freqz`) plots with its nulls; "deblur" solves the
  system (pinv via SVD in TS, per-row) and the image sharpens row by row — and a noise
  toggle shows the inverse blowing up near the nulls (why Wiener exists; one line).
- Recursive-filter mini: the lab's IIR part as an impulse-response animation.

### 4. Aliasing
- Sinusoid at Ω₀ (slider 100 Hz–4 kHz) sampled at 8192 Hz then **undersampled** by a
  factor M (slider): stem plot + bandlimited reconstruction overlay; the DTFT axis shows
  the spectral copies folding; audio plays the original vs reconstructed tone.
- **Chirp** mode: the reconstructed chirp's spectrogram shows the "bounce" at Nyquist as
  the sweep aliases; play it.

### 5. Stick balancing (cart-pole)
- Side-view cart + stick (SVG) integrated live (RK4, the linearized model with the
  nonlinear one as a toggle). Open loop: it falls. Sliders **K₁, K₂** move the
  closed-loop poles on an s-plane plot; the stick stabilizes once both poles are in the
  left half-plane; a "gust" button applies the disturbance `x(t)`; response overshoot /
  settling time read out. Matches the lab's pole-placement values as a preset.

## Story rail

1. ECE 101 and *Computer Explorations*: MATLAB as the lab bench.
2. Lab 1: arrays as the whole trick (a permutation is a signal operation).
3. Lab 2: modeling a room as `x + αx[n−N]`; inverting it; stability.
4. Lab 3: convolution as a matrix; why inverses are fragile.
5. Lab 4: sampling theorem, seen and heard.
6. Lab 5: feedback turns an unstable system stable — the bridge to controls.

## Assets (`public/demos/signals/`)

- `lab1/message.wav`-equivalent (encoded as 16-bit PCM in a `.bin` + JSON header) +
  `perm.json`; `lab2/echo.bin`; `lab3/crop.png`; nothing for labs 4–5 (generated).
- Build script (Python, `scipy.io.loadmat`; `h5py` if v7.3): decode `.mat` → small
  binaries; extract the `.mlx` text + David's code cells → drawer HTML.

## Tech

- TS: FFT (radix-2), autocorrelation, IIR filtering, Toeplitz/SVD (small), sinc
  interpolation, RK4; Web Audio for playback (user-gesture gated); canvas plots.
- Tests: echo recovery SNR vs. the MATLAB result on the shipped clip; deblur equals
  `pinv` solution within tolerance on the crop.

## Manifest (`content/signals/site.ts`)

- displayName "Signals & Systems Lab", favicon "〰️", accent `#06B6D4`.
- deepLinks: `/demos/signals#decrypt`, `#echo`, `#deblur`, `#aliasing`, `#cartpole`.
- techStack: MATLAB (Live Scripts), Signal Processing Toolbox, TypeScript, Web Audio.
- knowledgePanel facts: Course · Labs (5, all live) · Audio panels (3) · Text
  (*Computer Explorations in Signals and Systems*).
- keywords: signals and systems, matlab, echo cancellation, deblurring, aliasing, cart
  pole, inverse filter, ece 101.

## Attribution

- Lab templates from the course / Buck–Daniel–Singer; code and answers David's. One
  footer line. Audio clips are course-provided data (short excerpts).

## Out of scope

- Running MATLAB; the textbook; exam PDFs.

## Open questions

None.
