"""Cross-Teaching Segmentation demo prep.

Runs the REAL trained checkpoints from DavidBrin/Semi-supervised-image-model
(the Oxford-IIIT Pet redesign of the DTU 02456 Group 9 project) over a fixed
set of held-out test images and ships everything the page needs:

  pets        - fixed test images: inputs (webp), GT trimaps at 512/224 (png)
  predict     - predictions + confidence maps for all 4 checkpoints + the two
                logit-averaged ensembles; per-image metrics via the repo's own
                compute_metrics formulas (recomputed from the SHIPPED quantized
                assets, so the page and the tests see identical numbers)
  attention   - ViT attention rollout sprites (196 patch tiles per image)
  activations - U-Net ResNet-34 encoder stage heatmaps
  microct     - normalized micro-CT slices + otsu-binarized masks from the
                original Group 9 repo (public on GitHub)
  curves      - the real training histories (metrics JSONs committed next to
                the checkpoints) + final eval CSV + the report's numbers
  ladder      - DTU course notebook extracts, lecture diagrams, half-moon data
  sources     - vendored copies of the repo's .py files for the Source drawer
  fixtures    - tests/fixtures/crossteach-core.json for the TS ports

Inputs (never modified): demos/cross_teaching_segmentation_raw/,
demos/dtu_deep_learning_notebooks_raw/, and the two GitHub clones under
.cache/crossteach/ (checkpoints via Git LFS). TFDS data in .cache/tfds.

Usage: py -3.12 crossteach_prep.py <demosRawRoot> <outDir> <repoRoot>
Env: CROSSTEACH_PREP_ONLY=<step> to run one step.
"""

from __future__ import annotations

import io
import json
import os
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.stdout.reconfigure(errors="replace")

RAW_ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("demos")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("public/demos/crossteach")
REPO = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(".")

RAW_CT = RAW_ROOT / "cross_teaching_segmentation_raw"
RAW_DTU = RAW_ROOT / "dtu_deep_learning_notebooks_raw"
CACHE = REPO / ".cache" / "crossteach"
IMODEL = CACHE / "Semi-supervised-image-model"
MICRO = CACHE / "Semi-supervised-Microtomography-Segmentation"
SRC_OUT = REPO / "demos" / "crossteach_src"
FIXTURES = REPO / "tests" / "fixtures"

os.environ.setdefault("TFDS_DATA_DIR", str(REPO / ".cache" / "tfds"))

# The 12 held-out TFDS test images the page ships (deterministic order,
# shuffle_files=False). Spread across the split.
TEST_INDICES = [3, 58, 142, 305, 481, 700, 902, 1288, 1704, 2266, 2841, 3418]
ATTN_IDS = [0, 3, 6, 9]  # positions in TEST_INDICES that get attention/activation extras
UNET_SIZE = 512
VIT_SIZE = 224
NUM_CLASSES = 3
CONF_THRESHOLD = 0.75  # the redesign's image-level gate

MODELS = ["unet_sup", "unet_ct", "vit_sup", "vit_ct"]
CKPTS = {
    "unet_sup": "unet_oxford_pet.pth",
    "unet_ct": "unet_cross_teaching_best.pth",
    "vit_sup": "vit_oxford_pet.pth",
    "vit_ct": "vit_cross_teaching_best.pth",
}


def log(msg: str) -> None:
    print(f"[crossteach_prep] {msg}")


def save_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
    log(f"wrote {path.name} ({path.stat().st_size // 1024} KB)")


# ---------------------------------------------------------------------------
# Mirrors of the repo's code (CrossTeachingTraining.py / data_oxford_pet.py at
# https://github.com/DavidBrin/Semi-supervised-image-model, HEAD 2026-03).
# Kept in sync by the fixture tests; arch definitions must match the
# checkpoints' state-dict keys exactly.
# ---------------------------------------------------------------------------

def trimap_to_classes(mask: np.ndarray) -> np.ndarray:
    """TFDS trimap 1,2,3 -> class indices 0=pet, 1=background, 2=boundary."""
    return np.clip(mask.astype(np.int64) - 1, 0, NUM_CLASSES - 1)


