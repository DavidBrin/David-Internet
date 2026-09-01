"""
ESP32 Thermal TinyML demo prep - the Python half (called by scripts/demos/esp32.ts).

  py -3.12 scripts/demos/esp32_prep.py <tinymlRaw> <fastapiRaw> <outDir> <repoRoot>

Builds the committed page assets and the fixtures the TS ports are tested against:

  public/demos/esp32/frames.json    ~500 anonymized frames (int16 quarter-degrees),
                                    contiguous per-contributor sequences with label
                                    transitions; student_id -> salted-hash prefix
                                    (salt is ephemeral, never written anywhere)
  public/demos/esp32/model.json     float weights from trained_model.keras + int8
                                    tensors/scales/zero-points from model.tflite +
                                    the deployed StandardScaler (scaler.npz)
  public/demos/esp32/training.json  per-fold curves from re-running the challenge-2
                                    training config (GroupKFold by student)
  public/demos/esp32/netmap.json    synthetic WiFi scans (seeded; no real SSIDs)
  public/demos/esp32/figures/*.webp ANALYSIS.md histogram + mislabeled figures
  tests/fixtures/esp32-features.json  frames -> 76-vectors via the real features.py
  tests/fixtures/esp32-net.json       scaled inputs -> keras float probs + TFLite
                                      int8 per-layer activations and outputs

ASCII-only prints (console is cp1252).
"""
import hashlib
import importlib.util
import json
import os
import random
import sys

import numpy as np

tinyml_raw, fastapi_raw, out_dir, repo_root = sys.argv[1:5]
fix_dir = os.path.join(repo_root, "tests", "fixtures")
os.makedirs(fix_dir, exist_ok=True)
os.makedirs(out_dir, exist_ok=True)

CH2 = os.path.join(tinyml_raw, "tech_assignment_challenge_2")
CH1 = os.path.join(tinyml_raw, "tech_assignment_challenge_1")
EXPLORER = os.path.join(fastapi_raw, "ta5_websocket_dataset_collection", "challenge2_dataset_explorer")


def log(msg):
    print(str(msg).encode("ascii", "replace").decode(), flush=True)


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
    log("%s: %.0f KB" % (os.path.relpath(path, repo_root), os.path.getsize(path) / 1024))


def load_module(name, path, extra_sys_path=None):
    if extra_sys_path:
        sys.path.insert(0, extra_sys_path)
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------- dataset

import pandas as pd  # noqa: E402

CSV = os.path.join(CH2, "thermal_dataset.csv")
PIXEL_COLS = ["pixel_%d" % i for i in range(64)]
df_all = pd.read_csv(CSV)
SALT = os.urandom(16).hex()  # ephemeral - a new salt every build, never persisted


def sid_hash(pid):
    return hashlib.sha256((SALT + str(pid)).encode()).hexdigest()[:8]


def prep_frames():
    """~500 frames: contiguous per-contributor runs that contain label transitions."""
    df = df_all
    runs = []  # (student_id, start_row, end_row) contiguous in file order
    cur_sid, cur_start = None, 0
    sids = df["student_id"].values
    for i in range(len(df) + 1):
        s = sids[i] if i < len(df) else None
        if s != cur_sid:
            if cur_sid is not None and i - cur_start >= 40:
                runs.append((cur_sid, cur_start, i))
            cur_sid, cur_start = s, i
    labels = (df["label"].values == "present").astype(int)

    def transitions(a, b):
        seg = labels[a:b]
        return int(np.sum(seg[1:] != seg[:-1]))

    # rank runs by transition count, keep variety of contributors
    runs.sort(key=lambda r: -transitions(r[1], r[2]))
    chosen = []
    used_sids = set()
    for sid, a, b in runs:
        if len(chosen) >= 5:
            break
        if sid in used_sids and len(chosen) < 3:
            continue
        # trim to at most 110 frames around the busiest stretch
        if b - a > 110:
            seg = labels[a:b]
            tr = np.where(seg[1:] != seg[:-1])[0]
            mid = int(tr.mean()) + a if len(tr) else (a + b) // 2
            a2 = max(a, mid - 55)
            b2 = min(b, a2 + 110)
            a, b = a2, b2
        chosen.append((sid, a, b))
        used_sids.add(sid)

    frames = []
    sequences = []
    n_present = 0
    for sid, a, b in chosen:
        h = sid_hash(sid)
        start = len(frames)
        for i in range(a, b):
            px = df.iloc[i][PIXEL_COLS].values.astype(float)
            lab = int(labels[i])
            n_present += lab
            frames.append({"p": [int(round(v * 4)) for v in px], "l": lab, "s": h})
        sequences.append({"sid": h, "start": start, "end": len(frames)})

    save_json(os.path.join(out_dir, "frames.json"), {
        "note": "Anonymized subset of the ECE 140 class thermal dataset. Temperatures are degC*4; sid is a salted-hash prefix (salt not retained).",
        "tempScale": 4,
        "frames": frames,
        "sequences": sequences,
        "stats": {"total": len(frames), "present": n_present, "empty": len(frames) - n_present},
    })
    return chosen


