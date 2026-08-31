/**
 * Hand-written state-vector simulator for the Quantum Playground (1-5 qubits).
 *
 * Conventions (matching the course's NumPy code, so the fixtures line up):
 * - Qubit 0 is the MOST significant bit of the basis index (leftmost wire),
 *   exactly like np.kron(A, B) putting A on the first qubit.
 * - A state over n qubits is dimension 2^n, stored as parallel re/im Float64Arrays.
 * - Oracles follow |x>|y> -> |x>|y XOR f(x)> with the input register in the high bits
 *   (in_idx = (x << m) | y), as in Uf_n_to_m / Uf_for_s from the weekly sheets.
 *
 * Tested against NumPy fixtures in tests/fixtures/quantum-*.json.
 */

export interface State {
  n: number;
  re: Float64Array;
  im: Float64Array;
}

export interface Mat {
  /** dimension (2 for 1-qubit gates, 4 for 2-qubit, ...) */
  d: number;
  re: Float64Array; // row-major d*d
  im: Float64Array;
}

export function zeros(n: number): State {
  const dim = 1 << n;
  return { n, re: new Float64Array(dim), im: new Float64Array(dim) };
}

/** |idx> basis state of n qubits. */
export function basis(n: number, idx: number): State {
  const s = zeros(n);
  s.re[idx] = 1;
  return s;
}

export function cloneState(s: State): State {
  return { n: s.n, re: s.re.slice(), im: s.im.slice() };
}

export function mat(d: number, entries: number[][]): Mat {
  // entries: d rows of 2*d numbers [re0, im0, re1, im1, ...]
  const re = new Float64Array(d * d);
  const im = new Float64Array(d * d);
  for (let r = 0; r < d; r++) {
    for (let c = 0; c < d; c++) {
      re[r * d + c] = entries[r][2 * c];
      im[r * d + c] = entries[r][2 * c + 1];
    }
  }
  return { d, re, im };
}

const R2 = Math.SQRT1_2;

// ---------------------------------------------------------------- gate library

export const GATES: Record<string, Mat> = {
  I: mat(2, [[1, 0, 0, 0], [0, 0, 1, 0]]),
  X: mat(2, [[0, 0, 1, 0], [1, 0, 0, 0]]),
  Y: mat(2, [[0, 0, 0, -1], [0, 1, 0, 0]]),
  Z: mat(2, [[1, 0, 0, 0], [0, 0, -1, 0]]),
  H: mat(2, [[R2, 0, R2, 0], [R2, 0, -R2, 0]]),
  S: mat(2, [[1, 0, 0, 0], [0, 0, 0, 1]]),
  T: mat(2, [[1, 0, 0, 0], [0, 0, R2, R2]]),
};

export function rx(theta: number): Mat {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return mat(2, [[c, 0, 0, -s], [0, -s, c, 0]]);
}

export function ry(theta: number): Mat {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return mat(2, [[c, 0, -s, 0], [s, 0, c, 0]]);
}

export function rz(theta: number): Mat {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return mat(2, [[c, -s, 0, 0], [0, 0, c, s]]);
}

/** Phase gate diag(1, e^{i phi}) (QuTiP's phasegate). */
export function phase(phi: number): Mat {
  return mat(2, [[1, 0, 0, 0], [0, 0, Math.cos(phi), Math.sin(phi)]]);
}

// ---------------------------------------------------------------- applying gates

/**
 * Apply a k-qubit gate to the given target qubits (qubit 0 = most significant).
 * `targets` order maps gate bit 0 to targets[0] as the gate's MOST significant bit,
 * matching kron ordering: a 2-qubit gate on targets [a, b] treats a as its first factor.
 * Optional `controls`: the gate applies only where all control qubits are 1.
 */
