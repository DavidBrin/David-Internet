"""
Signals & Systems demo prep - the Python half (called by scripts/demos/signals.ts).

  py -3.12 scripts/demos/signals_prep.py <rawDir> <outDir> <repoRoot>

1. Lab 1 (Lab_1_F23.mat): the encrypted signal X -> magnitude/phase int16 bins +
   header (the page re-derives the permutation from seed 2023 with its own MT19937),
   plus a NumPy fixture for the TS port (perm spot checks + decoded slice).
2. Lab 2 (echo_F23.mat): echoed voice y -> int16 bin + header, plus a fixture with
   the autocorrelation estimates (N, alpha) and the inverse-filtered reference slice.
3. Lab 3 (Lab3_F23.mat): deblur the tumbller image with the true blur length found by
   rerunning the lab's trial-and-error (the mlx never recorded it), ship a grayscale
   crop as PNG, plus a small pinv fixture for the TS SVD solve.
4. Lab 4: generated on the page; fixture only (sinc reconstruction reference).
5. Lab 5: generated on the page; fixture only (RK4 vs analytic t*exp(-4t)).

ASCII-only prints (console is cp1252).
"""
import json
import os
import sys

import numpy as np
import scipy.io as sio
from scipy.linalg import toeplitz

raw_dir, out_dir, repo_root = sys.argv[1:4]
fix_dir = os.path.join(repo_root, "tests", "fixtures")
os.makedirs(fix_dir, exist_ok=True)

# Lab 3 constants pinned by the rebuild (2026-08-30): the blur is the lab equation's
# CAUSAL moving average (lower-triangular Toeplitz), NOT deblur.m's symmetric toeplitz.
# N=464 is the unique length whose triangular solve lands entirely in [0,1] (out-of-range
# fraction exactly 0; neighbors >=0.002). The remaining "double exposure" is real motion:
# the self-balancing robot rocking during the photo (offset grows with height).
N_BLUR = 464
CROP = (260, 900, 260, 1860)   # (row0, row1, col0, col1) shipped to the page
DOWNSAMPLE = 2                 # 2x2 block mean -> 320 x 800 shipped crop


def log(msg):
    print(str(msg).encode("ascii", "replace").decode(), flush=True)


def write_bin(name, x, scale):
    q = np.clip(np.round(x * scale), -32767, 32767).astype("<i2")
    path = os.path.join(out_dir, name)
    q.tofile(path)
    log("%s: %.0f KB (n=%d)" % (name, q.nbytes / 1024, q.size))
    return q.astype(np.float64) / scale  # the dequantized values the page will see


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f)
    log("%s: %.0f KB" % (os.path.relpath(path, repo_root), os.path.getsize(path) / 1024))


# ---------------------------------------------------------------- Lab 1

def prep_lab1():
    m = sio.loadmat(os.path.join(raw_dir, "Lab_1_F23.mat"))
    X = m["X"].ravel()
    fs = int(m["Fs"].ravel()[0])
    mag, phase = X.real, X.imag
    mag_scale = 32767.0 / float(np.max(np.abs(mag)))
    phase_scale = 32767.0 / float(np.pi)
    mag_q = write_bin("lab1_mag.bin", mag, mag_scale)
    phase_q = write_bin("lab1_phase.bin", phase, phase_scale)
    n2 = X.size
    N = 2 * n2
    save_json(os.path.join(out_dir, "lab1.json"), {
        "fs": fs, "seed": 2023, "nHalf": n2, "n": N,
        "mag": {"file": "lab1_mag.bin", "n": n2, "fs": fs, "scale": mag_scale},
        "phase": {"file": "lab1_phase.bin", "n": n2, "fs": fs, "scale": phase_scale},
    })

    # Decode chain on the QUANTIZED values (exactly what the page computes).
    W = mag_q * np.exp(1j * phase_q)
    Z = np.concatenate([W.real, W.imag])
    r = np.random.RandomState(2023).random_sample(N)
    perm = np.argsort(r, kind="stable")           # MATLAB randperm = sort-by-rand
    Y = np.empty(N)
    Y[perm] = Z                                    # Z = Y(perm)
    M = Y[::-1]                                    # the audible message is the flip (lab task 5)
    lag1 = float(np.corrcoef(Y[:-1], Y[1:])[0, 1])
    log("lab1: N=%d, decoded lag-1 autocorr=%.4f (speech ~0.99)" % (N, lag1))
    sl = slice(100000, 100064)
    save_json(os.path.join(fix_dir, "signals-lab1.json"), {
        "n": N, "seed": 2023,
        "permHead": perm[:32].tolist(),
        "permTail": perm[-32:].tolist(),
        "permSum": int(perm.sum()),
        "decodedSlice": {"from": sl.start, "y": Y[sl].tolist()},
        "flippedSlice": {"from": sl.start, "m": M[sl].tolist()},
        "lag1": lag1,
    })


