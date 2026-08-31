"""
Quantum Playground demo prep - the Python half (called by scripts/demos/quantum.ts).

  py -3.12 scripts/demos/quantum_prep.py <rawDir> <outDir> <repoRoot>

Everything on the page is computed client-side, so this script only:
1. Copies the Grover group-project report PDF to public/demos/quantum/.
2. Generates NumPy fixtures for the TypeScript simulator, mirroring the course
   solutions exactly (Week 9 run_deutsch_jozsa / run_bv, Week 10 Uf_for_s + Simon
   readout, the intro notebook's Bell circuit and Werner fidelities, Ex. 8 checks,
   and the Grover iteration curve the group project analyzed).

Conventions match the course code: qubit 0 = most significant bit (np.kron order),
oracles use in_idx = (x << m) | y. ASCII-only prints (console is cp1252).
"""
import json
import os
import shutil
import sys

import numpy as np

raw_dir, out_dir, repo_root = sys.argv[1:4]
fix_dir = os.path.join(repo_root, "tests", "fixtures")
os.makedirs(fix_dir, exist_ok=True)


def log(msg):
    print(str(msg).encode("ascii", "replace").decode(), flush=True)


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f)
    log("%s: %.0f KB" % (os.path.relpath(path, repo_root), os.path.getsize(path) / 1024))


def c2(v):
    """Complex vector -> [[re, im], ...] rounded."""
    return [[round(float(x.real), 12), round(float(x.imag), 12)] for x in v]


H1 = np.array([[1, 1], [1, -1]], dtype=complex) / np.sqrt(2)
I2 = np.eye(2, dtype=complex)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
Z = np.array([[1, 0], [0, -1]], dtype=complex)


def hadamard_n(n):
    res = H1
    for _ in range(n - 1):
        res = np.kron(res, H1)
    return res


def bits(x, n):
    return tuple(((x >> i) & 1) for i in reversed(range(n)))


def dot2(a, b):
    s = 0
    for ai, bi in zip(a, b):
        s ^= ai & bi
    return s


def Uf_n_to_m(f, n, m):
    dim = 2 ** (n + m)
    U = np.zeros((dim, dim), dtype=complex)
    for x in range(2 ** n):
        for y in range(2 ** m):
            U[(x << m) | (y ^ f(x)), (x << m) | y] = 1.0
    return U


# ---------------------------------------------------------------- report PDF

def copy_report():
    src = os.path.join(raw_dir, "grover_group_project")
    pdf = [f for f in os.listdir(src) if f.endswith(".pdf")][0]
    os.makedirs(out_dir, exist_ok=True)
    dst = os.path.join(out_dir, "grover_report.pdf")
    shutil.copyfile(os.path.join(src, pdf), dst)
    log("grover_report.pdf: %.0f KB" % (os.path.getsize(dst) / 1024))


# ---------------------------------------------------------------- bloch / Ex.8 fixture

def prep_bloch():
    def qubit(theta, phi):
        return np.array([np.cos(theta / 2), np.exp(1j * phi) * np.sin(theta / 2)], dtype=complex)

    tests = []
    for theta, phi in [(0, 0), (np.pi / 2, 0), (np.pi / 2, np.pi / 4), (np.pi, 0), (2.0, 5.0)]:
        psi = qubit(theta, phi)
        rho = np.outer(psi, psi.conj())
        bloch = [float(np.trace(rho @ P).real) for P in (X, Y, Z)]
        tests.append({"theta": theta, "phi": phi, "state": c2(psi), "bloch": [round(b, 12) for b in bloch]})
    # Pauli identities (Ex. 1): XY = iZ etc.
    idents = {
        "XY_eq_iZ": bool(np.allclose(X @ Y, 1j * Z)),
        "YZ_eq_iX": bool(np.allclose(Y @ Z, 1j * X)),
        "ZX_eq_iY": bool(np.allclose(Z @ X, 1j * Y)),
    }
    # gate action samples: H, S, T, Rx(1.1) on qubit(2.0, 5.0)
    psi = qubit(2.0, 5.0)
    S = np.diag([1, 1j])
    T = np.diag([1, np.exp(1j * np.pi / 4)])

    def rx(t):
        return np.array([[np.cos(t / 2), -1j * np.sin(t / 2)], [-1j * np.sin(t / 2), np.cos(t / 2)]])

    gates = {"H": c2(H1 @ psi), "S": c2(S @ psi), "T": c2(T @ psi), "Rx1.1": c2(rx(1.1) @ psi)}
    save_json(os.path.join(fix_dir, "quantum-bloch.json"), {"tests": tests, "identities": idents, "gateActionOn_2.0_5.0": gates})


