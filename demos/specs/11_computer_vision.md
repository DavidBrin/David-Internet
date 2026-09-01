# 11 — Computer Vision (CSE 152A/B, winter 2025)

Slug: `vision` · Fake domain: `vision.davids.net` · Archetype: **A** (live classical CV in TS) + precomputed learning panels
Status: spec agreed 2026-08-30; **built 2026-09-01**. CORRECTIONS found at build time:
`facedata.npy` holds {albedo, uniform_albedo, heightmap, 2 rendering lights} - NOT the
four stereo input images + light directions (that `data.pickle` was never archived).
The four inputs are re-rendered at build from facedata with David's own `lambertian()`
under the four original light directions recovered from the notebook's printed output
(disclosed on the page). HW4 curves were NOT re-run (a CPU re-run is hours, not
"minutes") - all numbers extracted from the archived run's stream outputs and figures.
David's `corner_detect` uses convolve2d mode="full" (minor-eig image = input + 2 px);
the TS port reproduces the quirk and is fixture-tested. Dino F matches the notebook's
printed value to ~4e-12.

## Summary

Classical computer vision that runs live in the browser on the course's own tiny inputs:
reconstruct a face from four lit photos and relight it; click a point on one dino photo
and watch its epipolar line land on the other; tune Harris corners; race SSD against NCC
matching. Then two precomputed learning panels — bag-of-words face classification and
the FashionMNIST CNN/transfer curves. (The gradient-descent notebook is left out — decided
2026-08-30.)

## Source material

`demos/computer_vision_cse152_raw/`:

| File | Panel | Notes |
|---|---|---|
| `hw1_photometric_stereo/cse152a_wi25_hw1.ipynb` (72 cells, 18 figs), `facedata.npy`, `Problem1 example.png` | 1 — photometric stereo, albedo map, 3-D surface (2-D/3-D plots) | Course template + David's solutions; `facedata.npy` is course data (4 images + light directions) |
| `hw2_epipolar_geometry/hw2_wi25.ipynb` (37 cells, 14 figs), `figs/{dinoEpi1,dinoEpi2,eightpoint,p2_1_figure,ec_diagram}.png`, `imgs/` (dino, matrix, warrior pairs) | 2 — edge/corner detection, epipolar constraint, essential matrix, SSD/NCC matching, naive matching | Course images (dino/warrior/matrix are standard CV pairs) |
| `hw3_face_detection/cse152a_wi25_hw3.ipynb`, `images/face/*.jpg` (+ `ground_truth_locations.mat`), `images/nonface/*.jpg` (200 images) | 3 — bag-of-words: interest points → features → visual vocabulary → histograms → k-NN; Bayesian estimation (email spam table) | Course dataset |
| `hw4_cnn_fashionmnist_stl10/cse152a_wi25_hw4.ipynb` (43 cells, 14 figs) | 4 — backprop by hand, small CNN on FashionMNIST, learning-rate study, transfer learning (labels 0-4 → 5-9) | Precomputed curves only |
| `cse152b_superpoint/HW1.ipynb` + `README.md` | Story beat only (SuperPoint/MagicPoint, SIFT/Harris repeatability) | The vendored pytorch-superpoint repo is not included |
| `cse152a_discussion_week9.ipynb` | Not shown | TA material |
| `HW1–4.pdf` | Drawer links | Rendered notebooks |
| `BatchGradientDescentFromScratch.ipynb`, `feature_target.csv` | **Excluded** | Contains informal profanity; dropped from scope by David |

## Stage

### 1. Photometric stereo + relighting
- The four face images from `facedata.npy` (shipped as 4 small PNGs + the light
  directions JSON). Click "solve": per-pixel least squares `N = pinv(L)·I` runs in TS
  (a Web Worker for the ~100k pixels), the **normal map** fades in (RGB-encoded), then the
  **albedo** map, then the depth is integrated (Frankot–Chellappa or simple row/column
  integration, as the homework did) into a **3-D surface** rendered with three.js (or a
  2.5-D canvas heightmap with shading — cheaper; decide at build).