def resize_pair(image_u8: np.ndarray, mask_u8: np.ndarray, size: int):
    im = Image.fromarray(image_u8).resize((size, size), Image.BILINEAR)
    mk = Image.fromarray(mask_u8.astype(np.uint8)).resize((size, size), Image.NEAREST)
    img = np.asarray(im, dtype=np.float32) / 255.0
    return img, trimap_to_classes(np.asarray(mk))


def compute_metrics(pred: np.ndarray, target: np.ndarray) -> dict:
    """The repo's compute_metrics, on label maps (macro dice/iou + pixel acc)."""
    pixel_acc = float((pred == target).mean())
    dice_scores, iou_scores = [], []
    for cls in range(NUM_CLASSES):
        p = (pred == cls).astype(np.float64)
        t = (target == cls).astype(np.float64)
        inter = float((p * t).sum())
        ps, ts = float(p.sum()), float(t.sum())
        union = ps + ts - inter
        dice_scores.append((2.0 * inter + 1e-6) / (ps + ts + 1e-6))
        iou_scores.append((inter + 1e-6) / (union + 1e-6))
    return {
        "dice": float(np.mean(dice_scores)),
        "iou": float(np.mean(iou_scores)),
        "pixelAccuracy": pixel_acc,
    }


def build_models(which: str):
    """Construct the exact architectures the checkpoints were saved from."""
    import torch
    import torch.nn as nn
    import timm
    import segmentation_models_pytorch as smp

    if which.startswith("unet"):
        return smp.Unet(
            encoder_name="resnet34", encoder_weights=None, in_channels=3,
            classes=NUM_CLASSES, activation=None,
        )

    class ViTSegmentationHead(nn.Module):
        def __init__(self, embed_dim=768, num_classes=NUM_CLASSES):
            super().__init__()
            self.decoder = nn.Sequential(
                nn.ConvTranspose2d(embed_dim, 512, kernel_size=2, stride=2),
                nn.BatchNorm2d(512), nn.ReLU(inplace=True),
                nn.ConvTranspose2d(512, 256, kernel_size=2, stride=2),
                nn.BatchNorm2d(256), nn.ReLU(inplace=True),
                nn.ConvTranspose2d(256, 128, kernel_size=2, stride=2),
                nn.BatchNorm2d(128), nn.ReLU(inplace=True),
                nn.ConvTranspose2d(128, 64, kernel_size=2, stride=2),
                nn.BatchNorm2d(64), nn.ReLU(inplace=True),
                nn.Conv2d(64, num_classes, kernel_size=1),
            )

        def forward(self, x):
            x = x[:, 1:, :]
            b, n, c = x.shape
            hw = int(n ** 0.5)
            x = x.transpose(1, 2).reshape(b, c, hw, hw)
            return self.decoder(x)

    class ViTSegmentation(nn.Module):
        def __init__(self):
            super().__init__()
            self.backbone = timm.create_model(
                "vit_base_patch16_224", pretrained=False, num_classes=0, img_size=VIT_SIZE,
            )
            self.seg_head = ViTSegmentationHead(embed_dim=self.backbone.embed_dim)

        def forward(self, x):
            feats = self.backbone.forward_features(x)
            return self.seg_head(feats)

    return ViTSegmentation()


def load_checkpoint(model, name: str):
    import torch

    path = IMODEL / "checkpoints" / CKPTS[name]
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    sd = ckpt["model_state_dict"] if isinstance(ckpt, dict) and "model_state_dict" in ckpt else ckpt
    missing, unexpected = model.load_state_dict(sd, strict=False)
    # timm may add buffers the old checkpoints lack; anything beyond that is a bug.
    bad = [k for k in missing if "attn_mask" not in k] + list(unexpected)
    if bad:
        raise RuntimeError(f"{name}: state dict mismatch: {bad[:8]}")
    model.eval()
    log(f"loaded {name} from {path.name}")
    return model


# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

