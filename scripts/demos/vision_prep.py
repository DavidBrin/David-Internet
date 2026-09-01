"""Computer Vision demo prep (CSE 152A, winter 2025).

Run via  pnpm sync-demos vision  (scripts/demos/vision.ts spawns this with py -3.12).

    py -3.12 scripts/demos/vision_prep.py <rawDir> <outDir> <repoRoot>

Inputs (never modified): demos/computer_vision_cse152_raw/
Outputs (committed):
  public/demos/vision/            page assets (images, json, curated figures)
  tests/fixtures/vision-*.json    fixtures the TS ports are tested against

Faithfulness notes
------------------
* The HW1 photometric-stereo input pickle (data.pickle: im1..4 + l1..4) was not
  archived; only facedata.npy (albedo / uniform_albedo / heightmap / 2 lights)
  survives. The four input images are therefore RE-RENDERED here from facedata
  using David's own HW1 solution code (normals-from-heightmap kernels +
  lambertian()) under the four original light directions recovered from the
  notebook's printed output. Quantize-then-fixture: fixtures are computed from
  the same uint8 images the page ships, so the TS solver can match exactly.
* corner_detect keeps David's convolve2d default mode="full" quirk (the minor
  eigenvalue image is 2px larger than the input); the TS port must replicate it.
* CNN "curves" are extracted from the archived winter-2025 notebook run (stream
  outputs + stored figures) - not re-trained here.

ASCII-only prints (cp1252 console).
"""
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.signal import convolve, convolve2d

RAW = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("demos/computer_vision_cse152_raw")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("public/demos/vision")
REPO = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(".")
FIXTURES = REPO / "tests" / "fixtures"
OUT.mkdir(parents=True, exist_ok=True)
FIXTURES.mkdir(parents=True, exist_ok=True)

rng = np.random.default_rng(152)


def log(msg):
    print(f"[vision_prep] {msg}")


def save_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
    log(f"wrote {path} ({path.stat().st_size // 1024} KB)")


def rnd(a, nd=6):
    return np.round(np.asarray(a, dtype=float), nd).tolist()


# --------------------------------------------------------------------------
# David's HW1 solution code, verbatim logic
# --------------------------------------------------------------------------
def heightmap_normals(heightmap):
    """Cell 30 of hw1: central-difference kernels + unit normalization."""
    normals = np.stack(
        (np.zeros(heightmap.shape), np.zeros(heightmap.shape), np.ones(heightmap.shape)),
        axis=-1,
    )
    kernx = np.zeros((3, 3))
    kerny = np.zeros((3, 3))
    kernx[1, 0] = 0.5
    kernx[1, 2] = -0.5
    kerny[0, 1] = 0.5
    kerny[2, 1] = -0.5
    normals[:, :, 0] = convolve(heightmap, kernx, mode="same")
    normals[:, :, 1] = convolve(heightmap, kerny, mode="same")
    mag = np.linalg.norm(normals, axis=-1, keepdims=True)
    return normals / mag


def lambertian(normals, light, albedo, intensity=1.0):
    """Cell 34 of hw1 (David's solution)."""
    light = light / np.linalg.norm(light)
    dprod = np.sum(normals * light, axis=-1)
    image = albedo * dprod * intensity
    return np.clip(image, 0, 1)


def horn_integrate(gx, gy, niter):
    """Cell 7 of hw1 (course-provided helper), trimmed of the unused mask arg."""
    g = np.ones(np.shape(gx))
    mask = np.ones_like(g)
    A = np.array([[0, 1, 0], [0, 0, 0], [0, 0, 0]])
    B = np.array([[0, 0, 0], [1, 0, 0], [0, 0, 0]])
    C = np.array([[0, 0, 0], [0, 0, 1], [0, 0, 0]])
    D = np.array([[0, 0, 0], [0, 0, 0], [0, 1, 0]])
    d_mask = A + B + C + D
    den = np.multiply(convolve(mask, d_mask, mode="same"), mask)
    den[den == 0] = 1
    rden = 1.0 / den
    mask2 = np.multiply(rden, mask)
    m_c = convolve(mask, C, mode="same")
    m_d = convolve(mask, D, mode="same")
    term_right = np.multiply(m_c, gx) + np.multiply(m_d, gy)
    t_a = -1.0 * convolve(gx, B, mode="same")
    t_b = -1.0 * convolve(gy, A, mode="same")
    term_right = term_right + t_a + t_b
    term_right = np.multiply(mask2, term_right)
    for _ in range(niter):
        g = np.multiply(mask2, convolve(g, d_mask, mode="same")) + term_right
    return g


