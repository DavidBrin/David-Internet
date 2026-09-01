/**
 * Edge + corner detection — TS port of David's CSE 152A HW2 solution
 * (gaussian2d, smooth, gradient, and the Sobel corner_detect), fixture-tested
 * in tests/fixtures/vision-harris.json.
 *
 * Faithfulness note: David's corner_detect calls convolve2d with the default
 * mode="full", so the minor-eigenvalue image is 2 px larger than the input and
 * corner coordinates are offset by +1. The port reproduces that quirk.
 */
import type { Grid } from "./stereo";

export function gridFrom(data: Float64Array, w: number, h: number): Grid {
  return { data, w, h };
}

/** scipy convolve2d mode="full" (true convolution, zero padding). */
export function convolve2dFull(img: Grid, kern: number[][]): Grid {
  const kh = kern.length,
    kw = kern[0].length;
  const oh = img.h + kh - 1,
    ow = img.w + kw - 1;
  const out = new Float64Array(ow * oh);
  for (let i = 0; i < oh; i++) {
    for (let u = 0; u < kh; u++) {
      const ii = i - u;
      if (ii < 0 || ii >= img.h) continue;
      for (let v = 0; v < kw; v++) {
        const k = kern[u][v];
        if (k === 0) continue;
        const base = ii * img.w;
        const jmin = Math.max(0, v);
        const jmax = Math.min(ow - 1, img.w - 1 + v);
        for (let j = jmin; j <= jmax; j++) {
          out[i * ow + j] += k * img.data[base + j - v];
        }
      }
    }
  }
  return { data: out, w: ow, h: oh };
}

/** scipy convolve2d mode="same" (centered crop of full). */
export function convolve2dSame(img: Grid, kern: number[][]): Grid {
  const full = convolve2dFull(img, kern);
  const kh = kern.length,
    kw = kern[0].length;
  const r0 = (kh - 1) >> 1;
  const c0 = (kw - 1) >> 1;
  const out = new Float64Array(img.w * img.h);
  for (let i = 0; i < img.h; i++)
    for (let j = 0; j < img.w; j++) out[i * img.w + j] = full.data[(i + r0) * full.w + (j + c0)];
  return { data: out, w: img.w, h: img.h };
}

/** HW2's gaussian2d(filter_size, sig) — note the python // semantics for the axis. */
export function gaussian2d(filterSize: number, sig: number): number[][] {
  // np.arange(-filter_size // 2 + 1, filter_size // 2 + 1)
  // NB python floor division: -9 // 2 == -5, so lo = -4 for a 9-tap filter.
  const lo = Math.floor(-filterSize / 2) + 1;
  const hi = Math.floor(filterSize / 2) + 1;
  const ax: number[] = [];
  for (let v = lo; v < hi; v++) ax.push(v);
  let sum = 0;
  const k = ax.map((y) => ax.map((x) => Math.exp(-0.5 * (x * x + y * y) / (sig * sig))));
  for (const row of k) for (const v of row) sum += v;
  return k.map((row) => row.map((v) => v / sum));
}

/** HW2's smooth(): 9x9 gaussian, mode="same". */
export function smooth(img: Grid, sig = 1.2): Grid {
  return convolve2dSame(img, gaussian2d(9, sig));
}

/** HW2's gradient(): central differences, magnitude + direction. */
export function gradient(img: Grid): { mag: Grid; theta: Grid } {
  const kernx = [
    [0, 0, 0],
    [0.5, 0, -0.5],
    [0, 0, 0],
  ];
  const kerny = [
    [0, 0.5, 0],
    [0, 0, 0],
    [0, -0.5, 0],
  ];
  const gx = convolve2dSame(img, kernx);
  const gy = convolve2dSame(img, kerny);
  const mag = new Float64Array(img.w * img.h);
  const theta = new Float64Array(img.w * img.h);
  for (let p = 0; p < mag.length; p++) {
    mag[p] = Math.hypot(gx.data[p], gy.data[p]);
    theta[p] = Math.atan2(gy.data[p], gx.data[p]);
  }
  return { mag: gridFrom(mag, img.w, img.h), theta: gridFrom(theta, img.w, img.h) };
}

const SOBEL_X = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
];
const SOBEL_Y = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1],
];

export interface CornerResult {
  /** minor eigenvalue image — (h+2) x (w+2), David's mode="full" quirk */
  minor: Grid;
  /** corners in x-y coordinates of the minor image, strongest first */
  corners: [number, number][];
}

/** David's Sobel corner_detect (HW2 cell 6), exactly — including the grid NMS. */
export function cornerDetect(img: Grid, nCorners: number, smoothStd: number): CornerResult {
  const Ix = convolve2dFull(img, SOBEL_X);
  const Iy = convolve2dFull(img, SOBEL_Y);
  const n = Ix.w * Ix.h;
  const ixx = new Float64Array(n);
  const iyy = new Float64Array(n);
  const ixy = new Float64Array(n);
  for (let p = 0; p < n; p++) {
    ixx[p] = Ix.data[p] * Ix.data[p];
    iyy[p] = Iy.data[p] * Iy.data[p];
    ixy[p] = Ix.data[p] * Iy.data[p];
  }
  const Sxx = smooth(gridFrom(ixx, Ix.w, Ix.h), smoothStd);
  const Syy = smooth(gridFrom(iyy, Ix.w, Ix.h), smoothStd);
  const Sxy = smooth(gridFrom(ixy, Ix.w, Ix.h), smoothStd);
  const minor = new Float64Array(n);
  for (let p = 0; p < n; p++) {
    const tr = Sxx.data[p] + Syy.data[p];
    const det = Sxx.data[p] * Syy.data[p] - Sxy.data[p] * Sxy.data[p];
    minor[p] = tr / 2 - Math.sqrt((tr * tr) / 4 - det);
  }
  const W = Ix.w,
    H = Ix.h;
  // 3x3 local-maxima suppression (interior only, ties keep the value — == np.max)
  const sup = new Float64Array(n);
  for (let i = 1; i < H - 1; i++) {
    for (let j = 1; j < W - 1; j++) {
      const v = minor[i * W + j];
      let isMax = true;
      for (let di = -1; di <= 1 && isMax; di++)
        for (let dj = -1; dj <= 1; dj++)
          if (minor[(i + di) * W + (j + dj)] > v) {
            isMax = false;
            break;
          }
      if (isMax) sup[i * W + j] = v;
    }
  }
  const grid = Math.floor(Math.sqrt(nCorners));
  const cands: [number, number][] = [];
  for (let i = 0; i < H; i += grid) {
    for (let j = 0; j < W; j += grid) {
      let bi = i,
        bj = j,
        bv = -Infinity;
      for (let ii = i; ii < Math.min(i + grid, H); ii++)
        for (let jj = j; jj < Math.min(j + grid, W); jj++)
          if (sup[ii * W + jj] > bv) {
            bv = sup[ii * W + jj];
            bi = ii;
            bj = jj;
          }
      cands.push([bi, bj]);
    }
  }
  cands.sort((a, b) => sup[b[0] * W + b[1]] - sup[a[0] * W + a[1]]);
  const corners = cands.slice(0, nCorners).map(([r, c]) => [c, r] as [number, number]);
  return { minor: gridFrom(minor, W, H), corners };
}