# ---------------------------------------------------------------- Lab 2

def prep_lab2():
    m = sio.loadmat(os.path.join(raw_dir, "echo_F23.mat"))
    y = m["y"].ravel()
    fs = int(m["Fs"].ravel()[0])
    scale = 32767.0 / float(np.max(np.abs(y)))
    y_q = write_bin("lab2_echo.bin", y, scale)
    save_json(os.path.join(out_dir, "lab2.json"), {
        "fs": fs, "n": int(y.size), "alpha": 0.9, "N": 5000,
        "signal": {"file": "lab2_echo.bin", "n": int(y.size), "fs": fs, "scale": scale},
    })

    # Autocorrelation via zero-padded FFT (mirrors src/demos/signals/dsp/fft.ts autocorr).
    nfft = 1 << int(np.ceil(np.log2(2 * y_q.size)))
    F = np.fft.fft(y_q, nfft)
    R = np.fft.ifft(np.abs(F) ** 2).real
    max_lag = 20000
    lags = R[:max_lag + 1]
    n_est = int(np.argmax(lags[1000:])) + 1000
    ratio = float(lags[n_est] / lags[0])           # = alpha/(1+alpha^2), which caps at 0.5
    r_c = min(ratio, 0.499999)                     # speech autocorr pushes it just over; clamp
    alpha_est = float((1 - np.sqrt(1 - 4 * r_c ** 2)) / (2 * r_c))
    log("lab2: autocorr side peak at lag %d, ratio %.4f, alpha_est %.4f" % (n_est, ratio, alpha_est))

    # Reference recovery with the true parameters: y_filt = filter(1, [1, 0..0, alpha], y)
    from scipy.signal import lfilter
    a = np.zeros(5001)
    a[0] = 1.0
    a[5000] = 0.9
    x_rec = lfilter([1.0], a, y_q)
    sl = slice(20000, 20064)
    save_json(os.path.join(fix_dir, "signals-lab2.json"), {
        "fs": fs, "trueN": 5000, "trueAlpha": 0.9,
        "R0": float(lags[0]), "Rpeak": float(lags[n_est]),
        "estN": n_est, "estAlpha": alpha_est,
        "recoveredSlice": {"from": sl.start, "x": x_rec[sl].tolist()},
    })


# ---------------------------------------------------------------- Lab 3

def causal_ma_matrix(length, n):
    """Lower-triangular Toeplitz for the lab's causal length-n moving average."""
    h = np.ones(n) / n
    return toeplitz(np.concatenate([h, np.zeros(length - n)]),
                    np.concatenate([[h[0]], np.zeros(length - 1)]))


