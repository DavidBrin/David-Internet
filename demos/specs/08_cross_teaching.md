# 08 — Cross-Teaching: Two Models Teaching Each Other (DTU 02456 Deep Learning, fall 2025)

Slug: `crossteach` · Fake domain: `crossteach.davids.net` · Archetype: **A** (precomputed interactive) + Story rail + Learning ladder
Status: spec agreed 2026-08-29; **not built**.

## Summary

The semi-supervised method from the Group 9 final project, shown on real images: a U-Net
and a ViT predict the same picture, a confidence threshold masks the unreliable pixels,
and the two models swap pseudo-labels. Scrub through training epochs to watch masks
sharpen and Dice curves separate (supervised-only vs cross-taught). An explainer contrasts
the two architectures with hover-able attention maps, and a "learning ladder" strip
replays the course's notebook progression with tiny live widgets.

Two data tracks: the public **Oxford-IIIT Pet** re-implementation (in the raw folder;
runs at build time) is the default; **2–3 micro-CT slices + masks from the report's
dataset** are added when cleared (hook in the code; see Open questions). No neural network
runs in the browser — every prediction, confidence map, and attention map is precomputed
at build and shipped as small images.

## Source material

`demos/cross_teaching_segmentation_raw/`:

| File | Role | Notes |
|---|---|---|
| `CrossTeachingTraining.py` (`ViTSegmentationHead`, `ViTSegmentation`, `CrossTeachingTrainer`: `get_confidence_mask` @ 0.9, `train_step_labeled`, unlabeled consistency step w/ weight 0.5) | The method; build-time script generates the demo assets | David's/group code (Oxford-Pet redesign) |
| `Unet_TransferLearn.py` (ResNet-34 encoder, frozen), `ViT_train.py` (ViT-B/16 + transposed-conv decoder), `data_oxford_pet.py` (TFDS, `DATA_SEED`, trimap 3 classes), `comparison_utils.py`, `plotting.py`, `Segmentation_Models_Comparison.ipynb` | Baselines + comparison | Runs at build (GPU optional; CPU OK for the small asset set) |
| `usage.md`, `ProgressTracker.md`, `requirements.txt` | Story beats (the TFDS migration; the unfinished object-detection to-do) | — |
| `Project_21_Group_9.pdf` (report: micro-CT, 22 labeled / 172 unlabeled, U-Net cross-teaching Dice 0.97, ViT underperforms) | Story + results tab + PDF link | Group 9: Olfert Jan Mebius, David Brin, Joey Bink, Thorsteinn Mar Hoskuldsson |
| `30epoch.png` | Reference for the training-replay look | — |
| `2207.14191v2.pdf` | Not shipped (reference paper) | Third-party |

`demos/dtu_deep_learning_notebooks_raw/` (learning ladder): `3.2 Automatic differentiation`,
`3.3 FFN Half Moon`, `3.4 FFN MNIST`, `4.1–4.3 CNN` (intro, CIFAR-10, transfer),
`5.1 RNN`, `7.1 autoencoder`, `7.2 VAE`, `7.3 GAN`; `ArXiv_histogram.py`; diagrams
(`Attention in RNN.png`, `Dot-prod-components.png`, `Transformer Layer.png`). Course
templates with David's solutions — shown as a progression, not claimed as original.

## Stage

### 1. The exchange (core method)
- Image picker (≈ 16 pet test images; micro-CT slices when available). Three columns:
  **input**, **U-Net prediction**, **ViT prediction** (trimap colors), with ground truth
  toggle.
- **Confidence-threshold slider** (default 0.9): pixels whose max-softmax < τ dim out on
  each prediction; coverage % updates ("ViT keeps 71 % of pixels at 0.9").
- **Exchange animation:** press "teach" — the ViT's confident mask floats across and
  upsamples (224→512) onto the U-Net's panel as its pseudo-label; the U-Net's floats
  back and downsamples (512→224) for the ViT; the consistency-loss meter (weight 0.5)
  fills; the supervised-loss meter shows only when the image is in the labeled subset.
- "Labeled / unlabeled" badge per image mirrors `unlabeled_fraction`.

### 2. Training replay + Dice
- Epoch scrubber (1 → 30): predictions for the selected image morph frame-to-frame
  (precomputed per checkpoint every 2–3 epochs); Dice curves draw in for **supervised
  U-Net**, **supervised ViT**, **cross-taught U-Net**, **cross-taught ViT** on the pet
  validation split.
- Results tab **"micro-CT (report)"**: the report's table (Dice 0.97 for cross-taught
  U-Net vs its supervised baseline; ViT's limited benefit), one sentence on why, link to
  PDF. Switches to real slices if/when cleared.

