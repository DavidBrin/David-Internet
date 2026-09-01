# -*- coding: ascii -*-
"""Anatomy of a Spike demo prep (03).

Usage: py -3.12 spikes_prep.py <rawDir> <outDir> <repoRoot>

Data source: DANDI:001776 (Primate Cell Type Database, CC-BY-4.0) - the public
home of the primate patch-clamp NWB files the original spike_proj analysis used.
NWB files are cached under <repo>/.cache/spikes_nwb/ (gitignored; downloaded on
first run, one file per subject).

Pipeline (faithful to spike_proj's monkey_df):
  Spike(thresh_amp=0, window_length=(5., 5.), smooth_frac=.01).fit(sig_mV, fs)
using the real spikeparam package from demos/spikeparam_raw/, with fs read from
each NWB sweep (the modern files are 50 kHz) and volts converted to mV.

Outputs:
  public/demos/spikes/sweeps.json     4 trimmed sweeps (int16 mV*100, base64) + stim
  public/demos/spikes/waveforms.json  windowed spikes (int16 mV*100), 2x-decimated
  public/demos/spikes/features.json   per-spike feature rows + subject metadata
  public/demos/spikes/meta.json       provenance (dandiset, files, settings)
  public/demos/spikes/figures/*.webp  curated figures from stats_from_allMonkeyDFs_filt
  tests/fixtures/spikes-fit.json      full fit fixtures on the shipped sweeps
  tests/fixtures/spikes-skg.json      skewed-gaussian model fixture + fitted params

Env: SPIKES_PREP_ONLY=figures|assets  to run a subset; SPIKES_MAX_FILES=N.
"""
import sys, os, io, json, base64, contextlib

import numpy as np