def photometric_stereo(images, lights, niter=500):
    """Cell 8 of hw1 (David's solution), horn iterations parameterized."""
    albedo = np.ones(images[0].shape)
    normals = np.dstack(
        (np.zeros(images[0].shape), np.zeros(images[0].shape), np.ones(images[0].shape))
    )
    Square = np.dot(lights.T, lights)
    Inv = np.linalg.inv(Square)
    height, width = images.shape[1], images.shape[2]
    for i in range(height):
        for j in range(width):
            I = images[:, i, j]
            b = np.dot(Inv, np.dot(lights.T, I))
            albedo[i, j] = np.linalg.norm(b)
            if albedo[i, j] > 0:
                normals[i, j] = b / albedo[i, j]
    gx = -normals[:, :, 0] / normals[:, :, 2]
    gy = -normals[:, :, 1] / normals[:, :, 2]
    H = horn_integrate(gx, gy, niter)
    return albedo, normals, H


# --------------------------------------------------------------------------
# 1) Photometric stereo assets + fixtures
# --------------------------------------------------------------------------
def prep_stereo():
    face = np.load(RAW / "hw1_photometric_stereo" / "facedata.npy", allow_pickle=True).item()
    albedo = face["albedo"].astype(float)
    uniform = face["uniform_albedo"].astype(float)
    heightmap = face["heightmap"].astype(float)
    albedo_n = albedo / albedo.max()
    uniform_n = uniform / uniform.max()

    normals = heightmap_normals(heightmap)

    # Original light directions, recovered from the hw1 notebook's printed output.
    lights = np.array(
        [
            [0.57735027, 0.57735027, 0.57735027],
            [0.0, 0.0, 1.0],
            [-0.42426407, -0.70710678, 0.56568542],
            [0.21821789, -0.43643578, 0.87287156],
        ]
    )

    imgs_u8 = []
    d = OUT / "face"
    d.mkdir(exist_ok=True)
    for i, l in enumerate(lights):
        img = lambertian(normals, l, albedo_n, 1.0)
        u8 = np.round(img * 255).astype(np.uint8)
        imgs_u8.append(u8)
        Image.fromarray(u8, "L").save(d / f"im{i + 1}.png", optimize=True)
    Image.fromarray(np.round(albedo_n * 255).astype(np.uint8), "L").save(
        d / "albedo.png", optimize=True
    )
    Image.fromarray(np.round(uniform_n * 255).astype(np.uint8), "L").save(
        d / "uniform_albedo.png", optimize=True
    )
    h, w = heightmap.shape
    save_json(
        d / "lights.json",
        {
            "lights": rnd(lights, 8),
            "width": w,
            "height": h,
            "note": (
                "Input images re-rendered at build from the course facedata.npy "
                "(albedo + heightmap) with David's HW1 lambertian(), under the four "
                "original light directions recovered from the archived notebook run; "
                "the original data.pickle was not archived."
            ),
        },
    )

    # Ground-truth heightmap for a compare toggle (float16-ish precision as int16 grid)
    hm = heightmap - heightmap.min()
    hm16 = np.round(hm / hm.max() * 10000).astype(int)
    save_json(d / "heightmap.json", {"scale": float(hm.max()), "q": 10000, "data": hm16.tolist()})

    # Fixture: solve from the exact dequantized uint8 images the page ships.
    images = np.stack([u.astype(float) / 255.0 for u in imgs_u8])
    alb4, nrm4, H4 = photometric_stereo(images, lights, niter=500)
    alb3, nrm3, _ = photometric_stereo(images[[0, 1, 3]], lights[[0, 1, 3]], niter=1)

    # crop for compact exact comparison
    r0, c0 = 80, 50
    crop = np.s_[r0 : r0 + 16, c0 : c0 + 16]
    # small horn_integrate case on stride-4 gradients (page integrates on stride 2)
    gx = (-nrm4[:, :, 0] / nrm4[:, :, 2])[::4, ::4]
    gy = (-nrm4[:, :, 1] / nrm4[:, :, 2])[::4, ::4]
    horn_small = horn_integrate(gx, gy, 200)
    save_json(
        FIXTURES / "vision-stereo.json",
        {
            "lights": rnd(lights, 8),
            "crop": {"row": r0, "col": c0, "size": 16},
            "inputs": [u[crop].tolist() for u in imgs_u8],
            "albedo4": rnd(alb4[crop], 6),
            "normals4": rnd(nrm4[crop], 6),
            "albedo3": rnd(alb3[crop], 6),
            "normals3": rnd(nrm3[crop], 6),
            "hornGx": rnd(gx, 6),
            "hornGy": rnd(gy, 6),
            "hornIters": 200,
            "hornOut": rnd(horn_small, 5),
            "relight": {
                "light": rnd(lights[2], 8),
                "expected": rnd(
                    (lambertian(nrm4, lights[2], alb4, 1.0))[crop], 6
                ),
            },
        },
    )
    log(f"stereo: rendered 4 inputs {w}x{h}, fixtures done")