def prep_pets():
    import tensorflow_datasets as tfds

    ds, info = tfds.load("oxford_iiit_pet", split="test", shuffle_files=False, with_info=True)
    breed_names = info.features["label"].names
    wanted = set(TEST_INDICES)
    picked = {}
    for i, ex in enumerate(tfds.as_numpy(ds)):
        if i in wanted:
            picked[i] = ex
        if len(picked) == len(wanted):
            break

    (OUT / "input").mkdir(parents=True, exist_ok=True)
    (OUT / "gt").mkdir(parents=True, exist_ok=True)
    npz = {}
    manifest = []
    for pos, tfds_i in enumerate(TEST_INDICES):
        ex = picked[tfds_i]
        img_raw = ex["image"]
        mask_raw = ex["segmentation_mask"].squeeze(-1)
        img512, gt512 = resize_pair(img_raw, mask_raw, UNET_SIZE)
        img224, gt224 = resize_pair(img_raw, mask_raw, VIT_SIZE)
        iid = f"img{pos:02d}"
        Image.fromarray((img512 * 255).astype(np.uint8)).save(OUT / "input" / f"{iid}.webp", quality=82)
        Image.fromarray(gt512.astype(np.uint8), "L").save(OUT / "gt" / f"{iid}_512.png", optimize=True)
        Image.fromarray(gt224.astype(np.uint8), "L").save(OUT / "gt" / f"{iid}_224.png", optimize=True)
        npz[f"{iid}_512"] = img512
        npz[f"{iid}_224"] = img224
        npz[f"{iid}_gt512"] = gt512.astype(np.uint8)
        npz[f"{iid}_gt224"] = gt224.astype(np.uint8)
        manifest.append({
            "id": iid,
            "tfdsIndex": tfds_i,
            "breed": breed_names[int(ex["label"])].replace("_", " "),
        })
    CACHE.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(CACHE / "prep_pets.npz", **npz)
    save_json(CACHE / "prep_images.json", manifest)
    total = sum(f.stat().st_size for f in (OUT / "input").glob("*.webp")) // 1024
    log(f"pets: {len(manifest)} images, inputs {total} KB")


def _forward_all(model, npz, size: int):
    """Run one model over all shipped images; return {id: logits float16 [3,H,W]}."""
    import torch

    out = {}
    with torch.no_grad():
        for pos in range(len(TEST_INDICES)):
            iid = f"img{pos:02d}"
            img = npz[f"{iid}_{size}"]
            x = torch.from_numpy(img).permute(2, 0, 1).unsqueeze(0).float()
            logits = model(x)[0].numpy().astype(np.float16)
            out[iid] = logits
    return out


def prep_predict():
    import torch
    import torch.nn.functional as tF

    npz = np.load(CACHE / "prep_pets.npz")
    images = json.loads((CACHE / "prep_images.json").read_text(encoding="utf-8"))

    all_logits = {}
    for name in MODELS:
        model = load_checkpoint(build_models(name), name)
        size = UNET_SIZE if name.startswith("unet") else VIT_SIZE
        all_logits[name] = _forward_all(model, npz, size)
        del model
        log(f"predict: {name} done")

    for sub in ["pred", "conf", "ens"]:
        for name in (MODELS if sub != "ens" else ["sup", "ct"]):
            (OUT / sub / name).mkdir(parents=True, exist_ok=True)

    def softmax(logits: np.ndarray) -> np.ndarray:
        z = logits.astype(np.float64)
        z = z - z.max(axis=0, keepdims=True)
        e = np.exp(z)
        return e / e.sum(axis=0, keepdims=True)

    manifest = []
    for pos, meta in enumerate(images):
        iid = meta["id"]
        entry = {**meta, "models": {}, "ensembles": {}}
        for name in MODELS:
            size = UNET_SIZE if name.startswith("unet") else VIT_SIZE
            logits = all_logits[name][iid]
            probs = softmax(logits)
            pred = probs.argmax(axis=0).astype(np.uint8)
            conf_u8 = np.round(probs.max(axis=0) * 255).astype(np.uint8)
            Image.fromarray(pred, "L").save(OUT / "pred" / name / f"{iid}.png", optimize=True)
            Image.fromarray(conf_u8, "L").save(OUT / "conf" / name / f"{iid}.png", optimize=True)
            # metrics/gate from the QUANTIZED shipped assets (what the page sees)
            gt = npz[f"{iid}_gt{size}"]
            m = compute_metrics(pred.astype(np.int64), gt.astype(np.int64))
            gate_conf = float(np.round((conf_u8.astype(np.float64) / 255.0).mean(), 6))
            entry["models"][name] = {
                **{k: round(v, 4) for k, v in m.items()},
                "imageConfidence": round(gate_conf, 4),
                "gatePasses": gate_conf >= CONF_THRESHOLD,
            }
        # ensembles: evolved evaluate_ensemble averages LOGITS at U-Net size
        for tag, (un, vn) in {"sup": ("unet_sup", "vit_sup"), "ct": ("unet_ct", "vit_ct")}.items():
            ul = torch.from_numpy(all_logits[un][iid].astype(np.float32)).unsqueeze(0)
            vl = torch.from_numpy(all_logits[vn][iid].astype(np.float32)).unsqueeze(0)
            vl = tF.interpolate(vl, size=(UNET_SIZE, UNET_SIZE), mode="bilinear", align_corners=False)
            el = ((ul + vl) / 2.0)[0].numpy()
            pred = el.argmax(axis=0).astype(np.uint8)
            Image.fromarray(pred, "L").save(OUT / "ens" / tag / f"{iid}.png", optimize=True)
            gt = npz[f"{iid}_gt512"]
            m = compute_metrics(pred.astype(np.int64), gt.astype(np.int64))
            entry["ensembles"][tag] = {k: round(v, 4) for k, v in m.items()}
        manifest.append(entry)
        log(f"predict: {iid} u_sup={entry['models']['unet_sup']['dice']:.3f} "
            f"u_ct={entry['models']['unet_ct']['dice']:.3f} "
            f"v_sup={entry['models']['vit_sup']['dice']:.3f} v_ct={entry['models']['vit_ct']['dice']:.3f}")

    save_json(OUT / "predictions.json", {
        "confThreshold": CONF_THRESHOLD,
        "unetSize": UNET_SIZE,
        "vitSize": VIT_SIZE,
        "note": "Held-out TFDS test images run through the repo's exact eval code path; during training the cross-teaching exchange ran on the unlabeled 80% of the train split.",
        "images": manifest,
    })
    # keep logits for the fixture step
    np.savez_compressed(CACHE / "prep_logits.npz", **{
        f"{name}_{iid}": all_logits[name][iid]
        for name in MODELS for iid in all_logits[name]
    })
    total = sum(f.stat().st_size for f in OUT.rglob("*.png")) // 1024
    log(f"predict: total png {total} KB")


