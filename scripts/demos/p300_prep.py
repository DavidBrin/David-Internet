# -*- coding: ascii -*-
"""P300 Speller demo prep (run via scripts/demos/p300.ts -> py -3.12).

argv: rawRoot (demos/), outDir (public/demos/p300), repoRoot.

No dataset and no training: the BCI Competition III .mat files and trained
models were never archived. This prep
  1. compresses the three README figures to WebP,
  2. packages the notebooks' committed results (subject B runs) into results.json,
  3. builds head.json: the BCI2000 64-channel montage (approximate 10-20
     positions), every electrode subset the CNN family used, and 10
     ILLUSTRATIVE first-layer spatial filters (no checkpoint was archived),
  4. extracts notebook code cells into demos/p300_src/ for the Source drawer
     (never ship .ipynb into the drawer) and vendors magician/cnn2a.py,
  5. writes tests/fixtures/p300-decode.json by running the notebook's own
     letter-decoding functions (copied verbatim below) on seeded inputs, so the
     TS port in src/demos/p300/core/decode.ts is fixture-tested.

Console is cp1252: ASCII-only prints.
"""
import json
import math
import os
import random
import sys

import numpy as np
from PIL import Image

RAW = os.path.join(sys.argv[1], "p300_speller_bci_raw")
OUT = sys.argv[2]
REPO = sys.argv[3]
SRC_DIR = os.path.join(REPO, "demos", "p300_src")
FIX_DIR = os.path.join(REPO, "tests", "fixtures")

# ---------------------------------------------------------------- 1. images

