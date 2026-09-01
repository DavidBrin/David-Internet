/**
 * Small dense linear algebra for the vision demo.
 *
 * - one-sided Jacobi SVD (enough for the 8-point algorithm's n x 9 system and
 *   the 3x3 rank-2 projection),
 * - Gaussian-elimination solve / inverse for the 3x3 and 4x4 normal equations.
 *
 * All Float64 to match the NumPy reference the fixtures were generated with.
 */

export type Mat = number[][]; // row-major

export function matMul(a: Mat, b: Mat): Mat {
  const n = a.length,
    m = b[0].length,
    k = b.length;
  const out: Mat = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let p = 0; p < k; p++) {
      const v = a[i][p];
      if (v === 0) continue;
      for (let j = 0; j < m; j++) out[i][j] += v * b[p][j];
    }
  return out;
}

export function transpose(a: Mat): Mat {
  return a[0].map((_, j) => a.map((row) => row[j]));
}

/** Solve A x = b for square A (partial pivoting). Throws on singular. */
export function solve(a: Mat, b: number[]): number[] {
  const n = a.length;
  const M = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-14) throw new Error("singular matrix");
    if (piv !== col) [M[piv], M[col]] = [M[col], M[piv]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export function inverse(a: Mat): Mat {
  const n = a.length;
  const cols: number[][] = [];
  for (let j = 0; j < n; j++) {
    const e = new Array(n).fill(0);
    e[j] = 1;
    cols.push(solve(a, e));
  }
  return transpose(cols);
}

export interface Svd {
  /** left singular vectors as columns, m x r */
  u: Mat;
  /** singular values, descending */
  s: number[];
  /** right singular vectors as columns, n x r */
  v: Mat;
}

/**
 * One-sided Jacobi SVD of an m x n matrix (m >= n after implicit transpose).
 * Returns full n singular triplets sorted descending. Deterministic.
 */
export function svd(aIn: Mat): Svd {
  let a = aIn;
  let transposed = false;
  if (a.length < a[0].length) {
    a = transpose(a);
    transposed = true;
  }
  const m = a.length;
  const n = a[0].length;
  // B = A (columns will be rotated), V accumulates rotations
  const B = a.map((row) => [...row]);
  const V: Mat = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  const EPS = 1e-13;
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        let alpha = 0,
          beta = 0,
          gamma = 0;
        for (let i = 0; i < m; i++) {
          alpha += B[i][p] * B[i][p];
          beta += B[i][q] * B[i][q];
          gamma += B[i][p] * B[i][q];
        }
        off = Math.max(off, Math.abs(gamma) / Math.sqrt(alpha * beta + 1e-300));
        if (Math.abs(gamma) < EPS * Math.sqrt(alpha * beta)) continue;
        const zeta = (beta - alpha) / (2 * gamma);
        const t = Math.sign(zeta) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = c * t;
        for (let i = 0; i < m; i++) {
          const bp = B[i][p];
          B[i][p] = c * bp - s * B[i][q];
          B[i][q] = s * bp + c * B[i][q];
        }
        for (let i = 0; i < n; i++) {
          const vp = V[i][p];
          V[i][p] = c * vp - s * V[i][q];
          V[i][q] = s * vp + c * V[i][q];
        }
      }
    }
    if (off < EPS) break;
  }
  // singular values = column norms; U = B / s
  const trip: { s: number; u: number[]; v: number[] }[] = [];
  for (let j = 0; j < n; j++) {
    let norm = 0;
    for (let i = 0; i < m; i++) norm += B[i][j] * B[i][j];
    norm = Math.sqrt(norm);
    const u = new Array(m).fill(0);
    if (norm > 1e-300) for (let i = 0; i < m; i++) u[i] = B[i][j] / norm;
    trip.push({ s: norm, u, v: V.map((row) => row[j]) });
  }
  trip.sort((x, y) => y.s - x.s);
  const s = trip.map((t) => t.s);
  const uCols = trip.map((t) => t.u);
  const vCols = trip.map((t) => t.v);
  const U: Mat = Array.from({ length: m }, (_, i) => uCols.map((col) => col[i]));
  const Vout: Mat = Array.from({ length: n }, (_, i) => vCols.map((col) => col[i]));
  if (transposed) return { u: Vout, s, v: U };
  return { u: U, s, v: Vout };
}