def prep_attention():
    import torch

    npz = np.load(CACHE / "prep_pets.npz")
    model = load_checkpoint(build_models("vit_ct"), "vit_ct")

    captured = []

    def hook(_m, _i, output):
        captured.append(output.detach())

    handles = []
    for blk in model.backbone.blocks:
        blk.attn.fused_attn = False
        handles.append(blk.attn.attn_drop.register_forward_hook(hook))

    (OUT / "attention").mkdir(parents=True, exist_ok=True)
    manifest = []
    with torch.no_grad():
        for pos in ATTN_IDS:
            iid = f"img{pos:02d}"
            captured.clear()
            x = torch.from_numpy(npz[f"{iid}_224"]).permute(2, 0, 1).unsqueeze(0).float()
            model(x)
            if len(captured) != 12:
                raise RuntimeError(f"attention hooks captured {len(captured)} layers")
            n_tokens = captured[0].shape[-1]  # 197
            rollout = torch.eye(n_tokens)
            for attn in captured:
                a = attn[0].mean(dim=0)  # avg heads [197,197]
                a = a + torch.eye(n_tokens)
                a = a / a.sum(dim=-1, keepdim=True)
                rollout = a @ rollout
            r = rollout.numpy()
            side = int((n_tokens - 1) ** 0.5)  # 14
            sprite = np.zeros((side * side, side * side), dtype=np.uint8)
            for p in range(n_tokens - 1):
                tile = r[p + 1, 1:].reshape(side, side)
                tile = tile - tile.min()
                mx = tile.max()
                if mx > 0:
                    tile = tile / mx
                ty, tx = divmod(p, side)
                sprite[ty * side:(ty + 1) * side, tx * side:(tx + 1) * side] = np.round(tile * 255)
            Image.fromarray(sprite, "L").save(OUT / "attention" / f"{iid}.png", optimize=True)
            # CLS rollout: where the class token looks
            cls = r[0, 1:].reshape(side, side)
            cls = (cls - cls.min()) / max(cls.max() - cls.min(), 1e-12)
            Image.fromarray(np.round(cls * 255).astype(np.uint8), "L").save(
                OUT / "attention" / f"{iid}_cls.png", optimize=True)
            manifest.append({"id": iid, "grid": side})
    for h in handles:
        h.remove()
    save_json(OUT / "attention" / "attention.json", {"images": manifest, "layers": 12, "heads": 12})
    log(f"attention: {len(manifest)} sprites")


