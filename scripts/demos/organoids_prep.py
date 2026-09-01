# -*- coding: ascii -*-
"""Organoids demo prep (02).

Usage: py -3.12 organoids_prep.py <rawDir> <outDir> <repoRoot>

Builds, from demos/psychedelic_organoids_raw/:
  - public/demos/organoids/figures/*.webp   curated real figures from the notebooks
  - public/demos/organoids/figures.json     manifest (chapter, caption, source)
  - tests/fixtures/organoids-specparam.json welch + FOOOF fits (fixed & knee) on
    synthetic signals, for the TS specparam port
  - tests/fixtures/organoids-bursts.json    isi_array / burst_rate / network_events
    expected outputs on a synthetic spike-times grid

No lab data ships: interactive panels run on synthetic data generated client-side;
figures are David's own rendered analysis outputs extracted from the notebooks.
"""
import sys, os, io, json, base64

import numpy as np

RAW, OUT, REPO = sys.argv[1], sys.argv[2], sys.argv[3]
FIXDIR = os.path.join(REPO, "tests", "fixtures")
os.makedirs(os.path.join(OUT, "figures"), exist_ok=True)
os.makedirs(FIXDIR, exist_ok=True)

def log(*a):
    print(*a, flush=True)

# ---------------------------------------------------------------- figures
# (notebook file, cell index, output index, out name, chapter, caption)
ORG = "psychedelic_organoids_raw"
CURATED = [
    # Chapter 1 - raw voltage (Jul-Aug 2024)
    (f"{ORG}/ds_lfp_07-29-24.ipynb", 6, 0, "ch1-raw-trace-100s", "raw",
     "A first look: 100 s of downsampled LFP from one well (100 Hz)."),
    (f"{ORG}/ds_lfp_07-29-24.ipynb", 7, 0, "ch1-raw-trace-600s", "raw",
     "The full 10-minute recording of the same well."),
    (f"{ORG}/ds_lfp_07-29-24.ipynb", 9, 0, "ch1-first-welch", "raw",
     "The first Welch power spectrum (well A4), log-log."),
    (f"{ORG}/ds_lfp_07-29-24.ipynb", 11, 0, "ch1-welch-grid", "raw",
     "Welch spectra for every well - the 6x8 grid habit begins."),
    (f"{ORG}/Spike_data_psych_org.ipynb", 7, 0, "ch1-spike-heatmap", "raw",
     "Spike counts per well from the .spk file."),
    (f"{ORG}/Spike_data_psych_org.ipynb", 7, 1, "ch1-electrode-heatmaps", "raw",
     "Per-electrode spike heatmaps embedded at each well position."),
    # Chapter 2 - what's in a spectrum (Sep 2024, Plate A)
    (f"{ORG}/ds_lfp_07-29-24.ipynb", 14, 0, "ch2-first-fooof", "spectrum",
     "An early FOOOF fit: aperiodic 1/f plus a broad beta peak."),
    (f"{ORG}/ds_lfp_07-29-24.ipynb", 14, 9, "ch2-fooof-sharp-peak", "spectrum",
     "Another well, same day: a sharp ~23 Hz peak on the same aperiodic background."),
    (f"{ORG}/PlateA/PlateA-prestim.ipynb", 5, 0, "ch2-platea-fooof", "spectrum",
     "Plate A pre-stim: full model fit with the knee visible below 10 Hz."),
    (f"{ORG}/PlateA/PlateA-prestim.ipynb", 18, 0, "ch2-platea-offsets", "spectrum",
     "Aperiodic offset heatmap across the recorded wells."),
    (f"{ORG}/PlateA/PlateA-prestim.ipynb", 18, 2, "ch2-platea-exponents", "spectrum",
     "Aperiodic exponent heatmap - the parameter that becomes the story."),
    (f"{ORG}/PlateA/PlateA-prestim.ipynb", 21, 0, "ch2-platea-dose-box", "spectrum",
     "First dose comparison: offsets / knees / exponents, eGFP vs CheRiff."),
    (f"{ORG}/ds_lfp_07-29-24.ipynb", 33, 2, "ch2-exponent-heatmap", "spectrum",
     "Aperiodic exponents across the full 48-well plate."),
    # Chapter 3 - dose and time (Oct-Dec 2024, Plate D, 5-MeO-DMT)
    (f"{ORG}/PlateD/PlateD_comparison.ipynb", 19, 0, "ch3-fr-across-days", "dose",
     "Firing rate per well across recording days."),
    (f"{ORG}/PlateD/PlateD_comparison.ipynb", 23, 0, "ch3-heatmaps-days", "dose",
     "Offset heatmaps, one plate per day, D-1 to D20."),
    (f"{ORG}/PlateD/PlateD_comparison.ipynb", 28, 0, "ch3-params-by-dose", "dose",
     "Offsets and exponents across files, grouped by dose."),
    (f"{ORG}/PlateD/DeviationD.ipynb", 13, 0, "ch3-deviation-exponent", "dose",
     "Deviation of the exponent from the D-1 baseline, per dose."),
    (f"{ORG}/PlateD/DeviationD.ipynb", 31, 0, "ch3-deviation-by-group", "dose",
     "Average exponent deviation by dose group across days."),
    # Chapter 4 - four compounds, sixty days (Plate F)
    (f"{ORG}/PlateF/PlateF_comparison.ipynb", 17, 0, "ch4-spike-heatmaps", "compounds",
     "Spike-count heatmaps for every recording day of Plate F."),
    (f"{ORG}/PlateF/PlateF_comparison.ipynb", 19, 0, "ch4-fr-across-days", "compounds",
     "Firing rate per well, D-1 to D60."),
    (f"{ORG}/PlateF/PlateF_comparison.ipynb", 23, 1, "ch4-param-heatmaps", "compounds",
     "Exponent heatmaps across days (fixed mode)."),
    (f"{ORG}/PlateF/PlateF_comparison.ipynb", 27, 0, "ch4-params-by-dose", "compounds",
     "Offsets and exponents by file and dose - psilocybin / LSD / psilocin / vehicle."),
    (f"{ORG}/PlateF/PlateF_comparison-knee.ipynb", 27, 0, "ch4-knee-params-by-dose", "compounds",
     "The same comparison re-fit in knee mode."),
    (f"{ORG}/PlateF/Deviation.ipynb", 13, 0, "ch4-deviation-exponent", "compounds",
     "Exponent deviation from baseline across files, per dose."),
    (f"{ORG}/PlateF/Deviation.ipynb", 29, 0, "ch4-deviation-fr", "compounds",
     "Average firing-rate deviation by dose group."),
]