# ---------------------------------------------------------------- circuit fixture (intro notebook)

def prep_circuit():
    # Bell circuit from QI-introducing_QuTiP: SNOT on q1, CNOT(control 1 -> target 0),
    # CRZ(control 0 -> target 1, arg -pi), input |00>. Qubit 0 = MSB.
    def gate_on(n, g, targets, controls=()):
        # build via basis-state application, MSB-first convention
        dim = 2 ** n
        U = np.zeros((dim, dim), dtype=complex)
        k = len(targets)
        for col in range(dim):
            vec = np.zeros(dim, dtype=complex)
            vec[col] = 1
            # apply small gate g to targets with controls
            out = np.zeros(dim, dtype=complex)
            for idx in range(dim):
                if vec[idx] == 0:
                    continue
                bset = bits(idx, n)
                if any(bset[c] == 0 for c in controls):
                    out[idx] += vec[idx]
                    continue
                sub = 0
                for b in range(k):
                    sub = (sub << 1) | bset[targets[b]]
                for r in range(2 ** k):
                    amp = g[r, sub]
                    if amp == 0:
                        continue
                    nb = list(bset)
                    for b in range(k):
                        nb[targets[b]] = (r >> (k - 1 - b)) & 1
                    j = 0
                    for bit in nb:
                        j = (j << 1) | bit
                    out[j] += amp * vec[idx]
            U[:, col] = out
        return U

    def crz(arg):
        return np.diag([1, np.exp(1j * arg)]).astype(complex)

    n = 2
    U1 = gate_on(n, H1, [1])
    U2 = gate_on(n, X, [0], controls=[1])
    U3 = gate_on(n, crz(-np.pi), [1], controls=[0])
    U = U3 @ U2 @ U1
    psi0 = np.zeros(4, dtype=complex)
    psi0[0] = 1
    bell = U @ psi0
    # A second check: 3-qubit GHZ via H(q0), CNOT(0->1), CNOT(1->2)
    m = 3
    G = gate_on(m, X, [2], controls=[1]) @ gate_on(m, X, [1], controls=[0]) @ gate_on(m, H1, [0])
    ghz = G @ np.eye(8, dtype=complex)[:, 0]
    save_json(os.path.join(fix_dir, "quantum-circuit.json"), {
        "bellCircuit": {"gates": ["H q1", "CNOT c1 t0", "CRZ c0 t1 arg=-pi"], "state": c2(bell),
                        "unitaryCol0": c2(U[:, 0])},
        "ghz": c2(ghz),
    })


# ---------------------------------------------------------------- simon / dj / bv fixture

