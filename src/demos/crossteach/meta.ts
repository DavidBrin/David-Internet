import type { DemoMeta } from "@/lib/demos";

const SRC = "demos/crossteach_src";

const meta: DemoMeta = {
  slug: "crossteach",
  theme: { bg: "#edf6f4", panel: "#dff0ec" }, // teal - two models across a table
  what: "two networks teaching each other to segment: real checkpoints, real curves, real pseudo-labels",
  why: "when labeled images are scarce, a U-Net and a ViT can grade each other's homework",
  when: "DTU 02456 Deep Learning, Group 9, fall 2025 + David's 2026 Oxford-Pet redesign",
  story: [
    {
      title: "22 labeled slices",
      body:
        "The Group 9 project segments pores in X-ray micro-tomography (22 nm resolution) with only 22 annotated slices against 172 unlabeled ones. Supervised training starves at that scale: the stand-alone U-Net managed Dice 0.49. The fix was semi-supervision: let the unlabeled 88% of the data contribute through pseudo-labels.",
      anchor: "#training",
    },
    {
      title: "Cross-teaching in two sentences",
      body:
        "A U-Net (ResNet-34 encoder, 512x512, local convolutional bias) and a ViT (ViT-B/16, 224x224, global attention) both predict each unlabeled image; each model's confident prediction becomes the other's training target, resampled across the resolution gap (224 up to 512, 512 down to 224). In the report-era run, pixels above 0.9 max-softmax counted as confident and the consistency loss carried weight 0.5; on micro-CT this took the U-Net from Dice 0.49 to 0.97 and the ViT from 0.89 to 0.99.",
      anchor: "#exchange",
    },
    {
      title: "The public redesign",
      body:
        "The micro-CT dataset can't be redistributed at scale, so David rebuilt the pipeline on Oxford-IIIT Pet (3-class trimap via TensorFlow Datasets) with stricter bookkeeping: both baselines and cross-teaching see the same labeled 20% of the train split, the confidence gate became image-level (mean max-softmax >= 0.75), the consistency weight dropped to 0.05 after a scaling fix, warmup holds the exchange off for 2 epochs, and one epoch means one pass over the labeled loader for every method. The trained checkpoints and per-epoch metrics are committed to the GitHub repo; this page runs those exact checkpoints.",
      anchor: "#exchange",
    },
    {
      title: "The honest second verdict",
      body:
        "With 590 labeled pets and ImageNet-pretrained encoders, the supervised U-Net already reaches Dice 0.852 - and cross-teaching's ensemble lands at 0.852 too. David's own README says it plainly: with the baseline this high, cross-teaching can't be called better here; its value is that it trains on images no human ever labeled. Two datasets, two verdicts: transformative at 22 labels, a wash at 590.",
      anchor: "#training",
    },
    {
      title: "Local filters vs global attention",
      body:
        "Why pair these two architectures? The U-Net's convolutions see textures through a growing receptive field; the ViT chops the image into 196 patches and lets every patch attend to every other from layer one. The explainer below shows both on real data: encoder activations from the shipped U-Net checkpoint, and attention rollout maps from the shipped ViT; hover a patch to see where it looks.",
      anchor: "#architectures",
    },
    {
      title: "The detector that never ran",
      body:
        "The repo also holds CrossDetection.py: cross-teaching rebuilt for object detection: a Faster R-CNN (ResNet-50 FPN backbone) exchanging pseudo-boxes with a ViT detection head over the 37 pet breeds. It was written while the segmentation models were training and, in the README's words, never tested, trained, or even proofread. It's in the Source drawer as a read: a deeper pair of networks the project pointed at but never got to run, mentioned here for exactly that reason.",
      anchor: "#architectures",
    },
    {
      title: "The ladder that led here",
      body:
        "02456 climbs to cross-teaching through weekly notebooks: autodiff by hand, a feed-forward net on the half-moon set, MNIST, CNNs on CIFAR-10, transfer learning, RNNs, then autoencoders, VAEs and GANs. The strip below replays that progression: the autodiff graph and the half-moon net run live in TypeScript; the deeper models are explained and visualized rather than re-trained, with David's solution notebooks in the Source drawer.",
      anchor: "#ladder",
    },
    {
      title: "Rebuilt for this page (2026-09-01)",
      body:
        "Every prediction, confidence map, activation and attention map here was generated at build time by running the repo's four real checkpoints (Git LFS) on 12 held-out test images with the repo's own eval code path; nothing was retrained. Training curves are the metrics JSONs committed next to the checkpoints; micro-CT slices come from the public Group 9 repo. The TS widgets and metric ports were written with AI coding tools and are fixture-tested against the Python pipeline's numbers.",
    },
  ],
  sources: [
    { name: "CrossTeachingTraining.py", path: `${SRC}/repo/CrossTeachingTraining.py`, lang: "python", note: "The method: supervised steps, the image-level confidence gate, pseudo-label exchange with resampling, warmup, best-ensemble checkpointing. Group code, Oxford-Pet redesign." },
    { name: "CrossDetection.py", path: `${SRC}/repo/CrossDetection.py`, lang: "python", note: "Cross-teaching for detection (Faster R-CNN + ViT head, 37 breeds) - written during training downtime, never run. Shown as a read, not a demo." },
    { name: "data_oxford_pet.py", path: `${SRC}/repo/data_oxford_pet.py`, lang: "python", note: "TFDS loading, the fixed DATA_SEED=42 splits, the labeled-20% / unlabeled-80% policy." },
    { name: "Unet_TransferLearn.py", path: `${SRC}/repo/Unet_TransferLearn.py`, lang: "python", note: "Supervised U-Net baseline: ResNet-34 encoder frozen, macro Dice loss." },
    { name: "ViT_train.py", path: `${SRC}/repo/ViT_train.py`, lang: "python", note: "Supervised ViT baseline: ViT-B/16 frozen, transposed-conv decoder trained." },
    { name: "autodiff notebook", path: `${SRC}/ladder/autodiff_extract.py`, lang: "python", note: "DTU 02456 week 3.2 (extracted): backprop through an expression graph by hand; the ladder's live card ports this." },
    { name: "half-moon notebook", path: `${SRC}/ladder/ffn_halfmoon_extract.py`, lang: "python", note: "DTU 02456 week 3.3 (extracted): the FFN the ladder card trains live in TypeScript." },
    { name: "metrics.ts", path: "src/demos/crossteach/core/metrics.ts", lang: "ts", note: "TS ports of the repo's compute_metrics, the image-level confidence gate, and logit-averaged ensembling, fixture-tested against the Python pipeline." },
    { name: "prep script", path: "scripts/demos/crossteach_prep.py", lang: "python", note: "Build-time prep: runs the four GitHub checkpoints over 12 test images, computes attention rollouts and activations, packages curves, micro-CT slices and fixtures." },
  ],
  sourceFooter:
    "Group project, 02456 Deep Learning, DTU, fall 2025 - Group 9: Olfert Jan Mebius, David Brin, Joey Bink, Thorsteinn Mar Hoskuldsson. Oxford-Pet redesign, checkpoints and metrics: github.com/DavidBrin/Semi-supervised-image-model (2026). Micro-CT data: github.com/DavidBrin/Semi-supervised-Microtomography-Segmentation. Course notebooks are DTU 02456 templates with David's solutions. Data: Oxford-IIIT Pet (Parkhi et al.) via TFDS. Method after Luo et al., arXiv:2207.14191.",
};

export default meta;