# --------------------------------------------------------------------------
# 2) Epipolar / corners / matching assets + fixtures
# --------------------------------------------------------------------------
def gaussian2d(filter_size=1, sig=1.0):
    ax = np.arange(-filter_size // 2 + 1.0, filter_size // 2 + 1.0)
    xx, yy = np.meshgrid(ax, ax)
    kernel = np.exp(-0.5 * (np.square(xx) + np.square(yy)) / np.square(sig))
    return kernel / np.sum(kernel)


def smooth(image, sig=1.2):
    return convolve2d(image, gaussian2d(9, sig), mode="same")


def corner_detect(image, n_corners, smooth_std):
    """David's Sobel corner_detect, incl. the convolve2d mode='full' quirk."""
    Ix = convolve2d(image, [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])
    Iy = convolve2d(image, [[-1, -2, -1], [0, 0, 0], [1, 2, 1]])
    Sxx = smooth(Ix**2, sig=smooth_std)
    Syy = smooth(Iy**2, sig=smooth_std)
    Sxy = smooth(Ix * Iy, sig=smooth_std)
    trace = Sxx + Syy
    determinant = (Sxx * Syy) - (Sxy**2)
    minor = trace / 2 - np.sqrt((trace**2) / 4 - determinant)
    suppressed = np.zeros_like(minor)
    for i in range(1, minor.shape[0] - 1):
        for j in range(1, minor.shape[1] - 1):
            patch = minor[i - 1 : i + 2, j - 1 : j + 2]
            if minor[i, j] == np.max(patch):
                suppressed[i, j] = minor[i, j]
    grid = int(np.sqrt(n_corners))
    cands = []
    for i in range(0, suppressed.shape[0], grid):
        for j in range(0, suppressed.shape[1], grid):
            p = suppressed[i : i + grid, j : j + grid]
            mi, mj = np.unravel_index(np.argmax(p), p.shape)
            cands.append((i + mi, j + mj))
    cands = np.array(cands)
    order = np.argsort(suppressed[cands[:, 0], cands[:, 1]])[::-1]
    corners = cands[order[:n_corners]][:, ::-1]
    return minor, corners


def compute_fundamental(x1, x2):
    n = x1.shape[1]
    A = np.zeros((n, 9))
    for i in range(n):
        uo, vo, _ = x1[:, i]
        up, vp, _ = x2[:, i]
        A[i] = [uo * up, vo * up, up, uo * vp, vo * vp, vp, uo, vo, 1]
    _, _, U = np.linalg.svd(A)
    F = U[-1].reshape(3, 3)
    U2, S, V = np.linalg.svd(F)
    S[2] = 0
    F = np.dot(U2, np.dot(np.diag(S), V))
    return F / F[2, 2]


def fundamental_matrix(x1, x2):
    x1 = x1 / x1[2]
    mean_1 = np.mean(x1[:2], axis=1)
    S1 = np.sqrt(2) / np.std(x1[:2])
    T1 = np.array([[S1, 0, -S1 * mean_1[0]], [0, S1, -S1 * mean_1[1]], [0, 0, 1]])
    x1n = np.dot(T1, x1)
    x2 = x2 / x2[2]
    mean_2 = np.mean(x2[:2], axis=1)
    S2 = np.sqrt(2) / np.std(x2[:2])
    T2 = np.array([[S2, 0, -S2 * mean_2[0]], [0, S2, -S2 * mean_2[1]], [0, 0, 1]])
    x2n = np.dot(T2, x2)
    F = compute_fundamental(x1n, x2n)
    F = np.dot(T2.T, np.dot(F, T1))
    return F / F[2, 2]


def ncc_match(img1, img2, c1, c2, R):
    x1s, x1f = c1[0] - R, c1[0] + R + 1
    y1s, y1f = c1[1] - R, c1[1] + R + 1
    x2s, x2f = c2[0] - R, c2[0] + R + 1
    y2s, y2f = c2[1] - R, c2[1] + R + 1
    W1 = img1[y1s:y1f, x1s:x1f]
    W2 = img2[y2s:y2f, x2s:x2f]
    n = (R * 2 + 1) ** 2
    a1 = np.sum(W1) / n
    a2 = np.sum(W2) / n
    s1 = np.sqrt(np.sum((W1 - a1) ** 2) / n)
    s2 = np.sqrt(np.sum((W2 - a2) ** 2) / n)
    return np.sum((W1 - a1) * (W2 - a2) / (s1 * s2)) / n


def ssd_match(img1, img2, c1, c2, R):
    W1 = img1[c1[1] - R : c1[1] + R + 1, c1[0] - R : c1[0] + R + 1]
    W2 = img2[c2[1] - R : c2[1] + R + 1, c2[0] - R : c2[0] + R + 1]
    return np.sum((W1 - W2) ** 2)


def rgb2gray(rgb):
    return np.dot(rgb[..., :3], [0.299, 0.587, 0.114])


def ship_image(src, dest, max_w, quality=82, gray=False):
    img = Image.open(src)
    if gray and img.mode != "L":
        img = img.convert("L")
    if img.mode == "RGBA":
        img = img.convert("RGB")
    scale = 1.0
    if img.width > max_w:
        scale = max_w / img.width
        img = img.resize((max_w, round(img.height * scale)), Image.LANCZOS)
    img.save(dest, quality=quality)
    return scale, img.width, img.height


def prep_epipolar():
    hw2 = RAW / "hw2_epipolar_geometry"
    d = OUT / "epipolar"
    d.mkdir(exist_ok=True)

    meta = {}
    # dino pair for epipolar lines + the SSD/NCC race
    for name in ["dino0", "dino1"]:
        scale, w, h = ship_image(hw2 / "imgs" / "p4" / "dino" / f"{name}.png", d / f"{name}.jpg", 760)
        meta[name] = {"scale": round(scale, 6), "w": w, "h": h}
    # warrior pair for naive corner matching
    for name in ["warrior0", "warrior1"]:
        scale, w, h = ship_image(hw2 / "imgs" / "p4" / "warrior" / f"{name}.png", d / f"{name}.jpg", 560)
        meta[name] = {"scale": round(scale, 6), "w": w, "h": h}
    # im0 for the harris panel, geisel for edges - grayscale, small
    s0, w0, h0 = ship_image(hw2 / "imgs" / "im0.png", d / "im0.jpg", 512, gray=True)
    meta["im0"] = {"scale": round(s0, 6), "w": w0, "h": h0}
    sg, wg, hg = ship_image(hw2 / "imgs" / "geisel.jpeg", d / "geisel.jpg", 420, gray=True)
    meta["geisel"] = {"scale": round(sg, 6), "w": wg, "h": hg}

    cors = {}
    Fs = {}
    for pair in ["dino", "matrix", "warrior"]:
        c1 = np.load(hw2 / "imgs" / "p4" / pair / "cor1.npy")
        c2 = np.load(hw2 / "imgs" / "p4" / pair / "cor2.npy")
        cors[pair] = {"cor1": rnd(c1, 2), "cor2": rnd(c2, 2)}
        Fs[pair] = fundamental_matrix(c1, c2)

    # sanity: dino F must match the value printed in the notebook
    expect = np.array(
        [
            [4.00502510e-07, -2.69900666e-06, 1.37819769e-03],
            [3.09619039e-06, -1.00972419e-08, -7.29675791e-03],
            [-2.86966053e-03, 6.70452915e-03, 1.00000000e00],
        ]
    )
    err = np.max(np.abs(Fs["dino"] - expect))
    if err > 1e-6:
        raise RuntimeError(f"dino F mismatch vs notebook: {err}")
    log(f"dino F matches the notebook (max err {err:.2e})")

    import pickle

    with open(hw2 / "imgs" / "p3" / "crns_war.pkl", "rb") as f:
        crns_war = pickle.load(f)

    save_json(
        d / "data.json",
        {
            "images": meta,
            "correspondences": {k: v for k, v in cors.items() if k in ("dino", "warrior")},
            "F": {k: rnd(v, 10) for k, v in Fs.items()},
            "warriorCorners": [rnd(c, 1) for c in crns_war],
            "note": "Correspondences and F are in ORIGINAL image coordinates; multiply by images[name].scale for display.",
        },
    )

    # fixtures --------------------------------------------------------------
    img1 = np.array([[1, 2, 3, 4], [4, 5, 6, 8], [7, 8, 9, 4]], dtype=float)
    img2 = np.array([[1, 2, 1, 3], [6, 5, 4, 4], [9, 8, 7, 3]], dtype=float)
    unit = {
        "img1": img1.tolist(),
        "img2": img2.tolist(),
        "ssd": [
            {"c1": [1, 1], "c2": [1, 1], "R": 1, "v": 20},
            {"c1": [2, 1], "c2": [2, 1], "R": 1, "v": 30},
            {"c1": [1, 1], "c2": [2, 1], "R": 1, "v": 46},
        ],
        "ncc": [
            {"c1": [1, 1], "c2": [1, 1], "R": 1, "v": float(ncc_match(img1, img2, [1, 1], [1, 1], 1))},
            {"c1": [2, 1], "c2": [2, 1], "R": 1, "v": float(ncc_match(img1, img2, [2, 1], [2, 1], 1))},
            {"c1": [1, 1], "c2": [2, 1], "R": 1, "v": float(ncc_match(img1, img2, [1, 1], [2, 1], 1))},
        ],
    }
    # real-window scores on the shipped warrior JPEGs (quantize-then-fixture)
    w0i = rgb2gray(np.asarray(Image.open(d / "warrior0.jpg").convert("RGB"), dtype=float)) / 255.0
    w1i = rgb2gray(np.asarray(Image.open(d / "warrior1.jpg").convert("RGB"), dtype=float)) / 255.0
    sc = meta["warrior0"]["scale"]
    pairs = []
    for (x1, y1), (x2, y2) in zip(crns_war[0][:6], crns_war[1][:6]):
        c1 = [int(round(x1 * sc)), int(round(y1 * sc))]
        c2 = [int(round(x2 * sc)), int(round(y2 * sc))]
        R = 12
        H, W = w0i.shape
        if min(c1 + c2) < R or c1[0] + R + 1 > W or c2[0] + R + 1 > W or c1[1] + R + 1 > H or c2[1] + R + 1 > H:
            continue
        pairs.append(
            {
                "c1": c1,
                "c2": c2,
                "R": R,
                "ssd": float(ssd_match(w0i, w1i, c1, c2, R)),
                "ncc": float(ncc_match(w0i, w1i, c1, c2, R)),
            }
        )
    save_json(
        FIXTURES / "vision-match.json",
        {"unit": unit, "warrior": pairs, "note": "warrior scores computed on the shipped JPEGs, images/255"},
    )

    save_json(
        FIXTURES / "vision-fmatrix.json",
        {
            "pairs": {
                p: {"cor1": cors[p]["cor1"], "cor2": cors[p]["cor2"], "F": rnd(Fs[p], 12)}
                for p in ["dino", "matrix", "warrior"]
            }
        },
    )

    # harris fixture: 96x96 crop of the shipped im0 (uint8/asarray -> /1.0 like the notebook's io.imread as_gray floats)
    im0 = np.asarray(Image.open(d / "im0.jpg"), dtype=float) / 255.0
    crop = im0[40:136, 120:216]
    minor, corners = corner_detect(crop, 25, 2.0)
    save_json(
        FIXTURES / "vision-harris.json",
        {
            "cropOrigin": [40, 120],
            "cropSize": 96,
            "smoothStd": 2.0,
            "nCorners": 25,
            "minorShape": list(minor.shape),
            "minorSample": rnd(minor[10:90:8, 10:90:8], 5),
            "corners": corners.tolist(),
            "note": "minor eigenvalue image includes David's convolve2d mode='full' quirk: shape = crop + 2",
        },
    )
    log("epipolar: images, F matrices, match + harris fixtures done")


# --------------------------------------------------------------------------
# 3) Bag-of-words assets (real pipeline re-run for the strip; archived accuracies)
# --------------------------------------------------------------------------
def prep_bow():
    import random

    import cv2
    from sklearn.cluster import KMeans

    hw3 = RAW / "hw3_face_detection"
    d = OUT / "bow"
    d.mkdir(exist_ok=True)
    random.seed(1234)

    im_size = (133, 200)
    n_pts, w_grid, patch_size, n_clusters = 200, 5, 11, 100

    def load_image(p):
        img = cv2.imread(str(p))
        img = cv2.resize(img, (im_size[1], im_size[0]))
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    def uniform_sampling():
        pts = []
        w, h = im_size
        for i in range(0, h, w_grid):
            for j in range(0, w, w_grid):
                x = min(i + random.randint(0, w_grid - 1), h - 1)
                y = min(j + random.randint(0, w_grid - 1), w - 1)
                pts.append((x, y))
        return random.sample(pts, min(n_pts, len(pts)))

    def patch_features(img, pts):
        feats = []
        half = patch_size // 2
        w, h = img.shape[:2]
        for x, y in pts:
            xs, ys = max(0, x - half), max(0, y - half)
            xe, ye = xs + patch_size, ys + patch_size
            if xe > w:
                xe, xs = w, w - patch_size
            if ye > h:
                ye, ys = h, h - patch_size
            feats.append(img[xs:xe, ys:ye].flatten())
        return feats

    faces = sorted((hw3 / "images" / "face").glob("*.jpg"))
    nonfaces = sorted((hw3 / "images" / "nonface").glob("*.jpg"))
    sample_face = load_image(faces[0])
    sample_non = load_image(nonfaces[0])
    Image.fromarray(sample_face, "L").save(d / "sample_face.webp", quality=84)
    Image.fromarray(sample_non, "L").save(d / "sample_nonface.webp", quality=84)
    for i, p in enumerate(faces[1:5]):
        Image.fromarray(load_image(p), "L").save(d / f"face_{i}.webp", quality=80)
    for i, p in enumerate(nonfaces[1:5]):
        Image.fromarray(load_image(p), "L").save(d / f"nonface_{i}.webp", quality=80)

    # build a real 100-word visual vocabulary from patch features on 40 training faces
    all_feats = []
    for p in faces[:40]:
        img = load_image(p)
        all_feats.extend(patch_features(img, uniform_sampling()))
    all_feats = np.array(all_feats, dtype=float)
    km = KMeans(n_clusters=n_clusters, random_state=1234, n_init=4).fit(all_feats)
    centers = km.cluster_centers_.reshape(n_clusters, patch_size, patch_size)

    # vocabulary sprite: 10x10 grid of 11x11 patches with 1px gaps
    gap = 1
    sheet = np.full((10 * (patch_size + gap) + gap, 10 * (patch_size + gap) + gap), 255, np.uint8)
    for k in range(n_clusters):
        r, c = divmod(k, 10)
        y = gap + r * (patch_size + gap)
        x = gap + c * (patch_size + gap)
        patch = centers[k]
        patch = (patch - patch.min()) / max(patch.max() - patch.min(), 1e-9) * 255
        sheet[y : y + patch_size, x : x + patch_size] = patch.astype(np.uint8)
    Image.fromarray(sheet, "L").resize((sheet.shape[1] * 4, sheet.shape[0] * 4), Image.NEAREST).save(
        d / "vocab.png", optimize=True
    )

    # sample face pipeline: points -> features -> histogram
    pts = uniform_sampling()
    feats = np.array(patch_features(sample_face, pts), dtype=float)
    labels = km.predict(feats)
    hist = np.histogram(labels, bins=np.arange(n_clusters + 1))[0]
    non_pts = uniform_sampling()
    non_feats = np.array(patch_features(sample_non, non_pts), dtype=float)
    non_hist = np.histogram(km.predict(non_feats), bins=np.arange(n_clusters + 1))[0]

    # archived accuracy table from the winter-2025 notebook run (cell 17 stream output)
    results = []
    table = {
        (3, "uniform", "sift_descriptor"): (0.72, 0.60, 0.56),
        (3, "uniform", "patch"): (0.72, 0.52, 0.60),
        (3, "sift_keypoint", "sift_descriptor"): (0.84, 0.44, 0.70),
        (3, "sift_keypoint", "patch"): (0.88, 0.56, 0.66),
        (5, "uniform", "sift_descriptor"): (0.88, 0.48, 0.70),
        (5, "uniform", "patch"): (0.72, 0.36, 0.68),
        (5, "sift_keypoint", "sift_descriptor"): (0.92, 0.60, 0.66),
        (5, "sift_keypoint", "patch"): (0.92, 0.56, 0.68),
    }
    for (k, pt, ft), (pos, neg, tot) in table.items():
        results.append({"k": k, "points": pt, "features": ft, "posAcc": pos, "negAcc": neg, "totalAcc": tot})

    # Bayes spam mini-card numbers (hw3 cells 22-30, course-given table)
    bayes = {
        "bins": ["<100", "100-200", "200-300", "300-400", "400+"],
        "spamCounts": [15, 45, 110, 80, 150],
        "notSpamCounts": [180, 360, 140, 115, 5],
        "totalSpam": 400,
        "totalNotSpam": 800,
    }

    save_json(
        d / "bow_results.json",
        {
            "params": {"imSize": im_size, "nPts": n_pts, "wGrid": w_grid, "patchSize": patch_size, "nClusters": n_clusters},
            "counts": {"face": len(faces), "nonface": len(nonfaces)},
            "samplePoints": [[int(a), int(b)] for a, b in pts],
            "sampleHist": hist.tolist(),
            "sampleNonHist": non_hist.tolist(),
            "accuracies": results,
            "bayes": bayes,
            "note": (
                "Vocabulary, interest points and histograms recomputed at build with the "
                "notebook's own pipeline (patch features, 100 k-means words); the accuracy "
                "table is the archived winter-2025 run's printed output."
            ),
        },
    )
    log(f"bow: vocab sprite + strip data from {len(faces)}/{len(nonfaces)} images")


# --------------------------------------------------------------------------
# 4) CNN curves (archived run) + curated figures
# --------------------------------------------------------------------------
def prep_cnn():
    d = OUT / "cnn"
    d.mkdir(exist_ok=True)
    ep = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
    curves = {
        "fashionMnist": [
            {"config": "SGD", "dropout": False, "testAcc": 0.900},
            {"config": "SGD", "dropout": True, "testAcc": 0.892},
            {"config": "Adam", "dropout": False, "testAcc": 0.920},
            {"config": "Adam", "dropout": True, "testAcc": 0.919},
        ],
        "transferEpochs": ep,
        "transfer": [
            {
                "run": "scratch-0-4",
                "label": "Train on labels 0-4 from scratch",
                "loss": [0.6849, 0.4106, 0.2225, 0.1077, 0.0778, 0.0364, 0.0299, 0.0174, 0.0121, 0.0096],
                "acc": [73.39, 85.99, 94.20, 99.19, 99.04, 99.80, 99.95, 99.95, 100.0, 100.0],
            },
            {
                "run": "finetune-5-9",
                "label": "Fine-tune fc on labels 5-9 (frozen conv)",
                "loss": [0.9825, 0.1441, 0.0731, 0.0459, 0.0370, 0.0310, 0.0267, 0.0233, 0.0206, 0.0188],
                "acc": [72.24, 97.24, 99.64, 99.88, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0],
            },
            {
                "run": "scratch-5-9",
                "label": "Train on labels 5-9 from scratch",
                "loss": [0.9347, 0.5948, 0.3053, 0.1346, 0.0528, 0.0281, 0.0169, 0.0121, 0.0092, 0.0072],
                "acc": [64.26, 80.17, 92.51, 98.80, 99.88, 99.92, 100.0, 100.0, 100.0, 100.0],
            },
            {
                "run": "finetune-0-4",
                "label": "Fine-tune fc on labels 0-4 (frozen conv)",
                "loss": [1.3431, 0.0576, 0.0028, 0.0017, 0.0014, 0.0012, 0.0011, 0.0010, 0.0009, 0.0009],
                "acc": [81.05, 97.88, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0],
            },
        ],
        "note": (
            "All numbers extracted from the archived winter-2025 notebook run "
            "(printed every 5 epochs for the STL-10 transfer study); nothing re-trained."
        ),
    }
    save_json(d / "curves.json", curves)
    log("cnn: curves.json from archived run")


CURATED_FIGS = [
    # (notebook key, cell, index into the cell's PNG outputs, name, panel, caption)
    ("hw1", 13, 2, "stereo_quiver4", "stereo", "Recovered surface normals (quiver), all four image/light pairs"),
    ("hw1", 13, 3, "stereo_wire4", "stereo", "Depth from Horn integration (wireframe), four-image solve"),
    ("hw1", 18, 0, "stereo_albedos", "stereo", "facedata albedo vs uniform-albedo maps"),
    ("hw1", 25, 0, "stereo_surface3d", "stereo", "The face heightmap as a 3-D surface with each albedo"),
    ("hw1", 31, 0, "stereo_normals", "stereo", "Surface normals computed from the heightmap"),
    ("hw1", 37, 0, "stereo_renders", "stereo", "Rendered Lambertian images: two albedos x three lightings"),
    ("hw2", 3, 2, "epi_gradmag", "epipolar", "Gradient magnitude of Geisel Library (Gaussian smooth + central differences)"),
    ("hw2", 9, 1, "epi_corners", "epipolar", "Corner detection on the course image pair (minor eigenvalue + NMS)"),
    ("hw2", 26, 1, "epi_matching", "epipolar", "Naive NCC matching between the warrior pair (R=120, threshold 0.6)"),
    ("hw2", 34, 0, "epi_dino0", "epipolar", "Epipolar lines in dino view 0 from the 8-point fundamental matrix"),
    ("hw2", 34, 1, "epi_dino1", "epipolar", "Epipolar lines in dino view 1"),
    ("hw2", 34, 4, "epi_warrior0", "epipolar", "Epipolar lines, warrior view 0 - the epipole sits inside the image"),
    ("hw3", 5, 0, "bow_samples", "bow", "A face and a non-face training example (133x200 grayscale)"),
    ("hw3", 7, 0, "bow_uniform", "bow", "Uniform grid interest-point sampling (200 points)"),
    ("hw3", 7, 1, "bow_sift", "bow", "SIFT keypoint sampling on the same face"),
    ("hw3", 22, 0, "bow_bayes_lik", "bow", "Class-conditional word-count histograms for the spam exercise"),
    ("hw3", 28, 0, "bow_bayes_post", "bow", "Posterior P(spam | word count) after applying the prior"),
    ("hw4", 5, 0, "cnn_samples", "cnn", "One FashionMNIST example per class"),
    ("hw4", 11, 0, "cnn_sgd", "cnn", "Small CNN on FashionMNIST: SGD, no dropout (test acc 0.900)"),
    ("hw4", 13, 0, "cnn_adam", "cnn", "Adam, no dropout (test acc 0.920)"),
    ("hw4", 16, 0, "cnn_sgd_vs_adam", "cnn", "Training loss: SGD vs Adam, both with dropout"),
    ("hw4", 16, 1, "cnn_batches", "cnn", "Adam + dropout at batch sizes 10 / 200 / 500"),
    ("hw4", 18, 0, "cnn_lr_nodrop", "cnn", "Learning-rate study, SGD without dropout (0.001 / 0.01 / 0.1)"),
    ("hw4", 18, 1, "cnn_lr_drop", "cnn", "Learning-rate study, SGD with dropout"),
    ("hw4", 32, 0, "cnn_stl_scratch", "cnn", "STL-10: training labels 0-4 from scratch"),
    ("hw4", 34, 0, "cnn_stl_transfer", "cnn", "STL-10: fine-tuning only the fc layer on labels 5-9"),
]

NB_PATHS = {
    "hw1": "hw1_photometric_stereo/cse152a_wi25_hw1.ipynb",
    "hw2": "hw2_epipolar_geometry/hw2_wi25.ipynb",
    "hw3": "hw3_face_detection/cse152a_wi25_hw3.ipynb",
    "hw4": "hw4_cnn_fashionmnist_stl10/cse152a_wi25_hw4.ipynb",
}


def prep_figures():
    import base64

    d = OUT / "figures"
    d.mkdir(exist_ok=True)
    nbs = {k: json.load(open(RAW / p, encoding="utf-8")) for k, p in NB_PATHS.items()}
    manifest = []
    for nb_key, cell, out_i, name, panel, caption in CURATED_FIGS:
        outputs = nbs[nb_key]["cells"][cell].get("outputs", [])
        pngs = [o for o in outputs if "image/png" in o.get("data", {})]
        if out_i >= len(pngs):
            raise RuntimeError(f"{nb_key} cell {cell}: only {len(pngs)} pngs, wanted index {out_i}")
        raw = base64.b64decode(pngs[out_i]["data"]["image/png"])
        img = Image.open(io.BytesIO(raw))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        if img.width > 1100:
            img = img.resize((1100, round(img.height * 1100 / img.width)), Image.LANCZOS)
        img.save(d / f"{name}.webp", quality=80)
        manifest.append(
            {
                "name": name,
                "panel": panel,
                "caption": caption,
                "w": img.width,
                "h": img.height,
                "src": f"/demos/vision/figures/{name}.webp",
            }
        )
    save_json(d / "figures.json", {"figures": manifest})
    total = sum(f.stat().st_size for f in d.glob("*.webp")) // 1024
    log(f"figures: {len(manifest)} webp, {total} KB total")


def prep_sources():
    """Code-cell extracts of the four notebooks for the Source drawer.

    The raw .ipynb files are multi-MB JSON blobs (hw2 is ~10 MB with embedded
    figures) - inlining them shiki-highlighted made the page HTML 17 MB and
    broke hydration. The drawer shows these small .py extracts instead.
    """
    src_dir = REPO / "demos" / "vision_src"
    src_dir.mkdir(exist_ok=True)
    for key, rel in NB_PATHS.items():
        nb = json.load(open(RAW / rel, encoding="utf-8"))
        lines = [
            f"# {Path(rel).name} - code cells extracted for the Source drawer.",
            "# CSE 152A (UCSD, winter 2025) course template + David's solutions;",
            "# outputs and embedded figures stripped (the originals live in demos/computer_vision_cse152_raw/).",
            "",
        ]
        for c in nb["cells"]:
            src = "".join(c["source"]).rstrip()
            if c["cell_type"] == "markdown":
                for ln in src.splitlines():
                    lines.append(("# " + ln).rstrip())
                lines.append("")
            elif src:
                lines.append(src)
                lines.append("")
        out = src_dir / f"{key}_extract.py"
        out.write_text("\n".join(lines), encoding="utf-8")
        log(f"sources: {out} ({out.stat().st_size // 1024} KB)")


def main():
    only = __import__("os").environ.get("VISION_PREP_ONLY", "")
    steps = {
        "stereo": prep_stereo,
        "epipolar": prep_epipolar,
        "bow": prep_bow,
        "cnn": prep_cnn,
        "figures": prep_figures,
        "sources": prep_sources,
    }
    for name, fn in steps.items():
        if only and name != only:
            continue
        fn()
    log("all done")


if __name__ == "__main__":
    main()