export function applyGate(s: State, g: Mat, targets: number[], controls: number[] = []): void {
  const n = s.n;
  const dim = 1 << n;
  const k = targets.length;
  if (g.d !== 1 << k) throw new Error("gate size does not match target count");
  // bit position (from the LEFT, qubit q) -> shift = n-1-q
  const tShift = targets.map((q) => n - 1 - q);
  const cMask = controls.reduce((m, q) => m | (1 << (n - 1 - q)), 0);
  const tMask = tShift.reduce((m, sh) => m | (1 << sh), 0);
  const gd = g.d;
  const subRe = new Float64Array(gd);
  const subIm = new Float64Array(gd);
  for (let base = 0; base < dim; base++) {
    if ((base & tMask) !== 0) continue; // enumerate each subspace once (targets all 0)
    if ((base & cMask) !== cMask) continue; // controls must be 1
    // gather
    for (let v = 0; v < gd; v++) {
      let idx = base;
      for (let b = 0; b < k; b++) {
        if ((v >> (k - 1 - b)) & 1) idx |= 1 << tShift[b];
      }
      subRe[v] = s.re[idx];
      subIm[v] = s.im[idx];
    }
    // multiply and scatter
    for (let r = 0; r < gd; r++) {
      let accRe = 0;
      let accIm = 0;
      for (let c = 0; c < gd; c++) {
        const mr = g.re[r * gd + c];
        const mi = g.im[r * gd + c];
        accRe += mr * subRe[c] - mi * subIm[c];
        accIm += mr * subIm[c] + mi * subRe[c];
      }
      let idx = base;
      for (let b = 0; b < k; b++) {
        if ((r >> (k - 1 - b)) & 1) idx |= 1 << tShift[b];
      }
      s.re[idx] = accRe;
      s.im[idx] = accIm;
    }
  }
}

/** Apply a full 2^n x 2^n unitary (for oracles). */
export function applyUnitary(s: State, u: Mat): void {
  const dim = 1 << s.n;
  if (u.d !== dim) throw new Error("unitary size mismatch");
  const re = new Float64Array(dim);
  const im = new Float64Array(dim);
  for (let r = 0; r < dim; r++) {
    let accRe = 0;
    let accIm = 0;
    for (let c = 0; c < dim; c++) {
      const mr = u.re[r * dim + c];
      const mi = u.im[r * dim + c];
      accRe += mr * s.re[c] - mi * s.im[c];
      accIm += mr * s.im[c] + mi * s.re[c];
    }
    re[r] = accRe;
    im[r] = accIm;
  }
  s.re.set(re);
  s.im.set(im);
}

// ---------------------------------------------------------------- matrix algebra

export function kron(a: Mat, b: Mat): Mat {
  const d = a.d * b.d;
  const out: Mat = { d, re: new Float64Array(d * d), im: new Float64Array(d * d) };
  for (let ar = 0; ar < a.d; ar++)
    for (let ac = 0; ac < a.d; ac++) {
      const are = a.re[ar * a.d + ac];
      const aim = a.im[ar * a.d + ac];
      for (let br = 0; br < b.d; br++)
        for (let bc = 0; bc < b.d; bc++) {
          const r = ar * b.d + br;
          const c = ac * b.d + bc;
          const bre = b.re[br * b.d + bc];
          const bim = b.im[br * b.d + bc];
          out.re[r * d + c] = are * bre - aim * bim;
          out.im[r * d + c] = are * bim + aim * bre;
        }
    }
  return out;
}

export function matMul(a: Mat, b: Mat): Mat {
  const d = a.d;
  if (b.d !== d) throw new Error("matMul size mismatch");
  const out: Mat = { d, re: new Float64Array(d * d), im: new Float64Array(d * d) };
  for (let r = 0; r < d; r++)
    for (let c = 0; c < d; c++) {
      let accRe = 0;
      let accIm = 0;
      for (let k = 0; k < d; k++) {
        const ar = a.re[r * d + k];
        const ai = a.im[r * d + k];
        const br = b.re[k * d + c];
        const bi = b.im[k * d + c];
        accRe += ar * br - ai * bi;
        accIm += ar * bi + ai * br;
      }
      out.re[r * d + c] = accRe;
      out.im[r * d + c] = accIm;
    }
  return out;
}

export function identityMat(d: number): Mat {
  const out: Mat = { d, re: new Float64Array(d * d), im: new Float64Array(d * d) };
  for (let i = 0; i < d; i++) out.re[i * d + i] = 1;
  return out;
}

/**
 * Full 2^n unitary of a gate placed on targets/controls (for the circuit readout).
 * Built by applying the gate to each basis state - simple and obviously correct.
 */
export function gateUnitary(n: number, g: Mat, targets: number[], controls: number[] = []): Mat {
  const dim = 1 << n;
  const out: Mat = { d: dim, re: new Float64Array(dim * dim), im: new Float64Array(dim * dim) };
  for (let c = 0; c < dim; c++) {
    const s = basis(n, c);
    applyGate(s, g, targets, controls);
    for (let r = 0; r < dim; r++) {
      out.re[r * dim + c] = s.re[r];
      out.im[r * dim + c] = s.im[r];
    }
  }
  return out;
}

// ---------------------------------------------------------------- oracles (course conventions)