def extract_figures():
    from PIL import Image
    manifest = []
    cache = {}
    for nbrel, ci, oi, name, chapter, caption in CURATED:
        p = os.path.join(RAW, "..", nbrel) if not os.path.isabs(nbrel) else nbrel
        p = os.path.normpath(os.path.join(RAW, "..", nbrel))
        if p not in cache:
            cache[p] = json.load(open(p, encoding="utf-8"))
        nb = cache[p]
        cell = nb["cells"][ci]
        imgs = [o["data"]["image/png"] for o in cell.get("outputs", []) if "image/png" in o.get("data", {})]
        if oi >= len(imgs):
            raise SystemExit(f"figure missing: {nbrel} cell {ci} output {oi} (has {len(imgs)})")
        png = base64.b64decode(imgs[oi])
        im = Image.open(io.BytesIO(png)).convert("RGB")
        if im.width > 1100:
            im = im.resize((1100, int(im.height * 1100 / im.width)), Image.LANCZOS)
        outp = os.path.join(OUT, "figures", name + ".webp")
        im.save(outp, "WEBP", quality=82)
        manifest.append({
            "file": f"figures/{name}.webp", "chapter": chapter, "caption": caption,
            "source": os.path.basename(nbrel), "w": im.width, "h": im.height,
        })
        log(f"fig {name}.webp {os.path.getsize(outp)} bytes")
    json.dump(manifest, open(os.path.join(OUT, "figures.json"), "w"), indent=1)
    log(f"figures.json: {len(manifest)} entries")

