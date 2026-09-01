/**
 * The 8-point algorithm — TS port of David's CSE 152A HW2 solution
 * (compute_fundamental + the normalized fundamental_matrix wrapper), fixture-
 * tested against the NumPy reference in tests/fixtures/vision-fmatrix.json
 * (dino F cross-checked against the value printed in the notebook).
 */
import { matMul, svd, transpose, type Mat } from "./linalg";

/** points: 3 x n homogeneous (rows x, y, w). */
export function computeFundamental(x1: Mat, x2: Mat): Mat {
  const n = x1[0].length;
  const A: Mat = [];
  for (let i = 0; i < n; i++) {
    const uo = x1[0][i],
      vo = x1[1][i];
    const up = x2[0][i],
      vp = x2[1][i];
    A.push([uo * up, vo * up, up, uo * vp, vo * vp, vp, uo, vo, 1]);
  }
  const { v } = svd(A);
  // last right-singular vector (smallest sigma) -> F
  const f = v.map((row) => row[8]);
  let F: Mat = [f.slice(0, 3), f.slice(3, 6), f.slice(6, 9)];
  // rank-2 projection: zero the last singular value
  const d = svd(F);
  const S = [
    [d.s[0], 0, 0],
    [0, d.s[1], 0],
    [0, 0, 0],
  ];
  F = matMul(d.u, matMul(S, transpose(d.v)));
  const f22 = F[2][2];
  return F.map((row) => row.map((val) => val / f22));
}

function stats(x: Mat): { mx: number; my: number; s: number } {
  const n = x[0].length;
  let mx = 0,
    my = 0;
  for (let i = 0; i < n; i++) {
    mx += x[0][i];
    my += x[1][i];
  }
  mx /= n;
  my /= n;
  // np.std over BOTH rows jointly (x1[:2]) — population std
  let acc = 0;
  const mean = (mx + my) / 2; // careful: np.std(x1[:2]) uses the grand mean of all 2n values
  for (let i = 0; i < n; i++) {
    acc += (x[0][i] - mean) ** 2 + (x[1][i] - mean) ** 2;
  }
  const s = Math.sqrt(2) / Math.sqrt(acc / (2 * n));
  return { mx, my, s };
}

/** Normalized 8-point (David's fundamental_matrix). points: 3 x n. */
export function fundamentalMatrix(x1In: Mat, x2In: Mat): Mat {
  const norm = (x: Mat) => x.map((row) => row.map((v, i) => v / x[2][i]));
  const x1 = norm(x1In);
  const x2 = norm(x2In);
  const a = stats(x1);
  const T1: Mat = [
    [a.s, 0, -a.s * a.mx],
    [0, a.s, -a.s * a.my],
    [0, 0, 1],
  ];
  const b = stats(x2);
  const T2: Mat = [
    [b.s, 0, -b.s * b.mx],
    [0, b.s, -b.s * b.my],
    [0, 0, 1],
  ];
  const x1n = matMul(T1, x1);
  const x2n = matMul(T2, x2);
  const F0 = computeFundamental(x1n, x2n);
  const F = matMul(transpose(T2), matMul(F0, T1));
  const f22 = F[2][2];
  return F.map((row) => row.map((v) => v / f22));
}

/** Epipolar line in image 2 for a click (x, y) in image 1: l = F [x y 1]^T. */
export function epipolarLine(F: Mat, x: number, y: number): { a: number; b: number; c: number } {
  return {
    a: F[0][0] * x + F[0][1] * y + F[0][2],
    b: F[1][0] * x + F[1][1] * y + F[1][2],
    c: F[2][0] * x + F[2][1] * y + F[2][2],
  };
}

/** Epipolar line in image 1 for a point in image 2: l = F^T [x y 1]^T. */
export function epipolarLineLeft(F: Mat, x: number, y: number): { a: number; b: number; c: number } {
  return {
    a: F[0][0] * x + F[1][0] * y + F[2][0],
    b: F[0][1] * x + F[1][1] * y + F[2][1],
    c: F[0][2] * x + F[1][2] * y + F[2][2],
  };
}

/** Epipole: null vector of F (image-1 epipole) or F^T (image-2). */
export function epipole(F: Mat, ofSecondImage = false): [number, number] {
  const M = ofSecondImage ? transpose(F) : F;
  const { v } = svd(M);
  const e = v.map((row) => row[2]);
  return [e[0] / e[2], e[1] / e[2]];
}