def prep_activations():
    import torch

    npz = np.load(CACHE / "prep_pets.npz")
    model = load_checkpoint(build_models("unet_ct"), "unet_ct")
    enc = model.encoder
    stages = {"conv1": enc.conv1, "layer1": enc.layer1, "layer2": enc.layer2,
              "layer3": enc.layer3, "layer4": enc.layer4}
    grabbed = {}
    handles = [m.register_forward_hook(lambda _m, _i, o, k=k: grabbed.__setitem__(k, o.detach()))
               for k, m in stages.items()]

    (OUT / "act").mkdir(parents=True, exist_ok=True)
    manifest = []
    with torch.no_grad():
        for pos in ATTN_IDS:
            iid = f"img{pos:02d}"
            grabbed.clear()
            x = torch.from_numpy(npz[f"{iid}_512"]).permute(2, 0, 1).unsqueeze(0).float()
            model(x)
            entry = {"id": iid, "stages": []}
            for k in stages:
                a = grabbed[k][0].abs().mean(dim=0).numpy()
                a = (a - a.min()) / max(a.max() - a.min(), 1e-12)
                im = Image.fromarray(np.round(a * 255).astype(np.uint8), "L").resize((128, 128), Image.BILINEAR)
                im.save(OUT / "act" / f"{iid}_{k}.png", optimize=True)
                entry["stages"].append({"name": k, "hw": int(grabbed[k].shape[-1]), "ch": int(grabbed[k].shape[1])})
            manifest.append(entry)
    for h in handles:
        h.remove()
    save_json(OUT / "act" / "activations.json", {"images": manifest})
    log(f"activations: {len(manifest)} images x {len(stages)} stages")


def _otsu(values: np.ndarray) -> float:
    hist, edges = np.histogram(values, bins=256)
    centers = (edges[:-1] + edges[1:]) / 2
    total = hist.sum()
    best_t, best_var = centers[0], -1.0
    w0 = np.cumsum(hist)
    w1 = total - w0
    s0 = np.cumsum(hist * centers)
    s_all = s0[-1]
    with np.errstate(divide="ignore", invalid="ignore"):
        m0 = s0 / w0
        m1 = (s_all - s0) / w1
        var = w0 * w1 * (m0 - m1) ** 2
    var = np.nan_to_num(var, nan=-1.0)
    k = int(np.argmax(var))
    return float(centers[k])


def prep_microct():
    slices = ["00", "07", "14"]
    (OUT / "microct").mkdir(parents=True, exist_ok=True)
    manifest = []
    for k in slices:
        img = np.asarray(Image.open(MICRO / "Data" / "Original Images" / f"image_v2_{k}.tif"), dtype=np.float64)
        msk = np.asarray(Image.open(MICRO / "Data" / "Original Masks" / f"image_v2_mask_{k}.tif"), dtype=np.float64)
        lo, hi = np.percentile(img, [0.5, 99.5])
        disp = np.clip((img - lo) / max(hi - lo, 1e-12), 0, 1)
        Image.fromarray((disp * 255).astype(np.uint8), "L").resize((512, 512), Image.BILINEAR).save(
            OUT / "microct" / f"slice{k}.webp", quality=85)
        t = _otsu(msk.ravel())
        binary = msk > t
        # pore = minority class (the report segments pores against background)
        pore = binary if binary.mean() < 0.5 else ~binary
        Image.fromarray((pore * 255).astype(np.uint8), "L").resize((512, 512), Image.NEAREST).save(
            OUT / "microct" / f"mask{k}.png", optimize=True)
        manifest.append({"id": k, "poreFraction": round(float(pore.mean()), 4)})
        log(f"microct: slice {k} pore fraction {pore.mean():.3f}")
    save_json(OUT / "microct" / "microct.json", {
        "slices": manifest,
        "source": "github.com/DavidBrin/Semi-supervised-Microtomography-Segmentation (22 labeled slices, 22 nm resolution X-ray micro-tomography)",
        "report": {
            "labeled": 22, "unlabeled": 172,
            "dice": {"unetSupervised": 0.49, "vitSupervised": 0.89, "unetCrossTeaching": 0.97, "vitCrossTeaching": 0.99},
            "note": "Dice scores from the Group 9 report (Project_21_Group_9.pdf, table 1 prose); the ensemble lands slightly below the cross-taught ViT.",
        },
    })


