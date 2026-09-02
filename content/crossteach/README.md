# Cross-Teaching Segmentation: demo content

The `/demos/crossteach` page: the DTU 02456 Group 9 project (fall 2025), semi-supervised
segmentation where a U-Net and a Vision Transformer teach each other, shown through
David's 2026 Oxford-IIIT Pet redesign, whose real trained checkpoints and per-epoch
metrics are public on GitHub and drive everything on the page.

## What is on the page

1. **The pseudo-label exchange** (`#exchange`): 12 held-out Oxford-Pet test images, each
   with predictions from all four real checkpoints (supervised vs cross-taught U-Net and
   ViT). A confidence slider dims pixels below threshold on the real max-softmax maps;
   the image-level gate (mean confidence ≥ 0.75, the redesign's rule) shows per model.
   The "teach" animation replays the unlabeled step: confident predictions cross the
   224↔512 resolution gap as pseudo-labels.
2. **Training replay + two verdicts** (`#training`): the committed per-epoch curves:
   supervised U-Net and ViT baselines (8 epochs each) and the cross-teaching run, where
   warmup holds the exchange off for 2 epochs and the confident-image ratio then jumps to
   1.0. Final Oxford-Pet table (U-Net 0.852 / ViT 0.762 / Ensemble 0.852) beside the
   report's micro-CT numbers (supervised U-Net 0.49 → cross-taught 0.97; ViT 0.89 → 0.99)
   with 3 real slices + masks from the public Group 9 repo.
3. **U-Net vs ViT, inside** (`#architectures`): real encoder activations per ResNet-34
   stage from the shipped U-Net checkpoint; the image tiled into 196 patches with
   attention-rollout maps from the shipped ViT checkpoint (hover a patch); and
   `CrossDetection.py`, the Faster-R-CNN + ViT detection pair that was written but never
   run. It is explained and shown, not executed.
4. **The learning ladder** (`#ladder`): the course's notebook progression. Autodiff and
   the half-moon FFN train live in TypeScript; MNIST, CIFAR-10 CNNs, transfer, RNNs,
   autoencoders, VAEs and GANs are explained and visualized (the notebooks are
   output-stripped, so there are no archived runs to replay; nothing is invented).

## Honesty notes

- **Nothing is retrained.** All predictions, confidence maps, activations and attention
  rollouts were generated at build time by running the four checkpoints from
  `DavidBrin/Semi-supervised-image-model` (Git LFS) on CPU, through the repo's own eval
  code path (metrics formulas, logit-averaged ensembling, image-level gate).
- The exchange panel uses **held-out test images**; during training the exchange ran on
  the unlabeled 80% of the train split. Disclosed on the page.
- Training curves are the metrics JSONs committed next to the checkpoints. The repo also
  records a post-hoc re-evaluation (`cross_teaching_checkpoint_eval.json`) after a
  consistency-loss scaling fix, noting a full rerun was too slow on CPU; shipped as-is.
- The report-era micro-CT run used per-pixel confidence masks at 0.9 and weight 0.5 over
  30 epochs; the redesign uses an image-level gate at 0.75 and weight 0.05 over 8 epochs.
  The page keeps the two configurations distinct.
- Micro-CT slices and masks come from the public
  `DavidBrin/Semi-supervised-Microtomography-Segmentation` repo (22 labeled slices);
  masks are float-valued and are Otsu-binarized for display (pore fractions 9-13%).
- The TS ports (`src/demos/crossteach/core/metrics.ts` and the panel widgets) were
  written with AI coding tools (2026-09-01) and fixture-tested against the Python
  pipeline (`tests/crossteach-core.test.ts`).
- `CrossDetection.py` is shown as source only; the README's own words: "we never got to
  testing, training, or even proofreading this code."

## Building

`pnpm sync-demos crossteach` runs `scripts/demos/crossteach_prep.py` (`py -3.12`; torch,
timm, segmentation-models-pytorch, tensorflow-datasets, Pillow, scikit-learn) over the
two raw folders and the two GitHub clones under `.cache/crossteach/` (checkpoints via
Git LFS; Oxford-IIIT Pet via TFDS into `.cache/tfds`). Writes `public/demos/crossteach/`
plus `demos/crossteach_src/` (vendored repo sources + notebook extracts) and
`tests/fixtures/crossteach-core.json`. Outputs are committed; production builds need no
Python and no checkpoints.

## Attribution

Group project, 02456 Deep Learning, DTU, fall 2025. Group 9: Olfert Jan Mebius, David
Brin, Joey Bink, Thorsteinn Mar Hoskuldsson. The Oxford-Pet redesign repo
(`Semi-supervised-image-model`) is the group's continuation published by David (2026).
Course notebooks are DTU 02456 templates with David's solutions. Data: Oxford-IIIT Pet
(Parkhi et al., CC BY-SA 4.0) via TensorFlow Datasets. Cross-teaching method after Luo
et al., arXiv:2207.14191. U-Net weights via segmentation-models-pytorch; ViT-B/16 via
timm.