### 3. U-Net vs ViT explainer
- Left: U-Net drawn as encoder–decoder with skip connections; hover a level → its
  feature-map resolution highlights on the image (precomputed activations as small
  heatmaps).
- Right: ViT — the image tiles into 16×16 patches (animated), patch embeddings + CLS
  token flow into the transformer stack; **hover a patch → attention rollout map**
  (precomputed per image, 196 small PNG/WebP tiles or one sprite).
- Bottom line: locality vs global context, and why cross-teaching pairs them.

### 4. Learning ladder (course notebooks)
- A horizontal strip, one card per notebook in course order. Live where cheap:
  - **Autodiff:** a tiny expression graph; drag inputs, gradients propagate backward
    (TS).
  - **FFN half-moon:** a 2-8-8-1 net trains live in TS on the half-moon set; decision
    boundary animates over ~200 steps.
  - **FFN MNIST / CNN CIFAR-10 / transfer:** precomputed accuracy curves + a few sample
    predictions; CNN card shows filter activations for one image.
  - **RNN:** character-level sequence stepping through the unrolled cells (animation).
  - **Autoencoder / VAE:** 2-D latent grid slider → decoded digit (precomputed 20×20
    grid sprite); **GAN:** sample reel over epochs.
- Each card links its notebook in the drawer; header says "course notebooks with my
  solutions".

## Story rail

1. DTU 02456; the group; the micro-CT problem (few annotated slices).
2. Cross-teaching in two sentences; the 0.9 threshold and the 0.5 consistency weight.
3. What happened: U-Net benefits greatly, ViT doesn't — and a guess why (report §5).
4. The re-design on Oxford-IIIT Pet so anyone can reproduce it (`usage.md`), and the
   object-detection to-do that never happened (`ProgressTracker.md`) — completed as a
   **stretch**: a `head_bbox` regression head demo card if build time allows (see Open
   questions).
5. The course ladder that led here.

## Build pipeline (`scripts/build-crossteach.py`, run once; outputs committed)

- Train U-Net, ViT, and cross-teaching per `usage.md` (or load existing checkpoints if
  David still has `checkpoints/`), saving a checkpoint every 2–3 epochs.
- For 16 fixed test images: input (256 px WebP), GT, per-checkpoint predictions and
  max-softmax confidence (8-bit PNG), U-Net level activations (4 heatmaps), ViT attention
  rollout per patch (sprite). Target ≤ 6 MB total for the page.
- Dice curves → `curves.json`. Learning-ladder assets → `ladder/*.json|webp`.

## Source drawer

- Tabs: `CrossTeachingTraining.py`, `Unet_TransferLearn.py`, `ViT_train.py`,
  `data_oxford_pet.py`, the build script, `ladder/` TS widgets.
- Footer: Group 9 members; course notebooks are DTU 02456 templates with David's
  solutions; U-Net/ViT weights via `segmentation-models-pytorch` / `timm`.

## Manifest (`content/crossteach/site.ts`)

- displayName "Cross-Teaching Segmentation", favicon "🐾", accent `#14B8A6`.
- deepLinks: `/demos/crossteach#exchange`, `#training`, `#architectures`, `#ladder`.
- techStack: PyTorch, segmentation-models-pytorch, timm (ViT-B/16), TensorFlow Datasets,
  Oxford-IIIT Pet.
- knowledgePanel facts: Course · Group (4) · Method (cross-teaching U-Net ⇄ ViT, τ = 0.9)
  · Result (micro-CT Dice 0.97) · Public re-run (Oxford-IIIT Pet).
- keywords: cross-teaching, semi-supervised segmentation, u-net, vision transformer,
  pseudo-labels, dtu, deep learning, micro-CT.

## Attribution

- Group project (four names, from the report). Course notebooks labeled as such.
- Micro-CT images only if cleared by the data owner; otherwise numbers + PDF only.

## Out of scope

- In-browser inference (ONNX Runtime Web) — ViT-B is ~350 MB; not worth it.
- Training in the browser beyond the toy half-moon net.

## Resolved questions (2026-08-30)

1. **Checkpoints:** not on this machine and not in David's public GitHub repos → the build
   script retrains (small, CPU-tolerant config) — David: "if the checkpoints aren't on this
   machine or in another github repo then I don't have them." (Build to verify both
   places before retraining.)
2. Micro-CT: slices still to be cleared; drop into
   `cross_teaching_segmentation_raw/microct/` (image + mask pairs); the build picks them
   up automatically.
3. `head_bbox` stretch: skip unless time allows at the end.
