"""
Nocturnal Neuro demo prep — the Python half (called by scripts/demos/nocturnal.ts).

  py -3.12 scripts/demos/nocturnal_prep.py <rawDir> <outDir> <repoRoot>

1. EEG: HELLOworld.{vhdr,eeg} (Cognionics, 25 ch, 500 Hz, float32 multiplexed) → the 20
   EEG channels, DC removed, FIR-lowpassed and resampled to 250 Hz, int16 with a per-channel
   scale → eeg.bin + eeg.json.  The lowpass + resample is the notebook's unfinished
   "Signal Filtering" cell, completed (see demos/nocturnal_src/dsp.py).
2. Test fixture: reference outputs of the notebook's pipeline pieces on a 5 s slice, computed
   with SciPy, for the TypeScript ports → tests/fixtures/nocturnal-eeg.json
3. DigiKey order (xlsx, parsed from the sheet XML — openpyxl chokes on its styles) → order.json
4. Business canvases (PDF) → venture/*.webp
5. Schematic symbol positions (for hotspot placement) → sch/symbols.json

Never imports mne/neurodsp (the notebook's libraries): the header is trivial to read and
the FIR design is scipy.signal.firwin, which is what neurodsp calls.
"""
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

import numpy as np
from scipy.signal import coherence, firwin, resample, welch

raw_dir, out_dir, repo_root = sys.argv[1:4]

EEG_FS = 500
SHIP_FS = 250


def log(msg):
    msg = str(msg).encode("ascii", "replace").decode()
    print(f"[nocturnal/py] {msg}", flush=True)


# ---------------------------------------------------------------- EEG

def read_brainvision(vhdr_path):
    """Minimal BrainVision reader for the Cognionics export (float32, multiplexed)."""
    text = open(vhdr_path, encoding="utf-8").read()
    n_ch = int(re.search(r"NumberOfChannels=(\d+)", text).group(1))
    interval_us = int(re.search(r"SamplingInterval=(\d+)", text).group(1))
    assert "IEEE_FLOAT_32" in text and "MULTIPLEXED" in text
    chans = []
    for m in re.finditer(r"^ch(\d+)=([^,]*),([^,]*),([^,]*),(.*)$", text, re.M):
        chans.append({"name": m.group(2), "resolution": float(m.group(4)), "unit": m.group(5).strip()})
    imp = {}
    for m in re.finditer(r"^(\d+)\s+\t\s+(\S+)\s+\t\s+(\d+)\s+\t\s+(-?\d+)\s*$", text, re.M):
        imp[m.group(2)] = {"impedance_kohm": int(m.group(3)), "offset_mv": int(m.group(4))}
    data_file = os.path.join(os.path.dirname(vhdr_path), re.search(r"DataFile=(.*)", text).group(1).strip())
    raw = np.fromfile(data_file, dtype="<f4")
    n = raw.size // n_ch
    data = raw[: n * n_ch].reshape(n, n_ch).T.astype(np.float64)
    fs = 1e6 / interval_us
    return data, fs, chans, imp


def fir_lowpass(sig, fs, f_hi, n_seconds):
    """neurodsp.filt.filter_signal(sig, fs, 'lowpass', f_hi, n_seconds=…, remove_edges=False)."""
    filt_len = int(np.ceil(fs * n_seconds))
    if filt_len % 2 == 0:
        filt_len += 1
    coefs = firwin(filt_len, f_hi, fs=fs)
    return np.convolve(sig, coefs, mode="same"), coefs


def fir_bandstop(sig, fs, f_range, n_seconds):
    filt_len = int(np.ceil(fs * n_seconds))
    if filt_len % 2 == 0:
        filt_len += 1
    coefs = firwin(filt_len, f_range, fs=fs)
    return np.convolve(sig, coefs, mode="same"), coefs