/** U_f for n input qubits (high bits) and m output qubits: |x>|y> -> |x>|y XOR f(x)>. */
export function oracleUf(f: (x: number) => number, n: number, m: number): Mat {
  const dim = 1 << (n + m);
  const u: Mat = { d: dim, re: new Float64Array(dim * dim), im: new Float64Array(dim * dim) };
  for (let x = 0; x < 1 << n; x++) {
    const fx = f(x);
    for (let y = 0; y < 1 << m; y++) {
      const inIdx = (x << m) | y;
      const outIdx = (x << m) | (y ^ fx);
      u.re[outIdx * dim + inIdx] = 1;
    }
  }
  return u;
}

/** Simon two-to-one function from the Week 10 sheet: f(x) = min(x, x XOR s). */
export function simonF(s: number): (x: number) => number {
  return (x) => Math.min(x, x ^ s);
}

// ---------------------------------------------------------------- measurement & readouts

export function probabilities(s: State): Float64Array {
  const dim = s.re.length;
  const p = new Float64Array(dim);
  for (let i = 0; i < dim; i++) p[i] = s.re[i] * s.re[i] + s.im[i] * s.im[i];
  return p;
}

/** Marginal probabilities of the top `k` qubits (input register). */
export function marginalTop(s: State, k: number): Float64Array {
  const p = probabilities(s);
  const rest = s.n - k;
  const out = new Float64Array(1 << k);
  for (let i = 0; i < p.length; i++) out[i >> rest] += p[i];
  return out;
}

/** Sample one basis index from the distribution. rand in [0,1). */
export function sample(p: Float64Array, rand: number): number {
  let acc = 0;
  for (let i = 0; i < p.length; i++) {
    acc += p[i];
    if (rand < acc) return i;
  }
  return p.length - 1;
}

/** <sigma_axis> on one qubit (axis: "x" | "y" | "z"). */
export function pauliExpectation(s: State, qubit: number, axis: "x" | "y" | "z"): number {
  const t = cloneState(s);
  applyGate(t, GATES[axis.toUpperCase() as "X" | "Y" | "Z"], [qubit]);
  // <s|t>
  let acc = 0;
  for (let i = 0; i < s.re.length; i++) acc += s.re[i] * t.re[i] + s.im[i] * t.im[i];
  return acc;
}

/** The Ex.2 state |psi> = cos(theta/2)|0> + e^{i phi} sin(theta/2)|1>. */
export function qubitState(theta: number, phi: number): State {
  const s = zeros(1);
  s.re[0] = Math.cos(theta / 2);
  s.re[1] = Math.cos(phi) * Math.sin(theta / 2);
  s.im[1] = Math.sin(phi) * Math.sin(theta / 2);
  return s;
}

// ---------------------------------------------------------------- GF(2) solver (Week 10)

/**
 * All s in [1, 2^n) with y.s = 0 (mod 2) for every collected y — the live candidate
 * set of Simon's algorithm (port of solve_gf2 with b = 0, excluding the trivial 0).
 */
export function simonCandidates(ys: number[], n: number): number[] {
  const out: number[] = [];
  for (let cand = 1; cand < 1 << n; cand++) {
    let ok = true;
    for (const y of ys) {
      let dot = y & cand;
      // parity of dot
      let par = 0;
      while (dot) {
        par ^= dot & 1;
        dot >>= 1;
      }
      if (par !== 0) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(cand);
  }
  return out;
}

// ---------------------------------------------------------------- Grover building blocks

/** One Grover iteration on amplitudes (real amplitudes suffice for textbook Grover). */
export function groverIterate(amps: Float64Array, marked: Set<number>): void {
  // oracle: flip marked
  for (const m of marked) amps[m] = -amps[m];
  // diffusion: reflect about the mean
  let mean = 0;
  for (let i = 0; i < amps.length; i++) mean += amps[i];
  mean /= amps.length;
  for (let i = 0; i < amps.length; i++) amps[i] = 2 * mean - amps[i];
}

export function groverOptimalIterations(N: number, M: number): number {
  return Math.floor((Math.PI / 4) * Math.sqrt(N / M));
}

/** Success probability after each of `iters` iterations (index 0 = before any iteration). */
export function groverCurve(n: number, marked: Set<number>, iters: number): number[] {
  const N = 1 << n;
  const amps = new Float64Array(N).fill(1 / Math.sqrt(N));
  const out: number[] = [];
  const success = () => {
    let p = 0;
    for (const m of marked) p += amps[m] * amps[m];
    return p;
  };
  out.push(success());
  for (let k = 0; k < iters; k++) {
    groverIterate(amps, marked);
    out.push(success());
  }
  return out;
}