def prep_lab3():
    from scipy.linalg import solve_triangular
    from PIL import Image
    m = sio.loadmat(os.path.join(raw_dir, "Lab3_F23.mat"))
    Y = m["tumbller_F23"]
    L = Y.shape[1]
    H = causal_ma_matrix(L, N_BLUR)
    X = solve_triangular(H, Y.T, lower=True).T     # exact inverse of the causal blur
    oor = float(np.mean((X < -0.02) | (X > 1.02)))
    log("lab3: causal deblur N=%d, X range [%.4f, %.4f], oor=%.6f" % (N_BLUR, X.min(), X.max(), oor))
    r0, r1, c0, c1 = CROP
    crop = np.clip(X[r0:r1, c0:c1], 0.0, 1.0)
    d = DOWNSAMPLE
    crop = crop[: crop.shape[0] // d * d, : crop.shape[1] // d * d]
    crop = crop.reshape(crop.shape[0] // d, d, crop.shape[1] // d, d).mean(axis=(1, 3))
    q = np.round(crop * 255).astype(np.uint8)
    png = os.path.join(out_dir, "lab3_crop.png")
    Image.fromarray(q).save(png, optimize=True)
    log("lab3_crop.png: %.0f KB (%dx%d), true N=%d" % (os.path.getsize(png) / 1024, q.shape[1], q.shape[0], N_BLUR))
    save_json(os.path.join(out_dir, "lab3.json"), {
        "file": "lab3_crop.png", "trueN": N_BLUR, "model": "causal",
        "crop": {"row0": r0, "row1": r1, "col0": c0, "col1": c1, "downsample": d},
        "imageShape": [int(Y.shape[0]), int(Y.shape[1])],
        "shipShape": [int(q.shape[0]), int(q.shape[1])],
    })

    # Fixture for the TS port: causal blur + exact triangular deblur on the SHIPPED
    # (8-bit) pixel values, plus the blur's frequency response (freqz-style).
    P = q[:24, :48].astype(np.float64) / 255.0
    Ls = P.shape[1]
    Ns = 5
    Hs = causal_ma_matrix(Ls, Ns)
    B = P @ Hs.T
    D = solve_triangular(Hs, B.T, lower=True).T
    w = np.arange(64) * (2 * np.pi / 64)
    Hf = np.abs(np.exp(-1j * np.outer(w, np.arange(Ns))).sum(axis=1) / Ns)
    save_json(os.path.join(fix_dir, "signals-lab3.json"), {
        "n": Ns, "rows": int(P.shape[0]), "cols": int(Ls), "trueN": N_BLUR,
        "original": np.round(P, 12).tolist(),
        "blurred": np.round(B, 12).tolist(),
        "deblurred": np.round(D, 12).tolist(),
        "freqz": {"w": w.tolist(), "mag": np.round(Hf, 12).tolist()},
    })


# ---------------------------------------------------------------- Lab 4

def prep_lab4():
    fs = 8192
    f0 = 1500.0
    M = 4
    fs2 = fs // M
    T2 = 1.0 / fs2
    n = np.arange(64)
    x = np.sin(2 * np.pi * f0 * n * T2)
    tf = np.arange(256) / fs
    # bandlimited (sinc) interpolation from the undersampled points
    xr = np.array([np.sum(x * np.sinc((t - n * T2) / T2)) for t in tf])
    alias = float(abs(f0 - fs2 * round(f0 / fs2)))
    save_json(os.path.join(fix_dir, "signals-lab4.json"), {
        "fs": fs, "f0": f0, "M": M,
        "samples": x.tolist(),
        "fineT": tf.tolist(),
        "reconstructed": xr.tolist(),
        "aliasHz": alias,
    })
    log("lab4 fixture: f0=%.0f Hz undersampled to %d Hz aliases to %.0f Hz" % (f0, fs2, alias))


# ---------------------------------------------------------------- Lab 5

def prep_lab5():
    g, L = 9.8, 1.0
    k1, k2 = -L * 16 - g, -8.0                      # David's PD gains -> H(s)=1/(s+4)^2
    t = np.linspace(0, 10, 201)
    dt = t[1] - t[0]
    analytic = t * np.exp(-4 * t)

    def deriv(state, xd):
        th, dth = state
        return np.array([dth, (g + L * k1) / L * th + k2 * dth + xd])

    # classic RK4, x(t)=0, theta(0)=0, dtheta(0)=1  (impulse response of 1/(s+4)^2)
    st = np.array([0.0, 1.0])
    rk4 = [st[0]]
    for _ in range(len(t) - 1):
        ka = deriv(st, 0.0)
        kb = deriv(st + dt / 2 * ka, 0.0)
        kc = deriv(st + dt / 2 * kb, 0.0)
        kd = deriv(st + dt * kc, 0.0)
        st = st + dt / 6 * (ka + 2 * kb + 2 * kc + kd)
        rk4.append(float(st[0]))
    rk4 = np.array(rk4)
    err = float(np.max(np.abs(rk4 - analytic)))
    log("lab5 fixture: RK4 vs analytic max err %.2e" % err)
    save_json(os.path.join(fix_dir, "signals-lab5.json"), {
        "g": g, "L": L, "k1": k1, "k2": k2, "dt": dt,
        "t": t.tolist(), "analytic": analytic.tolist(), "rk4": rk4.tolist(),
        "openLoopPoles": [float(np.sqrt(g / L)), float(-np.sqrt(g / L))],
    })


prep_lab1()
prep_lab2()
prep_lab3()
prep_lab4()
prep_lab5()
log("prep complete")