def prep_curves():
    ck = IMODEL / "checkpoints"
    unet = json.loads((ck / "unet_metrics.json").read_text(encoding="utf-8"))
    vit = json.loads((ck / "vit_metrics.json").read_text(encoding="utf-8"))
    cross = json.loads((ck / "cross_teaching_metrics.json").read_text(encoding="utf-8"))
    reeval = json.loads((ck / "cross_teaching_checkpoint_eval.json").read_text(encoding="utf-8"))
    csv_path = next((IMODEL / "results").glob("evaluation_results_*.csv"))
    rows = [r.split(",") for r in csv_path.read_text(encoding="utf-8").strip().splitlines()]
    final_eval = [
        {"model": r[0], "dice": float(r[1]), "iou": float(r[2]), "pixelAccuracy": float(r[3])}
        for r in rows[1:]
    ]
    save_json(OUT / "curves.json", {
        "unetSupervised": unet,
        "vitSupervised": vit,
        "crossTeaching": cross,
        "checkpointReEval": reeval,
        "finalEval": {"file": csv_path.name, "rows": final_eval},
        "config": {
            "labeledFraction": 0.2, "valFraction": 0.1, "epochs": 8, "batchSize": 4,
            "lr": 1e-4, "confidenceThreshold": 0.75, "consistencyWeight": 0.05,
            "warmupEpochs": 2, "unetSize": 512, "vitSize": 224,
            "note": "Oxford-Pet redesign config (repo HEAD). The report-era micro-CT run used per-pixel confidence masks at 0.9 and consistency weight 0.5 over 30 epochs.",
        },
    })
    # the report-era 30-epoch training figure
    img = Image.open(RAW_CT / "30epoch.png")
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    if img.width > 1100:
        img = img.resize((1100, round(img.height * 1100 / img.width)), Image.LANCZOS)
    img.save(OUT / "report30epoch.webp", quality=80)
    log("curves: histories + final eval + report figure")


LADDER_NOTEBOOKS = [
    ("3.2 Automatic differentiation.ipynb", "autodiff"),
    ("3.3 FFN Half Moon.ipynb", "ffn_halfmoon"),
    ("3.4 FFN MNIST.ipynb", "ffn_mnist"),
    ("4.1 CNN Introduction.ipynb", "cnn_intro"),
    ("4.2 CNN CIFAR-10.ipynb", "cnn_cifar10"),
    ("4.3 CNN transfer.ipynb", "cnn_transfer"),
    ("5.1 Recurrent Neural Networks.ipynb", "rnn"),
    ("7.1 autoencoder.ipynb", "autoencoder"),
    ("7.2 variational autoencoder.ipynb", "vae"),
    ("7.3 generative adversarial networks.ipynb", "gan"),
]