def prep_images():
    jobs = [
        ("images/p300-experiment.jpg", "experiment.webp", 82),
        ("images/cnn-architecture.png", "cnn-architecture.webp", 90),
        ("images/speller-system.png", "speller-system.webp", 90),
    ]
    for rel, name, q in jobs:
        im = Image.open(os.path.join(RAW, rel)).convert("RGB")
        dst = os.path.join(OUT, name)
        im.save(dst, "WEBP", quality=q, method=6)
        print("image %s %d KB" % (name, os.path.getsize(dst) // 1024))

# ---------------------------------------------------------------- 2. results
# All values are the committed notebook outputs (subject B runs; the notebooks
# archive exactly one run each). Sources noted per entry.

RESULTS = {
    "subject": "B",
    "note": "Committed notebook outputs, subject B (each notebook archives exactly one run). "
            "Weighted window accuracy: test samples reweighted so the 5:1 noP300/P300 imbalance "
            "does not inflate the score.",
    "binary": [  # model, weighted test accuracy (%), channels label, source cell
        {"model": "CNN1", "acc": 79.03, "channels": "all 64", "desc": "base model, class-weighted training"},
        {"model": "CNN2a", "acc": 76.20, "channels": "8 prefixed", "desc": "the classic P300 sites: Fz Cz Pz P3 P4 PO7 PO8 Oz"},
        {"model": "CNN2b", "acc": 77.31, "channels": "8 learned", "desc": "8 electrodes read off CNN1's first-layer weights"},
        {"model": "CNN2c (O)", "acc": 75.31, "channels": "occipital lobe", "desc": "the archived CNN2c run uses the occipital subset"},
        {"model": "CNN3", "acc": 73.73, "channels": "all 64", "desc": "single spatial filter in layer 1"},
        {"model": "MCNN1", "acc": 78.78, "channels": "all 64", "desc": "5x CNN1 on balanced subsets, votes averaged"},
        {"model": "MCNN2", "acc": 79.56, "channels": "all 64", "desc": "5x CNN1 on contiguous subsets (temporality kept)"},
        {"model": "MCNN3", "acc": 79.33, "channels": "all 64", "desc": "3x CNN1, full trainset, different random inits"},
    ],
    "mcnnMembers": {
        "MCNN1": [76.30, 77.77, 78.21, 76.94, 77.38],
        "MCNN2": [75.16, 75.45, 71.84, 72.14, 78.78],
        "MCNN3": [78.54, 78.63, 80.09],
    },
    # P300speller.ipynb, MCNN1 / subject B: character accuracy per repetition count.
    "spellerCurve": [37, 51, 63, 71, 76, 83, 87, 89, 88, 93, 93, 94, 94, 93, 93],
    "spellerModel": "MCNN1",
    "wordTrue": "MERMIROOMUHJPXJOHUVLEORZP3GLOO7AUFDKEFTWEOOALZOP9ROCGZET1Y19EWX65QUYU7NAK_4YCJDVDNGQXODBEV2B5EFDIDNR",
    "wordPred": "MERMIROOMUZJPXJOHUVLQORZQ3GLOO7CUFFKEFTWEOOALZOP9ROCGZE11Y19CWX65QUYU7NAK_4YCJDVDNGQXODBEV2B5EFDIDNR",
}

def prep_results():
    with open(os.path.join(OUT, "results.json"), "w") as f:
        json.dump(RESULTS, f, indent=1)
    mism = sum(1 for a, b in zip(RESULTS["wordTrue"], RESULTS["wordPred"]) if a != b)
    assert len(RESULTS["wordTrue"]) == 100 and len(RESULTS["wordPred"]) == 100
    print("results.json written; word mismatches at 15 reps: %d/100" % mism)

# ---------------------------------------------------------------- 3. head map
# BCI2000 64-channel montage in dataset channel order (verified: the CNN2a
# indices [10,33,48,50,52,55,59,61] land exactly on Fz Cz Pz P3 P4 PO7 PO8 Oz).
MONTAGE = [
    "FC5", "FC3", "FC1", "FCz", "FC2", "FC4", "FC6",
    "C5", "C3", "C1", "Cz", "C2", "C4", "C6",
    "CP5", "CP3", "CP1", "CPz", "CP2", "CP4", "CP6",
    "Fp1", "Fpz", "Fp2",
    "AF7", "AF3", "AFz", "AF4", "AF8",
    "F7", "F5", "F3", "F1", "Fz", "F2", "F4", "F6", "F8",
    "FT7", "FT8", "T7", "T8", "T9", "T10", "TP7", "TP8",
    "P7", "P5", "P3", "P1", "Pz", "P2", "P4", "P6", "P8",
    "PO7", "PO3", "POz", "PO4", "PO8",
    "O1", "Oz", "O2", "Iz",
]

POS = {
    "FC5": (-0.62, 0.27), "FC3": (-0.40, 0.29), "FC1": (-0.19, 0.30), "FCz": (0.0, 0.31),
    "FC2": (0.19, 0.30), "FC4": (0.40, 0.29), "FC6": (0.62, 0.27),
    "C5": (-0.72, 0.0), "C3": (-0.48, 0.0), "C1": (-0.24, 0.0), "Cz": (0.0, 0.0),
    "C2": (0.24, 0.0), "C4": (0.48, 0.0), "C6": (0.72, 0.0),
    "CP5": (-0.62, -0.27), "CP3": (-0.40, -0.29), "CP1": (-0.19, -0.30), "CPz": (0.0, -0.31),
    "CP2": (0.19, -0.30), "CP4": (0.40, -0.29), "CP6": (0.62, -0.27),
    "Fp1": (-0.28, 0.91), "Fpz": (0.0, 0.95), "Fp2": (0.28, 0.91),
    "AF7": (-0.55, 0.78), "AF3": (-0.27, 0.75), "AFz": (0.0, 0.73), "AF4": (0.27, 0.75), "AF8": (0.55, 0.78),
    "F7": (-0.77, 0.55), "F5": (-0.60, 0.53), "F3": (-0.42, 0.52), "F1": (-0.21, 0.51), "Fz": (0.0, 0.51),
    "F2": (0.21, 0.51), "F4": (0.42, 0.52), "F6": (0.60, 0.53), "F8": (0.77, 0.55),
    "FT7": (-0.90, 0.29), "FT8": (0.90, 0.29),
    "T7": (-0.95, 0.0), "T8": (0.95, 0.0), "T9": (-1.08, 0.0), "T10": (1.08, 0.0),
    "TP7": (-0.90, -0.29), "TP8": (0.90, -0.29),
    "P7": (-0.77, -0.55), "P5": (-0.60, -0.53), "P3": (-0.42, -0.52), "P1": (-0.21, -0.51), "Pz": (0.0, -0.51),
    "P2": (0.21, -0.51), "P4": (0.42, -0.52), "P6": (0.60, -0.53), "P8": (0.77, -0.55),
    "PO7": (-0.55, -0.78), "PO3": (-0.27, -0.75), "POz": (0.0, -0.73), "PO4": (0.27, -0.75), "PO8": (0.55, -0.78),
    "O1": (-0.28, -0.91), "Oz": (0.0, -0.95), "O2": (0.28, -0.91), "Iz": (0.0, -1.08),
}

SUBSETS = {  # 0-based channel indices, straight from the notebooks
    "cnn2a": [10, 33, 48, 50, 52, 55, 59, 61],
    "cnn2b_A": [10, 14, 17, 50, 55, 57, 59, 60],
    "cnn2b_B": [17, 50, 55, 56, 57, 58, 59, 60],
    "F": [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37],
    "C": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    "P": [15, 16, 17, 18, 19, 48, 49, 50, 51, 52],
    "O": [55, 56, 57, 58, 59, 60, 61, 62],
    "LT": [14, 38, 40, 44, 46, 47],
    "RT": [20, 39, 41, 45, 53, 54],
}

def prep_head():
    rng = np.random.default_rng(42)
    xy = np.array([POS[n] for n in MONTAGE])
    filters = []
    for fi in range(10):
        if fi == 0:
            # make the first filter P300-plausible: centro-parietal hotspot
            hot = [(POS["Pz"], 1.0), (POS["Cz"], 0.7)]
        else:
            k = int(rng.integers(1, 4))
            hot = [((float(rng.uniform(-0.9, 0.9)), float(rng.uniform(-0.95, 0.95))),
                    float(rng.uniform(-1, 1))) for _ in range(k)]
        w = np.zeros(len(MONTAGE))
        for (hx, hy), amp in hot:
            d2 = (xy[:, 0] - hx) ** 2 + (xy[:, 1] - hy) ** 2
            w += amp * np.exp(-d2 / (2 * 0.35 ** 2))
        m = np.max(np.abs(w))
        if m > 0:
            w = w / m
        filters.append([round(float(v), 3) for v in w])
    head = {
        "names": MONTAGE,
        "pos": {n: [POS[n][0], POS[n][1]] for n in MONTAGE},
        "subsets": SUBSETS,
        "filters": filters,
        "filtersNote": "ILLUSTRATIVE weights (seeded random smooth maps; filter 1 seeded centro-parietal). "
                       "No trained checkpoint was archived; these show what the kernel-size-1 spatial "
                       "convolution reads, not what CNN1 learned.",
        "posNote": "Approximate 10-20 layout; montage order verified against the repo's CNN2a index mapping.",
    }
    with open(os.path.join(OUT, "head.json"), "w") as f:
        json.dump(head, f)
    print("head.json written (%d electrodes, %d subsets, 10 illustrative filters)" % (len(MONTAGE), len(SUBSETS)))

# ---------------------------------------------------------------- 4. sources

def extract_notebook(nb_rel, out_name, header_lines):
    nb = json.load(open(os.path.join(RAW, nb_rel), encoding="utf-8"))
    lines = list(header_lines) + [""]
    for c in nb["cells"]:
        src = "".join(c["source"]).rstrip()
        if c["cell_type"] == "markdown":
            for ln in src.splitlines():
                lines.append(("# " + ln).rstrip())
            lines.append("")
        elif src:
            lines.append(src)
            lines.append("")
    out = os.path.join(SRC_DIR, out_name)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print("source %s %d KB" % (out_name, os.path.getsize(out) // 1024))

def prep_sources():
    os.makedirs(SRC_DIR, exist_ok=True)
    common = ("# From the open-source p300-speller project by Manuel Carzaniga and Lorenzo",
              "# Gualniera (github.com/Manucar/p300-speller), the codebase archived and studied",
              "# on Triton Neurotech's ML team. Code cells extracted for the Source drawer;",
              "# outputs and embedded figures stripped (originals in demos/p300_speller_bci_raw/).")
    extract_notebook("notebook-scripts/P300speller.ipynb", "p300speller_extract.py",
                     ("# P300speller.ipynb: the speller pipeline: windows -> CNN scores -> letter.",) + common)
    extract_notebook("notebook-scripts/CNN1.ipynb", "cnn1_extract.py",
                     ("# CNN1.ipynb: the base 5-layer 1D CNN on all 64 electrodes.",) + common)
    extract_notebook("notebook-scripts/MCNN1.ipynb", "mcnn1_extract.py",
                     ("# MCNN1.ipynb: ensemble of five CNN1s on balanced subsets.",) + common)
    # vendor cnn2a.py unchanged
    with open(os.path.join(RAW, "magician", "cnn2a.py"), encoding="utf-8") as f:
        body = f.read()
    with open(os.path.join(SRC_DIR, "cnn2a.py"), "w", encoding="utf-8", newline="\n") as f:
        f.write(body)
    print("source cnn2a.py vendored")

# ---------------------------------------------------------------- 5. fixture
# The decoding functions below are copied (near) verbatim from P300speller.ipynb
# so the fixture is the Python original's behavior, not a reimplementation.

import string as _string
_s = _string.ascii_uppercase + "123456789_"
list_matrix = []
for _i in range(6):
    list_matrix.append([_s[_j] for _j in range(_i, 36, 6)])
for _i in range(6):
    list_matrix.append([_s[_j] for _j in range(_i * 6, _i * 6 + 6)])

def sort_predictions(predictions, stimulus):
    sorted_pred = [0 for _ in range(12)]
    for index in range(12):
        sorted_pred[int(stimulus[index]) - 1] = predictions[index]
    return sorted_pred

def mean_predictions(predictions, stimulus, n_epoch):
    epoch_matrix = []
    for epoch in range(1, n_epoch + 1):
        pred = predictions[12 * (epoch - 1):12 * epoch]
        stim = stimulus[12 * (epoch - 1):12 * epoch]
        epoch_matrix.append(sort_predictions(pred, stim))
    return np.array(epoch_matrix).mean(axis=0)

def round_argmax(sorted_pred):
    adjust_cols = [0 for _ in range(6)]
    adjust_rows = [0 for _ in range(6)]
    sortcols = list(sorted_pred[:6]); sortcols.sort()
    sortrows = list(sorted_pred[6:]); sortrows.sort()
    for i in range(6):
        if sorted_pred[i] == sortcols[-1]:
            adjust_cols[i] = 1
    for i in range(6):
        if sorted_pred[6 + i] == sortrows[-1]:
            adjust_rows[i] = 1
    return adjust_cols + adjust_rows

def check_letter(x, y):
    if ((1 <= x <= 6) and (1 <= y <= 6)) or ((7 <= x <= 12) and (7 <= y <= 12)):
        return None
    list1 = list_matrix[x - 1]
    list2 = list_matrix[y - 1]
    for c in list1:
        if c in list2:
            return c
    return None

def check_intersect(list_colrow):
    intersect = []
    for x in range(len(list_colrow) - 1):
        for y in range(x + 1, len(list_colrow)):
            tmp = check_letter(list_colrow[x], list_colrow[y])
            if tmp:
                intersect.append(tmp)
    return intersect

def char_predictions(sorted_pred):
    list_flash = [i + 1 for i in range(12) if sorted_pred[i] == 1]
    return check_intersect(list_flash)

def dict_predictions(predictions, stimulus, n_epoch, A=1, B=0):
    dict_char = {}
    for epoch in range(1, n_epoch + 1):
        pred = predictions[12 * (epoch - 1):12 * epoch]
        stim = stimulus[12 * (epoch - 1):12 * epoch]
        round_pred = round_argmax(sort_predictions(pred, stim))
        list_flash = [i + 1 for i in range(12) if round_pred[i] == 1]
        intersect = check_intersect(list_flash)
        for inter in intersect:
            add = A * (1 / len(intersect)) + B * ((epoch + 1) / n_epoch)
            dict_char[inter] = dict_char.get(inter, 0) + add
    return dict_char

def break_ties_det(word_pred, dict_pred):
    """random.choice replaced by first-element choice; fixture cases are built
    so the pool always has exactly one element (continuous scores -> no ties)."""
    max_occ = 0
    letters = []
    results = []
    for letter in word_pred:
        if letter in dict_pred:
            letters.append(letter)
            if dict_pred[letter] > max_occ:
                max_occ = dict_pred[letter]
    if max_occ > 0:
        for letter in letters:
            if dict_pred[letter] == max_occ:
                results.append(letter)
    pool = results if results else list(word_pred)
    assert len(pool) >= 1
    return pool[0], len(pool)

def prep_fixture():
    os.makedirs(FIX_DIR, exist_ok=True)
    rng = np.random.default_rng(7)
    cases = []
    for ci in range(30):
        n_epoch = int(rng.integers(1, 16))
        stimulus = []
        for _ in range(n_epoch):
            stimulus.extend(list(rng.permutation(np.arange(1, 13))))
        predictions = [round(float(v), 4) for v in rng.random(12 * n_epoch)]
        stimulus = [int(v) for v in stimulus]
        mean = mean_predictions(predictions, stimulus, n_epoch)
        rounded = round_argmax(list(mean))
        word_pred = char_predictions(rounded)
        dictp = dict_predictions(predictions, stimulus, n_epoch)
        letter, pool_len = break_ties_det(word_pred, dictp)
        cases.append({
            "nEpoch": n_epoch,
            "predictions": predictions,
            "stimulus": stimulus,
            "mean": [round(float(v), 6) for v in mean],
            "rounded": [int(v) for v in rounded],
            "candidates": word_pred,
            "dict": {k: round(v, 6) for k, v in sorted(dictp.items())},
            "letter": letter,
            "poolLen": pool_len,
        })
    # a couple of hand cases exercising ties in round_argmax / multi-candidates
    tie_sorted = [0.9, 0.9, 0.1, 0.1, 0.1, 0.1, 0.2, 0.8, 0.8, 0.2, 0.2, 0.2]
    hand = {
        "sorted": tie_sorted,
        "rounded": round_argmax(tie_sorted),
        "candidates": char_predictions(round_argmax(tie_sorted)),
    }
    fx = {"cases": cases, "hand": hand,
          "note": "Generated by scripts/demos/p300_prep.py running the notebook's own decoding "
                  "functions; break_ties pools are singletons by construction (poolLen asserts it)."}
    out = os.path.join(FIX_DIR, "p300-decode.json")
    with open(out, "w") as f:
        json.dump(fx, f)
    n_single = sum(1 for c in cases if c["poolLen"] == 1)
    print("fixture p300-decode.json: %d cases (%d singleton pools), hand tie case candidates=%s"
          % (len(cases), n_single, hand["candidates"]))

ONLY = os.environ.get("P300_PREP_ONLY", "").split(",") if os.environ.get("P300_PREP_ONLY") else None
STEPS = [("images", prep_images), ("results", prep_results), ("head", prep_head),
         ("sources", prep_sources), ("fixture", prep_fixture)]
for name, fn in STEPS:
    if ONLY and name not in ONLY:
        continue
    fn()
print("p300 prep done")