# ---------------------------------------------------------------- features fixture

def prep_features_fixture():
    feats = load_module("features_ch1", os.path.join(CH1, "scripts", "features.py"),
                        extra_sys_path=os.path.join(CH1, "scripts"))
    # 20 frames spread across the dataset, both labels
    idx = list(np.linspace(0, len(df_all) - 1, 20).astype(int))
    sub = df_all.iloc[idx].copy()
    X, y = feats.engineer_features(sub)
    cases = []
    for k, i in enumerate(idx):
        px = df_all.iloc[i][PIXEL_COLS].values.astype(float)
        cases.append({
            "px": [round(float(v), 4) for v in px],
            "features": [round(float(v), 6) for v in X[k]],
            "label": int(y[k]),
        })
    save_json(os.path.join(fix_dir, "esp32-features.json"), {"nFeatures": int(X.shape[1]), "cases": cases})


# ---------------------------------------------------------------- model.json + net fixture (TensorFlow)

def prep_model_and_net_fixture():
    import tensorflow as tf

    keras_path = os.path.join(CH2, "trained_model.keras")
    tflite_path = os.path.join(CH2, "model", "model.tflite")
    scaler = np.load(os.path.join(CH2, "scaler.npz"))
    mean, sc = scaler["mean"], scaler["scale"]

    model = tf.keras.models.load_model(keras_path)
    float_layers = []
    for layer in model.layers:
        w = layer.get_weights()
        if len(w) != 2:
            continue
        W, b = w  # W: (in, out)
        act = layer.get_config().get("activation", "linear")
        float_layers.append({
            "w": [[round(float(W[i, o]), 7) for i in range(W.shape[0])] for o in range(W.shape[1])],
            "b": [round(float(v), 7) for v in b],
            "activation": "relu" if act == "relu" else "sigmoid",
        })

    # Reference kernels, no XNNPACK: with a delegate active, preserve_all_tensors
    # hands back unfilled intermediate buffers (bit us on the first run).
    interp = tf.lite.Interpreter(
        model_path=tflite_path,
        experimental_preserve_all_tensors=True,
        experimental_op_resolver_type=tf.lite.experimental.OpResolverType.BUILTIN_WITHOUT_DEFAULT_DELEGATES,
    )
    interp.allocate_tensors()
    in_det = interp.get_input_details()[0]
    out_det = interp.get_output_details()[0]
    ops = interp._get_ops_details()  # private, stable enough for a build script
    tdet = {d["index"]: d for d in interp.get_tensor_details()}

    def quant(idx):
        s, z = tdet[idx]["quantization"]
        return {"scale": float(s), "zeroPoint": int(z)}

    fc_ops = [o for o in ops if o["op_name"] == "FULLY_CONNECTED"]
    assert len(fc_ops) == 3, "expected 3 FC ops, got %d" % len(fc_ops)
    quant_layers = []
    fc_out_idx = []
    for k, op in enumerate(fc_ops):
        t_in, t_w, t_b = op["inputs"][0], op["inputs"][1], op["inputs"][2]
        t_out = op["outputs"][0]
        fc_out_idx.append(int(t_out))
        Wq = interp.get_tensor(t_w)  # (out, in) int8
        bq = interp.get_tensor(t_b)  # int32
        # FC weights are per-output-channel quantized (symmetric): one scale per row
        wqp = tdet[t_w]["quantization_parameters"]
        w_scales = [float(s) for s in wqp["scales"]]
        assert len(w_scales) == Wq.shape[0], "per-channel scale count mismatch"
        assert all(int(z) == 0 for z in wqp["zero_points"]), "expected symmetric weights"
        quant_layers.append({
            "wq": [[int(v) for v in row] for row in Wq],
            "wScales": [round(s, 12) for s in w_scales],
            "bias": [int(v) for v in bq],
            "inQuant": quant(t_in),
            "outQuant": quant(t_out),
            "activation": "relu" if k < 2 else "none",
        })

    model_json = {
        "arch": [76, 32, 16, 1],
        "scalerMean": [round(float(v), 6) for v in mean],
        "scalerScale": [round(float(v), 6) for v in sc],
        "floatLayers": float_layers,
        "quantLayers": quant_layers,
        "inputQuant": quant(in_det["index"]),
        "outputQuant": quant(out_det["index"]),
        "tfliteBytes": os.path.getsize(tflite_path),
        "kerasBytes": os.path.getsize(keras_path),
    }
    save_json(os.path.join(out_dir, "model.json"), model_json)

    # --- net fixture: 50 frames through the real pipeline ---
    feats = load_module("features_ch2", os.path.join(CH2, "scripts", "features.py"),
                        extra_sys_path=os.path.join(CH2, "scripts"))
    idx = list(np.linspace(0, len(df_all) - 1, 50).astype(int))
    sub = df_all.iloc[idx].copy()
    X, y = feats.engineer_features(sub)
    Xs = ((X - mean) / sc).astype(np.float32)

    float_probs = model.predict(Xs, verbose=0).flatten()

    in_scale, in_zp = in_det["quantization"]
    cases = []
    for k in range(len(idx)):
        xq = np.clip(np.round(Xs[k] / in_scale) + in_zp, -128, 127).astype(np.int8)
        interp.set_tensor(in_det["index"], xq.reshape(1, -1))
        interp.invoke()
        layers_q = [[int(v) for v in interp.get_tensor(ti).flatten()] for ti in fc_out_idx]
        out_q = int(interp.get_tensor(out_det["index"]).flatten()[0])
        cases.append({
            "xScaled": [round(float(v), 6) for v in Xs[k]],
            "floatProb": round(float(float_probs[k]), 6),
            "inputQ": [int(v) for v in xq],
            "layersQ": layers_q,
            "outQ": out_q,
            "label": int(y[k]),
        })
    save_json(os.path.join(fix_dir, "esp32-net.json"), {"cases": cases})