def prep_ladder():
    # notebook code extracts for the Source drawer (NEVER ship .ipynb - see playbook)
    lad_src = SRC_OUT / "ladder"
    lad_src.mkdir(parents=True, exist_ok=True)
    for fname, key in LADDER_NOTEBOOKS:
        nb = json.loads((RAW_DTU / fname).read_text(encoding="utf-8"))
        lines = [
            f"# {fname} - code cells + exercise text extracted for the Source drawer.",
            "# DTU 02456 Deep Learning (fall 2025) course notebook with David's solutions;",
            "# outputs stripped (originals in demos/dtu_deep_learning_notebooks_raw/).",
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
        out = lad_src / f"{key}_extract.py"
        out.write_text("\n".join(lines), encoding="utf-8")
        log(f"ladder: {out.name} ({out.stat().st_size // 1024} KB)")

    # lecture diagrams
    (OUT / "ladder").mkdir(parents=True, exist_ok=True)
    for fname, key in [("Attention in RNN.png", "attention_rnn"),
                       ("Dot-prod-components.png", "dot_product"),
                       ("Transformer Layer.png", "transformer_layer")]:
        img = Image.open(RAW_DTU / fname)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        if img.width > 900:
            img = img.resize((900, round(img.height * 900 / img.width)), Image.LANCZOS)
        img.save(OUT / "ladder" / f"{key}.webp", quality=80)

    # half-moon dataset for the live TS FFN card
    from sklearn.datasets import make_moons

    X, y = make_moons(n_samples=240, noise=0.25, random_state=42)
    X = (X - X.mean(axis=0)) / X.std(axis=0)
    save_json(OUT / "ladder" / "halfmoon.json", {
        "x": [[round(float(a), 4), round(float(b), 4)] for a, b in X],
        "y": [int(v) for v in y],
    })
    log("ladder: diagrams + halfmoon")


def prep_sources():
    repo_src = SRC_OUT / "repo"
    repo_src.mkdir(parents=True, exist_ok=True)
    for f in ["CrossTeachingTraining.py", "CrossDetection.py", "data_oxford_pet.py",
              "Unet_TransferLearn.py", "ViT_train.py", "comparison_utils.py"]:
        shutil.copyfile(IMODEL / f, repo_src / f)
        log(f"sources: vendored {f} ({(repo_src / f).stat().st_size // 1024} KB)")


def prep_fixtures():
    npz = np.load(CACHE / "prep_pets.npz")
    logits = np.load(CACHE / "prep_logits.npz")

    def png_labels(rel: str) -> np.ndarray:
        return np.asarray(Image.open(OUT / rel), dtype=np.int64)

    cases = []
    for iid in ["img00", "img05"]:
        for name in ["unet_ct", "vit_ct"]:
            size = UNET_SIZE if name.startswith("unet") else VIT_SIZE
            pred = png_labels(f"pred/{name}/{iid}.png")
            gt = npz[f"{iid}_gt{size}"].astype(np.int64)
            r0 = size // 2 - 32
            pc = pred[r0:r0 + 64, r0:r0 + 64]
            gc = gt[r0:r0 + 64, r0:r0 + 64]
            cases.append({
                "name": f"{name}/{iid}",
                "pred": pc.tolist(),
                "gt": gc.tolist(),
                "expected": compute_metrics(pc, gc),
            })

    gates = []
    preds_manifest = json.loads((OUT / "predictions.json").read_text(encoding="utf-8"))
    for entry in preds_manifest["images"][:6]:
        for name in MODELS:
            conf = np.asarray(Image.open(OUT / f"conf/{name}/{entry['id']}.png"), dtype=np.float64) / 255.0
            gates.append({
                "name": f"{name}/{entry['id']}",
                "mean": round(float(conf.mean()), 6),
                "passes": bool(round(float(conf.mean()), 6) >= CONF_THRESHOLD),
            })

    # ensemble: logit averaging on a rounded 16x16 crop (quantize-then-fixture)
    ens_cases = []
    import torch
    import torch.nn.functional as tF
    for iid in ["img02"]:
        ul = logits[f"unet_ct_{iid}"].astype(np.float32)
        vl = torch.from_numpy(logits[f"vit_ct_{iid}"].astype(np.float32)).unsqueeze(0)
        vl = tF.interpolate(vl, size=(UNET_SIZE, UNET_SIZE), mode="bilinear", align_corners=False)[0].numpy()
        r0 = 240
        uc = np.round(ul[:, r0:r0 + 16, r0:r0 + 16].astype(np.float64), 4)
        vc = np.round(vl[:, r0:r0 + 16, r0:r0 + 16].astype(np.float64), 4)
        avg = (uc + vc) / 2.0
        ens_cases.append({
            "name": iid,
            "unetLogits": uc.tolist(),
            "vitLogits": vc.tolist(),
            "expectedArgmax": avg.argmax(axis=0).tolist(),
        })

    FIXTURES.mkdir(parents=True, exist_ok=True)
    save_json(FIXTURES / "crossteach-core.json", {
        "threshold": CONF_THRESHOLD,
        "metrics": cases,
        "gates": gates,
        "ensemble": ens_cases,
    })


def main():
    only = os.environ.get("CROSSTEACH_PREP_ONLY", "")
    steps = {
        "pets": prep_pets,
        "predict": prep_predict,
        "attention": prep_attention,
        "activations": prep_activations,
        "microct": prep_microct,
        "curves": prep_curves,
        "ladder": prep_ladder,
        "sources": prep_sources,
        "fixtures": prep_fixtures,
    }
    for name, fn in steps.items():
        if only and name != only:
            continue
        log(f"--- {name} ---")
        fn()
    log("all done")


if __name__ == "__main__":
    main()