# ------------------------------------------------- specparam fixtures
def gen_synth(rng, n_seconds, fs, offset, exponent, knee=0.0, peaks=()):
    """Colored noise with target aperiodic form + gaussian log-power peaks.

    Spectral shaping in the frequency domain with random phases, which yields a
    signal whose Welch PSD follows 10^offset / (knee + f^exponent) with peaks.
    """
    n = int(n_seconds * fs)
    freqs = np.fft.rfftfreq(n, 1.0 / fs)
    target = np.zeros_like(freqs)
    nz = freqs > 0
    target[nz] = 10.0 ** offset / (knee + freqs[nz] ** exponent)
    for cf, pw, bw in peaks:
        target[nz] = target[nz] * 10.0 ** (pw * np.exp(-((freqs[nz] - cf) ** 2) / (2 * bw ** 2)))
    amp = np.sqrt(target)
    phase = rng.uniform(0, 2 * np.pi, len(freqs))
    spec = amp * np.exp(1j * phase)
    spec[0] = 0
    sig = np.fft.irfft(spec, n)
    sig = sig / np.std(sig)
    return sig

def specparam_fixture():
    from neurodsp.spectral import compute_spectrum
    from fooof import FOOOF
    rng = np.random.default_rng(140)
    fs = 100
    cases = []
    presets = [
        dict(offset=1.0, exponent=1.5, knee=0.0, peaks=[(8.0, 0.9, 2.0)]),
        dict(offset=0.5, exponent=2.2, knee=0.0, peaks=[(23.0, 0.7, 3.0)]),
        dict(offset=1.2, exponent=1.0, knee=0.0, peaks=[]),
        dict(offset=1.0, exponent=2.8, knee=150.0, peaks=[(6.0, 0.8, 2.0), (20.0, 0.5, 4.0)]),
        dict(offset=0.8, exponent=2.4, knee=60.0, peaks=[(11.0, 0.6, 2.5)]),
        dict(offset=1.1, exponent=2.0, knee=0.0, peaks=[(5.0, 1.0, 1.5), (28.0, 0.45, 5.0)]),
    ]
    for pi, pr in enumerate(presets):
        sig = gen_synth(rng, 600, fs, pr["offset"], pr["exponent"], pr["knee"], pr["peaks"])
        sig = np.round(sig, 4)
        freqs, psd = compute_spectrum(sig, fs, method="welch", avg_type="mean", nperseg=fs * 2)
        case = {
            "name": f"preset{pi}",
            "gen": pr,
            # ship only the PSD (TS re-runs welch on the signal for the welch test on case 0)
            "freqs": freqs.tolist(),
            "psd": psd.tolist(),
            "fits": {},
        }
        if pi == 0:
            case["signal"] = sig.tolist()
            case["fs"] = fs
        for fmode in ("fixed", "knee"):
            # the project's settings (set_fm_array)
            fm = FOOOF(min_peak_height=0.6, peak_width_limits=(4, 15),
                       aperiodic_mode=fmode, peak_threshold=0.6, verbose=False)
            fm.fit(freqs, psd, [2, 50])
            case["fits"][fmode] = {
                "aperiodic": fm.aperiodic_params_.tolist(),
                "peaks": fm.peak_params_.tolist(),
                "gaussians": fm.gaussian_params_.tolist(),
                "r_squared": float(fm.r_squared_),
                "error": float(fm.error_),
            }
        cases.append(case)
        log(f"specparam preset{pi}: fixed exp={case['fits']['fixed']['aperiodic'][-1]:.3f} "
            f"knee exp={case['fits']['knee']['aperiodic'][-1]:.3f} "
            f"n_peaks={len(case['fits']['fixed']['peaks'])}")
    # neurodsp's welch path = scipy.signal.spectrogram: noverlap defaults to nperseg//8
    json.dump({"welch": {"nperseg": 200, "noverlap": 25, "fs": fs}, "cases": cases},
              open(os.path.join(FIXDIR, "organoids-specparam.json"), "w"))
    log("wrote organoids-specparam.json")

