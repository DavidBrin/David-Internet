/**
 * Photometric stereo — TS port of David's CSE 152A HW1 solution
 * (photometric_stereo, lambertian, and the course-provided horn_integrate),
 * fixture-tested against the NumPy pipeline in tests/fixtures/vision-stereo.json.
 *
 * Grids are Float64Array in row-major (h x w) to match the float64 reference.
 */
import { inverse, matMul, transpose, type Mat } from "./linalg";

export interface Grid {
  data: Float64Array;
  w: number;
  h: number;
}

export function grid(w: number, h: number, fill = 0): Grid {
  const data = new Float64Array(w * h);
  if (fill !== 0) data.fill(fill);
  return { data, w, h };
}

/**
 * scipy.signal.convolve(img, kern, mode="same") for a 3x3 kernel, zero padding.
 * True convolution (kernel flipped): out[i,j] = sum_{u,v} kern[u,v] * img[i+1-u, j+1-v].
 */
export function convolveSame3(img: Grid, kern: number[][]): Grid {
  const { w, h, data } = img;
  const out = new Float64Array(w * h);
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      let acc = 0;
      for (let u = 0; u < 3; u++) {
        const ii = i + 1 - u;
        if (ii < 0 || ii >= h) continue;
        for (let v = 0; v < 3; v++) {
          const jj = j + 1 - v;
          if (jj < 0 || jj >= w) continue;
          const k = kern[u][v];
          if (k !== 0) acc += k * data[ii * w + jj];
        }
      }
      out[i * w + j] = acc;
    }
  }
  return { data: out, w, h };
}

export interface StereoResult {
  albedo: Grid;
  /** normals as three h x w planes (nx, ny, nz) */
  nx: Grid;
  ny: Grid;
  nz: Grid;
}

/**
 * Per-pixel least squares N = (L^T L)^-1 L^T I — exactly the HW1 solution's
 * normal-equation form (not a generic pinv). images: one Grid per light,
 * values in [0, 1].
 */
export function photometricStereo(images: Grid[], lights: number[][]): StereoResult {
  const { w, h } = images[0];
  const L: Mat = lights.map((l) => [...l]);
  const Lt = transpose(L);
  const inv = inverse(matMul(Lt, L)); // 3x3
  // pre-multiply: M = inv * L^T, 3 x nImgs
  const M = matMul(inv, Lt);
  const albedo = grid(w, h, 1);
  const nx = grid(w, h);
  const ny = grid(w, h);
  const nz = grid(w, h, 1);
  const nImg = images.length;
  for (let p = 0; p < w * h; p++) {
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let k = 0; k < nImg; k++) {
      const I = images[k].data[p];
      b0 += M[0][k] * I;
      b1 += M[1][k] * I;
      b2 += M[2][k] * I;
    }
    const a = Math.sqrt(b0 * b0 + b1 * b1 + b2 * b2);
    albedo.data[p] = a;
    if (a > 0) {
      nx.data[p] = b0 / a;
      ny.data[p] = b1 / a;
      nz.data[p] = b2 / a;
    } else {
      nx.data[p] = 0;
      ny.data[p] = 0;
      nz.data[p] = 1;
    }
  }
  return { albedo, nx, ny, nz };
}

/** Gradients for integration, as in the solution: gx = -nx/nz, gy = -ny/nz. */
export function stereoGradients(r: StereoResult): { gx: Grid; gy: Grid } {
  const { w, h } = r.albedo;
  const gx = grid(w, h);
  const gy = grid(w, h);
  for (let p = 0; p < w * h; p++) {
    gx.data[p] = -r.nx.data[p] / r.nz.data[p];
    gy.data[p] = -r.ny.data[p] / r.nz.data[p];
  }
  return { gx, gy };
}

const A = [
  [0, 1, 0],
  [0, 0, 0],
  [0, 0, 0],
];
const B = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 0, 0],
];
const C = [
  [0, 0, 0],
  [0, 0, 1],
  [0, 0, 0],
];
const D = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 1, 0],
];
const D_MASK = [
  [0, 1, 0],
  [1, 0, 1],
  [0, 1, 0],
];

export interface HornState {
  g: Grid;
  mask2: Grid;
  termRight: Grid;
}

/** Precompute the constant parts of horn_integrate (mask = all ones). */
export function hornInit(gx: Grid, gy: Grid): HornState {
  const { w, h } = gx;
  const mask = grid(w, h, 1);
  const den = convolveSame3(mask, D_MASK);
  const mask2 = grid(w, h);
  for (let p = 0; p < w * h; p++) mask2.data[p] = 1 / (den.data[p] === 0 ? 1 : den.data[p]);
  const mC = convolveSame3(mask, C);
  const mD = convolveSame3(mask, D);
  const tA = convolveSame3(gx, B);
  const tB = convolveSame3(gy, A);
  const termRight = grid(w, h);
  for (let p = 0; p < w * h; p++) {
    termRight.data[p] =
      mask2.data[p] * (mC.data[p] * gx.data[p] + mD.data[p] * gy.data[p] - tA.data[p] - tB.data[p]);
  }
  return { g: grid(w, h, 1), mask2, termRight };
}

/** Run `iters` Jacobi-style iterations in place; returns the same state. */
export function hornStep(state: HornState, iters: number): HornState {
  const { w, h } = state.g;
  const g = state.g.data;
  const m2 = state.mask2.data;
  const tr = state.termRight.data;
  const next = new Float64Array(w * h);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < h; i++) {
      const up = i > 0 ? (i - 1) * w : -1;
      const dn = i < h - 1 ? (i + 1) * w : -1;
      const row = i * w;
      for (let j = 0; j < w; j++) {
        let s = 0;
        if (up >= 0) s += g[up + j];
        if (dn >= 0) s += g[dn + j];
        if (j > 0) s += g[row + j - 1];
        if (j < w - 1) s += g[row + j + 1];
        next[row + j] = m2[row + j] * s + tr[row + j];
      }
    }
    g.set(next);
  }
  return state;
}

/** The HW1 helper end-to-end: integrate gradients for niter iterations. */
export function hornIntegrate(gx: Grid, gy: Grid, niter: number): Grid {
  const state = hornInit(gx, gy);
  hornStep(state, niter);
  return state.g;
}

/** Lambertian rendering (HW1 solution): I = clip(albedo * max? no — clip(a * (n.l), 0, 1)). */
export function lambertian(r: StereoResult, light: number[], out?: Float64Array): Float64Array {
  const { w, h } = r.albedo;
  const norm = Math.hypot(light[0], light[1], light[2]);
  const lx = light[0] / norm,
    ly = light[1] / norm,
    lz = light[2] / norm;
  const img = out ?? new Float64Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const d = r.nx.data[p] * lx + r.ny.data[p] * ly + r.nz.data[p] * lz;
    let v = r.albedo.data[p] * d;
    if (v < 0) v = 0;
    else if (v > 1) v = 1;
    img[p] = v;
  }
  return img;
}
