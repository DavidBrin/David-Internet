/**
 * Small bounded Levenberg–Marquardt curve fitter (curve_fit stand-in) for the
 * exponential-decay and skewed-gaussian fits. Numeric jacobian, box bounds by
 * projection. Verified against scipy through the fit fixtures.
 */

export type ModelFn = (params: number[], out: Float64Array) => void;

export interface LmOptions {
  maxIter?: number;
  tol?: number;
  lower?: number[];
  upper?: number[];
}

export function lmFit(
  model: ModelFn,
  y: ArrayLike<number>,
  p0: number[],
  opts: LmOptions = {},
): number[] {
  const n = y.length;
  const m = p0.length;
  const maxIter = opts.maxIter ?? 200;
  const tol = opts.tol ?? 1e-10;
  const lo = opts.lower ?? new Array(m).fill(-Infinity);
  const hi = opts.upper ?? new Array(m).fill(Infinity);

  const clamp = (p: number[]) => p.map((v, i) => Math.min(hi[i], Math.max(lo[i], v)));

  let p = clamp(p0.slice());
  const f = new Float64Array(n);
  const ft = new Float64Array(n);
  const jac: Float64Array[] = Array.from({ length: m }, () => new Float64Array(n));

  const residSq = (params: number[]): number => {
    model(params, f);
    let s = 0;
    for (let i = 0; i < n; i++) {
      const r = f[i] - (y[i] as number);
      s += r * r;
    }
    return s;
  };

  let cost = residSq(p);
  let lambda = 1e-3;

  for (let iter = 0; iter < maxIter; iter++) {
    model(p, f);
    for (let j = 0; j < m; j++) {
      const h = Math.max(1e-8, Math.abs(p[j]) * 1e-6);
      const pj = p.slice();
      pj[j] = Math.min(hi[j], pj[j] + h);
      const hEff = pj[j] - p[j] || h;
      model(pj, ft);
      const col = jac[j];
      for (let i = 0; i < n; i++) col[i] = (ft[i] - f[i]) / hEff;
    }
    const A: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
    const g = new Array(m).fill(0);
    for (let j = 0; j < m; j++) {
      for (let kk = j; kk < m; kk++) {
        let s = 0;
        for (let i = 0; i < n; i++) s += jac[j][i] * jac[kk][i];
        A[j][kk] = s;
        A[kk][j] = s;
      }
      let s = 0;
      for (let i = 0; i < n; i++) s += jac[j][i] * ((y[i] as number) - f[i]);
      g[j] = s;
    }

    let improved = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const M: number[][] = A.map((row, j) =>
        row.map((v, kk) => (j === kk ? v * (1 + lambda) + 1e-12 : v)),
      );
      const d = solve(M, g.slice());
      if (!d) {
        lambda *= 10;
        continue;
      }
      const pNew = clamp(p.map((v, j) => v + d[j]));
      const cNew = residSq(pNew);
      if (cNew < cost) {
        const rel = (cost - cNew) / Math.max(cost, 1e-30);
        p = pNew;
        cost = cNew;
        lambda = Math.max(lambda / 10, 1e-12);
        improved = true;
        if (rel < tol) return p;
        break;
      }
      lambda *= 10;
    }
    if (!improved) break;
  }
  return p;
}

function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-14) return null;
    if (piv !== col) {
      [A[piv], A[col]] = [A[col], A[piv]];
      [b[piv], b[col]] = [b[col], b[piv]];
    }
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / A[col][col];
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= A[r][c] * x[c];
    x[r] = s / A[r][r];
  }
  return x;
}