def prep_eeg():
    vhdr = os.path.join(raw_dir, "eeg_recordings", "HELLOworld.vhdr")
    data, fs, chans, imp = read_brainvision(vhdr)
    assert fs == EEG_FS
    eeg_idx = [i for i, c in enumerate(chans) if c["unit"] == "uV"]
    names = [chans[i]["name"] for i in eeg_idx]
    x = data[eeg_idx] * 1e6  # V → µV (resolution field is 1e6)
    x = x - x.mean(axis=1, keepdims=True)  # the DC electrode offsets are up to ±0.6 V

    # The notebook cell, completed: lowpass at f_ds/2, then scipy resample to f_ds.
    n_out = int(round(x.shape[1] * SHIP_FS / fs))
    y = np.empty((x.shape[0], n_out))
    for i in range(x.shape[0]):
        low, _ = fir_lowpass(x[i], fs, SHIP_FS / 2, n_seconds=0.2)
        y[i] = resample(low, n_out)

    scales = np.abs(y).max(axis=1) / 32767.0
    scales = np.maximum(scales, 1e-6)
    q = np.round(y / scales[:, None]).astype("<i2")
    q.tofile(os.path.join(out_dir, "eeg.bin"))

    meta = {
        "source": "HELLOworld (Cognionics headset, BrainVision export), David's own recording, 2024-12-06",
        "fs": SHIP_FS,
        "originalFs": fs,
        "samples": n_out,
        "durationS": round(n_out / SHIP_FS, 3),
        "layout": "int16 little-endian, channel-major (channels × samples), value = raw × scale µV",
        "pipeline": "DC removed; FIR lowpass 125 Hz (Hamming, 0.2 s); scipy.signal.resample 500 → 250 Hz",
        "channels": [
            {
                "name": n,
                "scale": float(scales[i]),
                "impedanceKohm": imp.get(n, {}).get("impedance_kohm"),
                "offsetMv": imp.get(n, {}).get("offset_mv"),
            }
            for i, n in enumerate(names)
        ],
    }
    json.dump(meta, open(os.path.join(out_dir, "eeg.json"), "w"), indent=1)
    log(f"eeg: {len(names)} ch x {n_out} samples @ {SHIP_FS} Hz -> eeg.bin ({q.nbytes} B)")
    return q, scales, names


def prep_fixture(q, scales, names):
    """Reference outputs for the TS ports, computed on the shipped int16 data."""
    fs = SHIP_FS
    a, b = names.index("Fp2"), names.index("O1")
    s0, s1 = 10 * fs, 15 * fs
    xa = q[a, s0:s1].astype(np.float64) * scales[a]
    xb = q[b, s0:s1].astype(np.float64) * scales[b]

    low, low_coefs = fir_lowpass(xa, fs, fs / 4, n_seconds=0.2)  # 62.5 Hz for a 125 Hz target
    notch, notch_coefs = fir_bandstop(xa, fs, (58.0, 62.0), n_seconds=0.5)
    f_w, p_w = welch(xa, fs=fs, nperseg=256)
    f_c, cxy = coherence(xa, xb, fs=fs, nperseg=256)

    fx = {
        "fs": fs,
        "channels": ["Fp2", "O1"],
        "slice": [s0, s1],
        "xa": xa.round(4).tolist(),
        "xb": xb.round(4).tolist(),
        "lowpass": {"fHi": fs / 4, "nSeconds": 0.2, "coefs": low_coefs.tolist(), "y": low.round(4).tolist()},
        "bandstop": {"fRange": [58.0, 62.0], "nSeconds": 0.5, "coefs": notch_coefs.tolist(), "y": notch.round(4).tolist()},
        "welch": {"nperseg": 256, "f": f_w.tolist(), "p": p_w.tolist()},
        "coherence": {"nperseg": 256, "f": f_c.tolist(), "cxy": cxy.tolist()},
    }
    fdir = os.path.join(repo_root, "tests", "fixtures")
    os.makedirs(fdir, exist_ok=True)
    json.dump(fx, open(os.path.join(fdir, "nocturnal-eeg.json"), "w"))
    log("fixture: tests/fixtures/nocturnal-eeg.json")


# ---------------------------------------------------------------- DigiKey order

def prep_order():
    path = os.path.join(raw_dir, "kicad_ganglion_pcb", "DigiKey_orderedParts.xlsx")
    z = zipfile.ZipFile(path)
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    T = "{%s}t" % ns["m"]
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", ns):
            shared.append("".join(x.text or "" for x in si.iter(T)))
    rows = []
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    for row in sheet.iter("{%s}row" % ns["m"]):
        vals = []
        for c in row.findall("m:c", ns):
            v = c.find("m:v", ns)
            if v is None:
                isv = c.find("m:is", ns)
                vals.append("".join(x.text or "" for x in isv.iter(T)) if isv is not None else "")
            else:
                vals.append(shared[int(v.text)] if c.get("t") == "s" else v.text)
        if any(vals):
            rows.append(vals)
    header, body = rows[0], rows[1:]
    # header: #, QUANTITY, PART NUMBER, MANUFACTURER PART NUMBER, DESCRIPTION, CUSTOMER REFERENCE, BACKORDER, UNIT PRICE, EXTENDED PRICE
    # (rows have the empty CUSTOMER REFERENCE cell omitted)
    lines = []
    for r in body:
        if len(r) == 8:
            idx, qty, dkpn, mpn, desc, back, unit, ext = r
        else:
            idx, qty, dkpn, mpn, desc, _cref, back, unit, ext = r[:9]
        lines.append(
            {
                "line": int(idx),
                "qty": int(qty),
                "digikey": dkpn,
                "mpn": mpn,
                "description": desc,
                "unit": float(unit),
                "extended": float(ext),
            }
        )
    total = round(sum(l["extended"] for l in lines), 2)
    json.dump({"lines": lines, "total": total, "currency": "USD"}, open(os.path.join(out_dir, "order.json"), "w"), indent=1)
    log(f"order: {len(lines)} lines, ${total}")