# ---------------------------------------------------------------- training.json (TensorFlow)

def prep_training():
    import tensorflow as tf
    from sklearn.model_selection import GroupKFold
    from sklearn.preprocessing import StandardScaler

    tf.keras.utils.set_random_seed(140)
    train_mod = load_module("train_ch2", os.path.join(CH2, "scripts", "train.py"),
                            extra_sys_path=os.path.join(CH2, "scripts"))
    clean = load_module("clean_ch2", os.path.join(CH2, "scripts", "clean.py"))
    feats = load_module("features_ch2b", os.path.join(CH2, "scripts", "features.py"),
                        extra_sys_path=os.path.join(CH2, "scripts"))

    df_clean = clean.clean_data(CSV)
    X, y = feats.engineer_features(df_clean)
    groups = df_clean["student_id"].values

    gkf = GroupKFold(n_splits=5)
    folds = []
    for fold_i, (tr, va) in enumerate(gkf.split(X, y, groups)):
        scaler = StandardScaler()
        Xtr = scaler.fit_transform(X[tr])
        Xva = scaler.transform(X[va])
        m = train_mod.build_model(X.shape[1])
        cb = [
            tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=20, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=10, min_lr=1e-6),
        ]
        h = m.fit(Xtr, y[tr], validation_data=(Xva, y[va]), epochs=200, batch_size=32,
                  callbacks=cb, verbose=0)
        pred = (m.predict(Xva, verbose=0).flatten() > 0.5).astype(int)
        acc = float((pred == y[va]).mean())
        held = sorted({sid_hash(g) for g in groups[va]})
        folds.append({
            "acc": [round(float(v), 4) for v in h.history["accuracy"]],
            "valAcc": [round(float(v), 4) for v in h.history["val_accuracy"]],
            "loss": [round(float(v), 4) for v in h.history["loss"]],
            "valLoss": [round(float(v), 4) for v in h.history["val_loss"]],
            "heldOutAcc": round(acc, 4),
            "heldOutGroups": len(held),
            "heldOutSample": held[:6],
        })
        log("fold %d: %d epochs, held-out acc %.3f" % (fold_i, len(h.history["loss"]), acc))
    save_json(os.path.join(out_dir, "training.json"), {
        "config": "Dense 76-32-16-1, L2 0.005, adam, GroupKFold(5) by student, EarlyStopping(val_accuracy, 20), ReduceLROnPlateau",
        "samples": int(len(X)),
        "folds": folds,
    })


