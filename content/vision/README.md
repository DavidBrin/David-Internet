# Computer Vision: demo content

The `/demos/vision` page: David's CSE 152A homework (UC San Diego, winter 2025) running
live in TypeScript on the course's own images, in course order: light, geometry,
matching, then learning.

## What is on the page

1. **Photometric stereo & relighting** (`#stereo`): four photos of a face under known
   lights → per-pixel least squares (~24k systems, in a Web Worker) → normals + albedo →
   Horn-iteration depth → a draggable light that relights the recovered surface. A toggle
   compares the 3-image and 4-image solves (the homework's 1(b)/1(c)).
2. **Epipolar geometry, corners, matching** (`#epipolar`): the normalized 8-point
   algorithm on the dino pair's 13 correspondences; click either view and the epipolar
   line lands on the other. Corner detector with live sliders; SSD-vs-NCC race along the
   epipolar line with a brightness-shift toggle that breaks SSD.
3. **Bag-of-words faces** (`#bow`): the real 100-word visual vocabulary (rebuilt at
   build time from the course's face set with the notebook's own pipeline), the pipeline
   strip, and the archived accuracy table. Bayes spam mini-card with a prior slider.
4. **CNN & transfer curves** (`#cnn`): FashionMNIST results by optimizer/dropout, the
   learning-rate figures, and STL-10 transfer curves. All numbers extracted from the
   archived winter-2025 run; nothing retrained.

## Honesty notes

- The original photometric-stereo input pickle (`data.pickle`) was not archived. The
  four input images are **re-rendered at build** from the course's `facedata.npy`
  (albedo + heightmap) using David's own HW1 `lambertian()` under the four original
  light directions recovered from the notebook's printed output. Disclosed on the page.
- The TS ports (stereo solver, Horn integration, Jacobi-SVD 8-point, David's Sobel
  corner detector (`convolve2d mode="full"` quirk included), SSD/NCC) were written with
  AI coding tools (2026-09-01) and are fixture-tested against the NumPy solutions
  (`tests/vision-core.test.ts`); the dino fundamental matrix matches the notebook's
  printed value to ~4e-12.
- CNN "curves" are the archived run's stream outputs and stored figures; the page never
  claims a re-run.
- The `BatchGradientDescentFromScratch` notebook is excluded from scope (decided
  2026-08-30).
- The CSE 152B deeper networks (SuperPoint/MagicPoint, the metric-learning
  triplet-loss CNN) are referenced in the story and shown as a Source-drawer extract
  (`demos/vision_src/hw152b_extract.py`), not run: the vendored pytorch-superpoint repo
  and its weights lived on the course GPU cluster and were never archived.

## Building

`pnpm sync-demos vision` runs `scripts/demos/vision_prep.py` (`py -3.12`; numpy, scipy,
opencv-python, scikit-learn, Pillow) over `demos/computer_vision_cse152_raw/` and writes
`public/demos/vision/` (face renders, downscaled image pairs + correspondences, BoW
vocabulary sprite + results, CNN curves, 26 curated notebook figures) plus
`tests/fixtures/vision-*.json`. Outputs are committed; production builds need no Python.

## Attribution

Course materials (assignment templates, `facedata.npy`, the dino/matrix/warrior image
pairs, the face/non-face dataset) are from UCSD CSE 152A/B (winter–spring 2025);
solutions are David's. The multi-view pairs are standard CV datasets distributed with
the course.
