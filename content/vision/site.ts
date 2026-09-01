import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "vision",
  kind: "demo",
  displayName: "Computer Vision",
  fakeDomain: "vision.davids.net",
  liveUrl: "/demos/vision",
  tagline: "Classical computer vision, live in the browser: relight a face, click an epipolar line, race two matchers.",
  description:
    "Interactive demo of David's CSE 152A coursework (UC San Diego, winter 2025): photometric stereo solves ~24,000 per-pixel least-squares systems to recover normals, albedo and depth from four lit photos, then a draggable light relights the face from the recovered surface. The 8-point algorithm computes the fundamental matrix from the course's dino pair so every click lands an epipolar line on the other view; a Sobel corner detector and an SSD-vs-NCC matching race run on the same images. Two precomputed panels cover bag-of-words face classification (a real 100-word visual vocabulary) and the FashionMNIST/STL-10 CNN and transfer-learning curves. All live math is TypeScript fixture-tested against the original NumPy solutions.",
  accentColor: "#22C55E",
  favicon: "👁️",
  techStack: [
    "Python", "NumPy/SciPy", "OpenCV", "scikit-learn", "PyTorch",
    "TypeScript", "Web Workers", "Canvas",
  ],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#stereo",
      title: "Photometric stereo + relighting",
      snippet:
        "Four photos of a face under known lights become normals, albedo and depth via per-pixel least squares; drag the light on a hemisphere to relight the recovered surface live.",
      keywords: ["photometric stereo", "normals", "albedo", "relighting", "horn integration", "lambertian"],
    },
    {
      path: "#epipolar",
      title: "Epipolar geometry, corners, matching",
      snippet:
        "Click anywhere on one dino view and the epipolar line sweeps across the other (normalized 8-point F); tune the Harris-style corner detector; watch SSD lose to NCC when brightness shifts.",
      keywords: ["epipolar line", "fundamental matrix", "8-point algorithm", "harris corners", "ssd", "ncc"],
    },
    {
      path: "#bow",
      title: "Bag-of-words faces",
      snippet:
        "Interest points to 11x11 patches to a k-means visual vocabulary to histograms to k-NN: the real 100-word vocabulary and the archived accuracy table (up to 92% on faces).",
      keywords: ["bag of words", "visual vocabulary", "k-means", "knn", "sift", "face classification"],
    },
    {
      path: "#cnn",
      title: "CNN + transfer curves",
      snippet:
        "FashionMNIST small-CNN results by optimizer and dropout, the learning-rate study, and STL-10 transfer learning with a frozen conv stack: the archived winter-2025 curves.",
      keywords: ["cnn", "fashionmnist", "transfer learning", "stl-10", "learning rate", "dropout"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "computer vision", "photometric stereo", "epipolar", "fundamental matrix",
    "harris corners", "ncc", "bag of words", "cnn", "cse152", "superpoint",
  ],
  knowledgePanel: {
    type: "Coursework demo",
    facts: {
      Course: "CSE 152A/B, UC San Diego, winter + spring 2025",
      Topics: "photometric stereo, epipolar geometry, feature matching, bag of words, CNNs",
      "Live in-browser": "stereo solve + relighting, 8-point F + epipolar lines, corners, SSD/NCC",
      Fidelity: "TS ports fixture-tested vs the NumPy solutions; dino F matches the notebook",
      Data: "course images (facedata, dino/warrior pairs, 200-image face set); solutions are David's",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