RAW, OUT, REPO = sys.argv[1], sys.argv[2], sys.argv[3]
FIXDIR = os.path.join(REPO, "tests", "fixtures")
CACHE = os.environ.get("SPIKES_NWB_CACHE", os.path.join(REPO, ".cache", "spikes_nwb"))
os.makedirs(os.path.join(OUT, "figures"), exist_ok=True)
os.makedirs(FIXDIR, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

sys.path.insert(0, os.path.join(RAW, "..", "spikeparam_raw"))
os.environ.setdefault("MPLBACKEND", "Agg")

DANDISET = "001776"
MAX_FILES = int(os.environ.get("SPIKES_MAX_FILES", "10"))

def log(*a):
    print(*a, flush=True)

# ---------------------------------------------------------------- download
def ensure_files():
    have = sorted(f for f in os.listdir(CACHE) if f.endswith(".nwb"))
    if len(have) >= MAX_FILES:
        return [os.path.join(CACHE, f) for f in have[:MAX_FILES]]
    from dandi.dandiapi import DandiAPIClient
    import collections
    c = DandiAPIClient()
    ds = c.get_dandiset(DANDISET)
    by = collections.defaultdict(list)
    for a in ds.get_assets():
        by[a.path.split("/")[0]].append(a)
    subs = sorted(by.keys())
    chosen = subs[:: max(1, len(subs) // MAX_FILES)][:MAX_FILES]
    out = []
    for s in chosen:
        a = min(by[s], key=lambda x: x.size)
        p = os.path.join(CACHE, os.path.basename(a.path))
        if not os.path.exists(p):
            log(f"downloading {a.path} ({round(a.size/1e6,1)} MB)")
            a.download(p)
        out.append(p)
    return sorted(set(out + [os.path.join(CACHE, f) for f in have]))[:MAX_FILES]

# ---------------------------------------------------------------- NWB reading
def read_nwb(path):
    import h5py
    with h5py.File(path, "r") as f:
        subj = {k: f["general"]["subject"][k][...].item().decode()
                for k in f["general"]["subject"].keys()}
        sweeps = {}
        for k in f["acquisition"].keys():
            g = f["acquisition"][k]
            rate = float(g["starting_time"].attrs["rate"])
            unit = g["data"].attrs.get("unit", "volts")
            data = g["data"][:].astype(np.float64)
            if isinstance(unit, bytes):
                unit = unit.decode()
            if unit == "volts":
                data = data * 1000.0
            stim = None
            if k in f.get("stimulus", {}).get("presentation", {}):
                stim = f["stimulus"]["presentation"][k]["data"][:].astype(np.float64)
            sweeps[k] = (data, rate, stim)
    return subj, sweeps

# ---------------------------------------------------------------- fitting
def fit_sweep(sig_mV, fs):
    """Run the real spikeparam pipeline exactly as spike_proj did."""
    from spikeparam.patch.fit import Spike
    sp = Spike(thresh_amp=0, window_length=(5., 5.), smooth_frac=.01)
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            sp.fit(sig_mV, fs, n_jobs=1)
    except ValueError:
        return None
    if sp.n_spikes is None or sp.df_features is None:
        return None
    return sp

def q16(arr_mV):
    """mV -> int16 at 0.01 mV resolution."""
    q = np.clip(np.round(np.asarray(arr_mV) * 100.0), -32768, 32767).astype("<i2")
    return q

def b64i16(q):
    return base64.b64encode(q.tobytes()).decode()

def trim_window(sig, fs, stim):
    """Trim to the stimulus pulse (or the densest spike region) +- margin."""
    n = len(sig)
    if stim is not None and np.any(stim != 0):
        nz = np.nonzero(stim)[0]
        a, b = nz[0], nz[-1]
    else:
        a, b = 0, n - 1
    a = max(0, int(a - 0.25 * fs))
    b = min(n, int(b + 0.75 * fs))
    return a, b

def main_assets(files):
    features = []
    waveforms = []          # decimated x2 windows for the population panel
    ship_sweeps = []
    fixture_spikes = []
    file_meta = []
    subj_seen = {}
    n_wave_cap = 1400

    for fi, path in enumerate(files):
        name = os.path.basename(path)
        subj, sweeps = read_nwb(path)
        sid = subj.get("subject_id", f"S{fi}")
        subj_seen[sid] = subj
        log(f"[{fi+1}/{len(files)}] {name} subject={sid} sweeps={len(sweeps)}")
        n_from_file = 0
        for sk in sorted(sweeps.keys(), key=lambda s: int(s.split("_")[-1])):
            sig, fs, stim = sweeps[sk]
            if len(sig) < fs * 0.5:
                continue
            # quick pre-check: any overshoot?
            if sig.max() < 0:
                continue
            a, b = trim_window(sig, fs, stim)
            seg = sig[a:b]
            # quantize exactly as shipped, then fit the dequantized segment so
            # fixtures and features match what the browser recomputes
            segq = q16(seg).astype(np.float64) / 100.0
            sp = fit_sweep(segq, fs)
            if sp is None or sp.n_spikes < 1:
                continue
            df = sp.df_features
            ok = ~np.isin(np.arange(sp.n_spikes), sp.inds_error)
            for i in range(sp.n_spikes):
                if not ok[i]:
                    continue
                row = {
                    "file": name.split("_ses-")[0].replace("sub-", ""),
                    "subject": sid,
                    "sweep": sk,
                    "spike": i,
                    "peakInd": int(sp.spike_inds[i]),
                }
                for c in ["ramp_amp", "inflection_time", "inflection_amp", "peak_amp",
                          "peak_width", "peak_sharpness", "exp_lambda", "exp_const", "isi",
                          "r_squared_ramp", "r_squared_exp"]:
                    v = df.iloc[i][c] if c in df.columns else None
                    row[c] = None if v is None or not np.isfinite(v) else round(float(v), 5)
                row["exp_amp"] = round(float(sp.exp_amp[i]), 5)
                if len(waveforms) < n_wave_cap:
                    row["wf"] = len(waveforms)
                    waveforms.append(b64i16(q16(sp.spikes[i][::2])))
                features.append(row)
                n_from_file += 1
            # pick shippable sweeps: medium spike counts, first two files
            if len(ship_sweeps) < 4 and 4 <= sp.n_spikes <= 60 and (b - a) <= fs * 2.5:
                stim_seg = stim[a:b] if stim is not None else None
                ship = {
                    "id": f"{sid}/{sk}",
                    "subject": sid,
                    "file": name,
                    "fs": fs,
                    "n": len(segq),
                    "mv_q": b64i16(q16(seg)),
                    "stim_pA": None if stim_seg is None else
                        np.round(stim_seg * 1e12, 1)[::50].tolist(),
                    "nSpikes": int(sp.n_spikes),
                }
                ship_sweeps.append(ship)
                # fixture: full expected outputs for this sweep
                fixture_spikes.append({
                    "sweep": ship["id"],
                    "fs": fs,
                    "spikeInds": sp.spike_inds.tolist(),
                    "indices": sp.indices.tolist(),
                    "rampPoly": sp.ramp_poly_params.tolist(),
                    "rampAmp": sp.ramp_amp.tolist(),
                    "inflectionTime": sp.inflection_time.tolist(),
                    "inflectionAmp": sp.inflection_amp.tolist(),
                    "peakAmp": sp.peak_amp.tolist(),
                    "peakWidth": sp.peak_width.tolist(),
                    "peakSharpness": sp.peak_sharpness.tolist(),
                    "expAmp": sp.exp_amp.tolist(),
                    "expLambda": sp.exp_lambda.tolist(),
                    "expConst": sp.exp_const.tolist(),
                    "r2Ramp": np.nan_to_num(sp.r_squared_ramp, nan=-1).tolist(),
                    "r2Exp": np.nan_to_num(sp.r_squared_exp, nan=-1).tolist(),
                    "isi": np.nan_to_num(sp.isi, nan=-1).tolist(),
                    "indsError": sp.inds_error,
                })
                log(f"  ship sweep {ship['id']}: {sp.n_spikes} spikes, {len(segq)} samples @ {fs} Hz")
        log(f"  -> {n_from_file} feature rows")
        file_meta.append({"file": name, "subject": sid, **subj})

    json.dump({"sweeps": ship_sweeps}, open(os.path.join(OUT, "sweeps.json"), "w"))
    json.dump({"decim": 2, "scale": 0.01, "windows": waveforms},
              open(os.path.join(OUT, "waveforms.json"), "w"))
    json.dump({"rows": features}, open(os.path.join(OUT, "features.json"), "w"))
    json.dump(fixture_spikes, open(os.path.join(FIXDIR, "spikes-fit.json"), "w"))
    log(f"features: {len(features)} rows, waveforms: {len(waveforms)}, "
        f"sweeps shipped: {len(ship_sweeps)}, fixtures: {len(fixture_spikes)}")

    # ---------------- SKG: fit the mean spike + 3 singles for sandbox defaults
    from spikeparam.skg.fit import SKG, sim_gaussian_spike
    # rebuild windows (full-rate) from fixture sweeps for skg
    all_wf = []
    for fx in fixture_spikes:
        pass
    # decode a subset of decimated waveforms instead (shape only matters here)
    sel = waveforms[:200]
    W = np.stack([np.frombuffer(base64.b64decode(w), dtype="<i2").astype(np.float64) / 100.0
                  for w in sel if len(base64.b64decode(w)) == len(base64.b64decode(sel[0]))])
    mean_spike = W.mean(axis=0)
    p0 = (.45, 0.05, 2.0, 1.0, .5, 0.1, -2.0, 0.3, 60., -55.)
    skg = SKG(p0=p0)
    try:
        skg.fit(mean_spike)
        params = skg.params_[0]
        xs = np.arange(len(mean_spike))
        fit = sim_gaussian_spike(xs, *params)
        r2 = float(np.corrcoef(mean_spike, fit)[0][1] ** 2)
    except Exception as e:
        log(f"SKG fit failed ({e!r}); shipping p0")
        params = np.array(p0)
        xs = np.arange(len(mean_spike))
        fit = sim_gaussian_spike(xs, *params)
        r2 = float(np.corrcoef(mean_spike, fit)[0][1] ** 2)
    sep = sim_gaussian_spike(xs, *params, return_separate=True)
    json.dump({
        "n": len(mean_spike),
        "meanSpike": np.round(mean_spike, 3).tolist(),
        "params": np.round(params, 6).tolist(),
        "fit": np.round(fit, 4).tolist(),
        "gaussA": np.round(sep[0], 4).tolist(),
        "gaussB": np.round(sep[1], 4).tolist(),
        "r2": r2,
        "paramNames": ["a_ctr", "a_std", "a_alpha", "a_scale",
                       "b_ctr", "b_std", "b_alpha", "b_scale", "scale", "offset"],
    }, open(os.path.join(FIXDIR, "spikes-skg.json"), "w"))
    log(f"SKG mean-spike fit r2={r2:.4f}")

    # meta.json
    json.dump({
        "dandiset": DANDISET,
        "dandisetName": "Primate Cell Type Database - Intracellular Recordings "
                        "(Feyerabend, Pommer, Mestern et al.)",
        "dandisetUrl": f"https://dandiarchive.org/dandiset/{DANDISET}",
        "license": "CC-BY-4.0",
        "portal": "https://www.primatedatabase.com/",
        "files": file_meta,
        "settings": {"thresh_amp": 0, "window_length": [5, 5], "smooth_frac": 0.01,
                     "thresh_ms": 1.0, "pre_peak_ms": [-4, -1], "pre_inflection_ms": 1,
                     "exp_shift_right": 2, "exp_duration": 5},
        "note": "Rebuilt 2026-09-01 from the current public release (all Callithrix "
                "jacchus); the original 2024 analysis also included macaque files "
                "that predate this release.",
    }, open(os.path.join(OUT, "meta.json"), "w"), indent=1)

# ---------------------------------------------------------------- figures
STATS_FIGS = [
    (15, 0, "avg-spike-by-area", "Average spike +-1 SD, overlapped by brain region (PFC / V1 / LIP)."),
    (16, 0, "avg-spike-by-species", "Average spike by species (Macaca fascicularis vs M. mulatta)."),
    (20, 0, "avg-spike-by-sex", "Average spike by sex."),
    (21, 0, "avg-spike-by-dendrite", "Average spike by dendritic type (aspiny / NA / spiny)."),
    (10, 3, "peakamp-by-area", "peak_amp by brain region."),
    (13, 6, "explambda-by-dendrite", "exp_lambda by dendritic type."),
    (9, 3, "peakamp-by-species", "peak_amp by species."),
    (8, 4, "peakwidth-by-age", "peak_width by age."),
]

def figures():
    from PIL import Image
    nbp = os.path.join(RAW, "stats_from_allMonkeyDFs_filt.ipynb")
    nb = json.load(open(nbp, encoding="utf-8"))
    manifest = []
    for ci, oi, name, caption in STATS_FIGS:
        cell = nb["cells"][ci]
        imgs = [o["data"]["image/png"] for o in cell.get("outputs", []) if "image/png" in o.get("data", {})]
        png = base64.b64decode(imgs[oi])
        im = Image.open(io.BytesIO(png)).convert("RGB")
        if im.width > 1000:
            im = im.resize((1000, int(im.height * 1000 / im.width)), Image.LANCZOS)
        outp = os.path.join(OUT, "figures", name + ".webp")
        im.save(outp, "WEBP", quality=82)
        manifest.append({"file": f"figures/{name}.webp", "caption": caption, "w": im.width, "h": im.height})
        log(f"fig {name}.webp {os.path.getsize(outp)}")
    json.dump(manifest, open(os.path.join(OUT, "figures.json"), "w"), indent=1)

if __name__ == "__main__":
    only = os.environ.get("SPIKES_PREP_ONLY", "")
    if not only or only == "figures":
        figures()
    if not only or only == "assets":
        files = ensure_files()
        log(f"{len(files)} NWB files in cache")
        main_assets(files)
    log("spikes prep done")
