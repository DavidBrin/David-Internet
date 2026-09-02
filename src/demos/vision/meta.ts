import type { DemoMeta } from "@/lib/demos";

const SRC = "demos/vision_src";

const meta: DemoMeta = {
  slug: "vision",
  theme: { bg: "#eff6ef", panel: "#e3efe3" }, // camera-viewfinder green
  what: "classical computer vision running live: relight a face, click an epipolar line, race two matchers",
  why: "before deep learning, vision was light, geometry, and matching, and all three fit in a browser",
  when: "CSE 152A/B, UC San Diego, winter + spring 2025",
  story: [
    {
      title: "The classical half first",
      body:
        "CSE 152A teaches computer vision the pre-learning way: physics of image formation, then geometry between views, then hand-built features, and only then hands the pixels to a CNN. This page runs David's homework solutions in TypeScript on the course's own images, in the same order the quarter did.",
    },
    {
      title: "Three photos are enough",
      body:
        "Photometric stereo inverts the lighting equation I = albedo x (N . L): given the same face under known light directions, each pixel becomes a tiny least-squares problem, and out come surface normals, albedo, and (after integrating the gradient field with Horn's iterative scheme) depth. Panel 1 solves ~24,000 of those per-pixel systems in front of you, then lets you drag the light anywhere. Three images suffice; the fourth adds robustness (the homework's 1(b) vs 1(c) comparison).",
      anchor: "#stereo",
    },
    {
      title: "What survives between two views",
      body:
        "Move the camera and almost everything about the image changes, except epipolar geometry. The 8-point algorithm recovers the fundamental matrix from 13 hand-clicked correspondences (with Hartley normalization, the part that makes it actually work); after that, any point you click in one dino photo pins its match in the other to a single line. The Harris-style corner detector and the SSD-vs-NCC matching race are the other two HW2 problems, live.",
      anchor: "#epipolar",
    },
    {
      title: "Bag of words: the bridge to learning",
      body:
        "HW3 classifies faces the 2005 way: sample interest points, cut out 11x11 patches, cluster 8,000 of them into a 100-word visual vocabulary with k-means, describe each image as a word histogram, and let k-NN vote. The vocabulary strip below is real (rebuilt at build time from the course's 100 faces) and the accuracy table is the archived run: SIFT keypoints + descriptors reached 92% on faces, while non-faces stayed hard.",
      anchor: "#bow",
    },
    {
      title: "Then the network learns the features",
      body:
        "HW4 ends the arc: a small CNN on FashionMNIST (two conv layers, 90-92% test accuracy depending on optimizer and dropout), a learning-rate study where 0.1 visibly diverges, and transfer learning on STL-10: train the conv stack on five classes, freeze it, and fine-tune only the classifier on the other five. The curves are the archived winter-2025 run; nothing here is retrained or invented.",
      anchor: "#cnn",
    },
    {
      title: "152B: the deeper networks",
      body:
        "The graduate follow-on (CSE 152B) went past HW4's two-conv-layer nets to real deep architectures, referenced here even though they can't run in a browser. SuperPoint is a full deep detector-descriptor network: pre-trained as MagicPoint on synthetic corners, generalized to real images by homographic adaptation, and evaluated on HPatches against SIFT and Harris - the same question panel 2 asks, answered by a network (the vendored pytorch-superpoint repo ran on the course GPU cluster and wasn't archived; the notebook with David's answers is in the Source drawer). The second half trained a CNN embedding for fashion-image retrieval with metric learning - triplet loss, margin studies, hard-negative mining.",
    },
    {
      title: "Rebuilt for this page (2026-09-01)",
      body:
        "The TS ports (per-pixel stereo solver, Horn integration, Jacobi SVD for the 8-point algorithm, the Sobel corner detector, SSD/NCC) were written with AI coding tools and are fixture-tested against David's NumPy solutions: the dino fundamental matrix matches the notebook's printed value to 4e-12. One honest patch: the original photometric-stereo input pickle wasn't archived, so the four input photos are re-rendered from the course's facedata (albedo + heightmap) with David's own Lambertian renderer under the four original light directions recovered from the notebook output, disclosed in panel 1.",
    },
  ],
  sources: [
    { name: "hw1 photometric stereo", path: `${SRC}/hw1_extract.py`, lang: "python", note: "Course template + David's solutions (code cells extracted from the notebook): per-pixel least squares, Horn integration, Lambertian rendering." },
    { name: "hw2 epipolar geometry", path: `${SRC}/hw2_extract.py`, lang: "python", note: "Edges, the Sobel corner detector, SSD/NCC matching, and the normalized 8-point algorithm (extracted from the notebook)." },
    { name: "hw3 bag of words", path: `${SRC}/hw3_extract.py`, lang: "python", note: "Interest-point sampling, patch/SIFT features, k-means vocabulary, histograms, k-NN (extracted from the notebook)." },
    { name: "hw4 CNNs", path: `${SRC}/hw4_extract.py`, lang: "python", note: "FashionMNIST CNN, optimizer/dropout/learning-rate studies, STL-10 transfer learning (extracted from the notebook)." },
    { name: "152B superpoint + metric learning", path: `${SRC}/hw152b_extract.py`, lang: "python", note: "The deeper networks from CSE 152B: SuperPoint/MagicPoint keypoint pipeline and the triplet-loss fashion-retrieval CNN (extracted from the notebook; referenced on the page, not runnable in the demo)." },
    { name: "stereo.ts", path: "src/demos/vision/core/stereo.ts", lang: "ts", note: "TS port of photometric_stereo + horn_integrate + lambertian, fixture-tested against NumPy." },
    { name: "fmatrix.ts", path: "src/demos/vision/core/fmatrix.ts", lang: "ts", note: "TS port of the normalized 8-point algorithm on a one-sided Jacobi SVD." },
    { name: "features.ts", path: "src/demos/vision/core/features.ts", lang: "ts", note: "TS port of David's corner detector, including its convolve2d mode='full' quirk." },
    { name: "prep script", path: "scripts/demos/vision_prep.py", lang: "python", note: "Build-time prep: re-renders the stereo inputs, ships image pairs + correspondences, rebuilds the BoW vocabulary, extracts the archived CNN curves, writes fixtures." },
  ],
  sourceFooter:
    "Course materials (assignment templates, facedata, the dino/matrix/warrior pairs, the face/non-face set) are from UCSD CSE 152A/B, winter-spring 2025; solutions are David's. The dino, warrior and matrix images are standard multi-view CV datasets distributed with the course.",
};

export default meta;