# ---------------------------------------------------------------- canvases

def prep_venture():
    import pypdfium2 as pdfium
    from PIL import Image

    src = os.path.join(raw_dir, "business")
    dst = os.path.join(out_dir, "venture")
    os.makedirs(dst, exist_ok=True)
    files = {
        "bmc": "NocturnalNeuro_businessModelCanvas_11-21-24.pdf",
        "vpc": "NNeuro_Value_Proposition_Canvas-11-25-24.pdf",
        "empathy": "NNeuro_Empathy_Map_11-25-24.pdf",
    }
    out = {}
    for key, name in files.items():
        doc = pdfium.PdfDocument(os.path.join(src, name))
        page = doc[0]
        w, h = page.get_size()
        scale = 1400 / w
        img = page.render(scale=scale).to_pil().convert("RGB")
        p = os.path.join(dst, f"{key}.webp")
        img.save(p, "WEBP", quality=78, method=6)
        out[key] = {"file": f"venture/{key}.webp", "width": img.width, "height": img.height, "bytes": os.path.getsize(p)}
        log(f"venture: {key} {img.width}x{img.height} {os.path.getsize(p)} B")
    json.dump(out, open(os.path.join(dst, "index.json"), "w"), indent=1)


# ---------------------------------------------------------------- schematic symbols

def sexpr_blocks(text, head):
    """Yield the text of every top-level "(<head>" block (paren-matched, string-aware)."""
    i = 0
    needle = "\n\t(" + head
    while True:
        j = text.find(needle, i)
        if j < 0:
            return
        k = j + 1
        depth = 0
        in_str = False
        while True:
            c = text[k]
            if in_str:
                if c == "\\":
                    k += 1
                elif c == '"':
                    in_str = False
            elif c == '"':
                in_str = True
            elif c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    break
            k += 1
        yield text[j + 1 : k + 1]
        i = k


def prep_symbols():
    kdir = os.path.join(raw_dir, "kicad_ganglion_pcb")
    sheets = {
        "root": "Ganglion_PCB.kicad_sch",
        "sensors": "Ganglion_Sensors_01.kicad_sch",
        "references": "References.kicad_sch",
        "tvs": "TVS.kicad_sch",
    }
    out = {}
    for key, fn in sheets.items():
        text = open(os.path.join(kdir, fn), encoding="utf-8").read()
        paper = re.search(r'\(paper "([^"]+)"(?: ([\d.]+) ([\d.]+))?', text)
        syms = []
        for blk in sexpr_blocks(text, "symbol"):
            m = re.match(r'\(symbol\s*\(lib_name "[^"]*"\)?\s*\(lib_id "([^"]+)"\)\s*\(at ([-\d.]+) ([-\d.]+)(?: ([-\d.]+))?\)', blk)
            if not m:
                m2 = re.search(r'\(lib_id "([^"]+)"\)\s*\(at ([-\d.]+) ([-\d.]+)(?: ([-\d.]+))?\)', blk)
                if not m2:
                    continue
                m = m2
            ref = re.search(r'\(property "Reference" "([^"]+)"', blk)
            val = re.search(r'\(property "Value" "([^"]+)"', blk)
            if not ref or ref.group(1).startswith("#"):
                continue
            syms.append(
                {
                    "ref": ref.group(1),
                    "value": val.group(1) if val else "",
                    "lib": m.group(1),
                    "x": float(m.group(2)),
                    "y": float(m.group(3)),
                    "rot": float(m.group(4) or 0),
                }
            )
        out[key] = {"file": fn, "paper": paper.group(1) if paper else None, "symbols": syms}
        log(f"symbols: {key} {len(syms)}")
    os.makedirs(os.path.join(out_dir, "sch"), exist_ok=True)
    json.dump(out, open(os.path.join(out_dir, "sch", "symbols.json"), "w"), indent=1)


if __name__ == "__main__":
    os.makedirs(out_dir, exist_ok=True)
    q, scales, names = prep_eeg()
    prep_fixture(q, scales, names)
    prep_order()
    prep_venture()
    prep_symbols()