# ------------------------------------------------- burst fixtures (exact ports)
def isi_array(spike_times_array):
    isi_arr = np.empty((6, 8, 4, 4), dtype=object)
    for row in range(6):
        for col in range(8):
            for i in range(4):
                for j in range(4):
                    st = spike_times_array[row][col][i][j]
                    if st is not None and len(st) > 0:
                        isi_arr[row, col, i, j] = np.diff(np.asarray(st))
                    else:
                        isi_arr[row, col, i, j] = np.array([])
    return isi_arr

def burst_rate(isi_arr, isi_thresh=1.0, min_spikes=3):
    burst_counts = np.zeros((6, 8, 4, 4), dtype=int)
    for row in range(6):
        for col in range(8):
            for i in range(4):
                for j in range(4):
                    isi = isi_arr[row, col, i, j]
                    if isi.size > 0:
                        count = 0
                        run = 0
                        for val in isi:
                            if val < isi_thresh:
                                run += 1
                            else:
                                if run >= min_spikes - 1:
                                    count += 1
                                run = 0
                        if run >= min_spikes - 1:
                            count += 1
                        burst_counts[row, col, i, j] = count
    return burst_counts

def network_events(spike_times_array, isi_thresh=1, min_spikes=3):
    out = np.zeros((6, 8), dtype=int)
    for row in range(6):
        for col in range(8):
            spike_events = []
            for i in range(4):
                for j in range(4):
                    st = spike_times_array[row][col][i][j]
                    if st is not None and len(st) > 0:
                        for t in st:
                            spike_events.append((t, (i, j)))
            spike_events.sort()
            used = set()
            count = 0
            i2 = 0
            while i2 < len(spike_events):
                if i2 in used:
                    i2 += 1
                    continue
                t0 = spike_events[i2][0]
                electrodes = {spike_events[i2][1]}
                involved = {i2}
                j2 = i2 + 1
                while j2 < len(spike_events) and spike_events[j2][0] - t0 <= isi_thresh:
                    electrodes.add(spike_events[j2][1])
                    involved.add(j2)
                    j2 += 1
                if len(electrodes) >= min_spikes:
                    count += 1
                    used.update(involved)
                    i2 = max(involved) + 1
                else:
                    i2 += 1
            out[row, col] = count
    return out

def burst_fixture():
    rng = np.random.default_rng(48)
    grid = []
    for row in range(6):
        rrow = []
        for col in range(8):
            well = []
            active = rng.random() < 0.6
            for i in range(4):
                erow = []
                for j in range(4):
                    if active and rng.random() < 0.5:
                        n = int(rng.integers(5, 80))
                        # poisson-ish with burst clumps
                        t = np.sort(rng.uniform(0, 600, n))
                        if rng.random() < 0.5:
                            b0 = rng.uniform(0, 550)
                            t = np.sort(np.concatenate([t, b0 + np.cumsum(rng.uniform(0.05, 0.4, 12))]))
                        erow.append(np.round(t, 3).tolist())
                    else:
                        erow.append([])
                well.append(erow)
            rrow.append(well)
        grid.append(rrow)
    ia = isi_array(grid)
    br = burst_rate(ia, isi_thresh=1.0, min_spikes=3)
    ne = network_events(grid, isi_thresh=1, min_spikes=3)
    fix = {
        "spikeTimes": grid,
        "isiFirstWell": [ia[0, 0, i, j].tolist() for i in range(4) for j in range(4)],
        "burstCounts": br.tolist(),
        "burstPerWell": br.sum(axis=(2, 3)).tolist(),
        "networkEvents": ne.tolist(),
        "params": {"isi_thresh": 1.0, "min_spikes": 3},
    }
    json.dump(fix, open(os.path.join(FIXDIR, "organoids-bursts.json"), "w"))
    log(f"bursts fixture: total bursts {int(br.sum())}, network events {int(ne.sum())}")

if __name__ == "__main__":
    only = os.environ.get("ORGANOIDS_PREP_ONLY", "")
    if not only or only == "figures":
        extract_figures()
    if not only or only == "fixtures":
        specparam_fixture()
        burst_fixture()
    log("organoids prep done")