# ---------------------------------------------------------------- netmap.json

def prep_netmap():
    rng = random.Random(140)
    names = ["CoffeeShopGuest", "Lab-B240", "eduroamish", "HomeNet-5G", "printer-direct",
             "SmartTV-2.4", "IoT-Sensors", "Visitor-WiFi", "NAS-backhaul", "mesh-node-1",
             "mesh-node-2", "GarageCam", "DormFloor3", "PhoneHotspot"]
    channels24 = [1, 6, 11]
    channels5 = [36, 40, 44, 149, 153, 157]
    scans = []
    for scan_i in range(3):
        aps = []
        for i, ssid in enumerate(names):
            if scan_i > 0 and rng.random() < 0.2:
                continue  # APs come and go between rescans
            five = i % 3 == 0
            ch = rng.choice(channels5 if five else channels24)
            base = -35 - (i * 4) % 45
            aps.append({
                "ssid": ssid,
                "bssid": "02:%02X:%02X:%02X:%02X:%02X" % tuple(rng.randrange(256) for _ in range(5)),
                "channel": ch,
                "rssi": max(-92, min(-30, base + rng.randrange(-6, 7))),
                "band": "5GHz" if five else "2.4GHz",
            })
        scans.append(aps)
    save_json(os.path.join(out_dir, "netmap.json"), {
        "note": "Synthetic scan data - real SSIDs/BSSIDs would identify neighbors. Shape matches /get_netscan.",
        "scans": scans,
    })


# ---------------------------------------------------------------- figures

def prep_figures():
    from PIL import Image
    fig_dir = os.path.join(out_dir, "figures")
    os.makedirs(fig_dir, exist_ok=True)
    for name in ["histogram.png", "mislabeled_1.png", "mislabeled_2.png", "mislabeled_3.png"]:
        src = os.path.join(EXPLORER, name)
        if not os.path.exists(src):
            log("missing figure: %s" % name)
            continue
        img = Image.open(src).convert("RGB")
        if img.width > 900:
            img = img.resize((900, int(img.height * 900 / img.width)))
        dst = os.path.join(fig_dir, name.replace(".png", ".webp"))
        img.save(dst, "WEBP", quality=82)
        log("figures/%s: %.0f KB" % (os.path.basename(dst), os.path.getsize(dst) / 1024))


if os.environ.get("ESP32_PREP_ONLY_MODEL"):
    log("ESP32_PREP_ONLY_MODEL set - regenerating model.json / net fixture only")
    prep_model_and_net_fixture()
else:
    prep_frames()
    prep_features_fixture()
    prep_netmap()
    prep_figures()
    if os.environ.get("ESP32_PREP_SKIP_TF"):
        log("ESP32_PREP_SKIP_TF set - skipping model.json / net fixture / training.json")
    else:
        prep_model_and_net_fixture()
        prep_training()
log("prep complete")