def prep_simon():
    n, m, s = 4, 4, 6
    Uf = Uf_n_to_m(lambda x: min(x, x ^ s), n, m)
    dim_all = 2 ** (n + m)
    psi = np.zeros(dim_all, dtype=complex)
    psi[0] = 1
    psi = np.kron(hadamard_n(n), np.eye(2 ** m)) @ psi
    psi = Uf @ psi
    psi = np.kron(hadamard_n(n), np.eye(2 ** m)) @ psi
    probs = np.zeros(2 ** n)
    for i in range(dim_all):
        probs[i >> m] += abs(psi[i]) ** 2
    survivors = [int(y) for y in range(2 ** n) if probs[y] > 1e-12]
    # DJ (Week 9): n=3 inputs, m=1
    def dj(f):
        n3 = 3
        dim = 2 ** (n3 + 1)
        p0 = np.zeros(dim, dtype=complex)
        p0[1] = 1.0  # |0^n>|1>
        p = np.kron(hadamard_n(n3), H1) @ p0
        p = Uf_n_to_m(f, n3, 1) @ p
        p = np.kron(hadamard_n(n3), np.eye(2)) @ p
        return float(abs(p[0]) ** 2 + abs(p[1]) ** 2)

    djs = {
        "constant0": dj(lambda x: 0),
        "constant1": dj(lambda x: 1),
        "bit0": dj(lambda x: bits(x, 3)[0]),
        "xor01": dj(lambda x: bits(x, 3)[0] ^ bits(x, 3)[1]),
    }
    # BV s=101
    sb = (1, 0, 1)
    bvU = Uf_n_to_m(lambda x: dot2(bits(x, 3), sb), 3, 1)
    dim = 16
    p0 = np.zeros(dim, dtype=complex)
    p0[1] = 1.0
    p = np.kron(hadamard_n(3), H1) @ p0
    p = bvU @ p
    p = np.kron(hadamard_n(3), np.eye(2)) @ p
    bv_probs = [round(float(abs(p[(x << 1)]) ** 2 + abs(p[(x << 1) | 1]) ** 2), 12) for x in range(8)]
    save_json(os.path.join(fix_dir, "quantum-simon.json"), {
        "n": n, "m": m, "s": s,
        "inputProbs": [round(float(p), 12) for p in probs],
        "survivors": survivors,
        "survivorsSatisfyYdotS0": all(dot2(bits(y, n), bits(s, n)) == 0 for y in survivors),
        "dj": {k: round(v, 12) for k, v in djs.items()},
        "bv": {"s": "101", "probs": bv_probs},
    })


# ---------------------------------------------------------------- grover fixture

def prep_grover():
    def curve(n, marked, iters):
        N = 2 ** n
        amps = np.full(N, 1 / np.sqrt(N))
        out = [float(sum(amps[list(marked)] ** 2))]
        for _ in range(iters):
            for mk in marked:
                amps[mk] = -amps[mk]
            mean = amps.mean()
            amps = 2 * mean - amps
            out.append(float(sum(amps[list(marked)] ** 2)))
        return [round(v, 12) for v in out]

    cases = []
    for n, marked in [(3, [5]), (4, [3]), (5, [7]), (4, [3, 12])]:
        N, M = 2 ** n, len(marked)
        opt = int(np.floor(np.pi / 4 * np.sqrt(N / M)))
        cases.append({"n": n, "marked": marked, "optimal": opt, "curve": curve(n, marked, 2 * opt + 4)})
    save_json(os.path.join(fix_dir, "quantum-grover.json"), {"cases": cases})


# ---------------------------------------------------------------- werner fixture (intro notebook)

def prep_werner():
    # |Psi-> = (|01> - |10>)/sqrt(2); F(W(p), Psi-) = sqrt(<Psi-|W|Psi->) for pure target
    psim = np.zeros(4, dtype=complex)
    psim[1] = 1 / np.sqrt(2)
    psim[2] = -1 / np.sqrt(2)
    proj = np.outer(psim, psim.conj())
    ps = np.linspace(0, 1, 21)
    fids = []
    for p in ps:
        Wp = p / 4 * np.eye(4) + (1 - p) * proj
        fids.append(round(float(np.sqrt(np.real(psim.conj() @ Wp @ psim))), 12))
    save_json(os.path.join(fix_dir, "quantum-werner.json"), {"p": [round(float(x), 12) for x in ps], "fidelity": fids})


copy_report()
prep_bloch()
prep_circuit()
prep_simon()
prep_grover()
prep_werner()
log("prep complete")