- **Relighting knob:** drag a light direction on a hemisphere widget → the surface is
  re-shaded live from the recovered normals and albedo (`I = albedo · max(0, N·L)`), which
  is the homework's "image rendering" problem in reverse.
- Toggle: use images {1,2,4} vs all four (the 1(b)/1(c) comparison) to see the
  reconstruction improve.

### 2. Epipolar geometry, corners, matching
- **Corners:** Harris on the dino image with sliders for window size / k / threshold;
  corners bloom in as small crosses; count shown. Edge map toggle (Sobel + NMS).
- **Epipolar lines:** the two dino views side by side; the fundamental matrix from the
  **8-point algorithm** computed live in TS from the notebook's correspondences
  (normalized 8-point; SVD in TS). Click anywhere on the left image → the epipolar line
  draws across the right image (animated sweep); the epipoles are marked; the essential
  matrix is shown when intrinsics are known (from the notebook).
- **SSD vs NCC race:** pick a patch on the left; both matchers scan the right image along
  the epipolar line (a moving window animates), score curves draw underneath, and the
  best match snaps in — NCC visibly wins under a brightness-change toggle.

### 3. Bag-of-words faces (precomputed)
- The pipeline as a strip: interest points on a sample face → descriptors → k-means
  vocabulary (visual words as tiny patches) → histogram → k-NN. Scrub **K** and the
  vocabulary size: accuracy updates from a precomputed table (the notebook's
  "K = 5 ..." result). Confusion examples: the misclassified images.
- Bayesian-estimation mini-card: the spam/length table with a slider for the prior.

### 4. CNN curves (precomputed)
- FashionMNIST small CNN: loss/accuracy per epoch for the learning rates tried;
  transfer learning: train on labels 0–4, fine-tune on 5–9 — curves with/without
  frozen features; 3 random images per label as the notebook plotted. All from a
  build-time re-run of the notebook (CPU, minutes).

## Story rail

1. CSE 152A: the classical half — light, geometry, matching — before learning.
2. Photometric stereo: three photos are enough for normals; four for robustness.
3. Epipolar geometry: what the 8-point algorithm recovers and why normalization matters.
4. Bag of words as the bridge to learning; k-NN as the simplest classifier.
5. CNNs + transfer; the learning-rate lesson.
6. 152B: SuperPoint/MagicPoint and repeatability — one paragraph, no demo.

## Assets (`public/demos/vision/`)

- `face/{im1..4}.png` + `lights.json` (≈ 100 KB); `dino/{1,2}.jpg` (≤ 60 KB each) +
  `correspondences.json`; `bow/{samples}.webp` + `bow_results.json`;
  `cnn/curves.json` + `cnn/samples.webp`.

## Tech

- TS: small linear algebra (SVD via one-sided Jacobi, pinv), Harris/Sobel on
  `ImageData`, NCC/SSD windows, Frankot–Chellappa via a tiny FFT (or the notebook's
  integration); Workers for the pixel loops.
- Tests: TS 8-point F vs. the notebook's F on the same correspondences (up to scale);
  normals vs. NumPy on a 10×10 crop.

## Manifest (`content/vision/site.ts`)

- displayName "Computer Vision", favicon "👁️", accent `#22C55E`.
- deepLinks: `/demos/vision#stereo`, `#epipolar`, `#bow`, `#cnn`.
- techStack: Python, NumPy, OpenCV, PyTorch, TypeScript, three.js.
- knowledgePanel facts: Course · Topics (photometric stereo, epipolar geometry, feature
  matching, BoW, CNNs) · Live in-browser (3 panels).
- keywords: computer vision, photometric stereo, epipolar, fundamental matrix, harris
  corners, ncc, bag of words, cnn, cse152.

## Attribution

- Course templates and data (facedata, dino/warrior/matrix pairs, face/nonface set);
  solutions are David's. One footer line.

## Out of scope

- Gradient-descent notebook (dropped), SuperPoint inference, STL-10.

## Open questions

None.
