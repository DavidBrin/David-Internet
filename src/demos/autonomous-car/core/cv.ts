/**
 * The OpenCV 8-bit operations David's lane_detection_node.py calls, ported to TS so
 * the pipeline runs frame by frame in the browser. Each follows OpenCV 4.x's own
 * fixed-point / tie-breaking behaviour (not a "similar" algorithm) and is
 * fixture-tested against cv2 4.11 in tests/fixtures/autonomous-car-cv.json:
 *
 *   cvtColor BGR2HSV / BGR2GRAY   integer tables (hsv_shift 12, gray_shift 15)
 *   inRange, bitwise_and(mask), threshold(THRESH_BINARY)
 *   blur                           box filter, BORDER_REFLECT_101, 16-bit fixed point
 *   erode / dilate                 rect kernel, iterations folded into one bigger kernel
 *   findContours                   RETR_EXTERNAL + CHAIN_APPROX_NONE (Suzuki border following)
 *   convexHull + minAreaRect       Sklansky hull + rotating calipers, float32 math
 *   moments                        contour (polygon) moments, sign-normalised
 */

/** Interleaved 8-bit image, OpenCV layout (BGR for 3 channels). */
export interface Mat {
  w: number;
  h: number;
  c: 1 | 3;
  data: Uint8Array;
}

export function mat(w: number, h: number, c: 1 | 3): Mat {
  return { w, h, c, data: new Uint8Array(w * h * c) };
}

/** RGBA canvas pixels → BGR Mat (what cv_bridge hands the node). */
export function bgrFromRGBA(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Mat {
  const out = mat(w, h, 3);
  const d = out.data;
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    d[i * 3] = rgba[j + 2];
    d[i * 3 + 1] = rgba[j + 1];
    d[i * 3 + 2] = rgba[j];
  }
  return out;
}

/** frame[y0:y1, x0:x1] (a copy; numpy would hand back a view). */
export function crop(src: Mat, x0: number, y0: number, x1: number, y1: number): Mat {
  const w = x1 - x0,
    h = y1 - y0,
    c = src.c;
  const out = mat(w, h, c);
  for (let y = 0; y < h; y++) {
    const s = ((y0 + y) * src.w + x0) * c;
    out.data.set(src.data.subarray(s, s + w * c), y * w * c);
  }
  return out;
}

// ---------------------------------------------------------------- color

const HSV_SHIFT = 12;
const SDIV = new Int32Array(256);
const HDIV180 = new Int32Array(256);
for (let i = 1; i < 256; i++) {
  SDIV[i] = Math.round((255 << HSV_SHIFT) / i);
  HDIV180[i] = Math.round((180 << HSV_SHIFT) / (6 * i));
}

/** cv2.cvtColor(img, cv2.COLOR_BGR2HSV) for 8-bit: H in [0,180), S,V in [0,255]. */
export function bgr2hsv(src: Mat): Mat {
  const out = mat(src.w, src.h, 3);
  const s = src.data,
    d = out.data;
  const half = 1 << (HSV_SHIFT - 1);
  for (let i = 0; i < s.length; i += 3) {
    const b = s[i],
      g = s[i + 1],
      r = s[i + 2];
    let v = b > g ? b : g;
    if (r > v) v = r;
    let vmin = b < g ? b : g;
    if (r < vmin) vmin = r;
    const diff = v - vmin;
    const vr = v === r ? -1 : 0;
    const vg = v === g ? -1 : 0;
    const sat = (diff * SDIV[v] + half) >> HSV_SHIFT;
    let h =
      (vr & (g - b)) + (~vr & ((vg & (b - r + 2 * diff)) + (~vg & (r - g + 4 * diff))));
    h = (h * HDIV180[diff] + half) >> HSV_SHIFT;
    if (h < 0) h += 180;
    d[i] = h;
    d[i + 1] = sat;
    d[i + 2] = v;
  }
  return out;
}

/** cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), OpenCV 4.x 15-bit coefficients: (B*3735 + G*19235 + R*9798 + 2^14) >> 15. */
export function bgr2gray(src: Mat): Mat {
  const out = mat(src.w, src.h, 1);
  const s = src.data,
    d = out.data;
  for (let i = 0, j = 0; j < d.length; i += 3, j++) {
    d[j] = (s[i] * 3735 + s[i + 1] * 19235 + s[i + 2] * 9798 + 16384) >> 15;
  }
  return out;
}

/** cv2.inRange(src, lower, upper) with inclusive bounds on every channel. */
export function inRange(src: Mat, lo: [number, number, number], hi: [number, number, number]): Mat {
  const out = mat(src.w, src.h, 1);
  const s = src.data,
    d = out.data;
  for (let i = 0, j = 0; j < d.length; i += 3, j++) {
    const a = s[i],
      b = s[i + 1],
      c = s[i + 2];
    d[j] = a >= lo[0] && a <= hi[0] && b >= lo[1] && b <= hi[1] && c >= lo[2] && c <= hi[2] ? 255 : 0;
  }
  return out;
}

export function bitwiseNot(src: Mat): Mat {
  const out = mat(src.w, src.h, src.c);
  for (let i = 0; i < src.data.length; i++) out.data[i] = 255 - src.data[i];
  return out;
}

/** cv2.bitwise_and(src, src, mask=mask): src where mask != 0, else 0. */
export function maskCopy(src: Mat, mask: Mat): Mat {
  const out = mat(src.w, src.h, src.c);
  const c = src.c;
  for (let j = 0; j < mask.data.length; j++) {
    if (mask.data[j] === 0) continue;
    for (let k = 0; k < c; k++) out.data[j * c + k] = src.data[j * c + k];
  }
  return out;
}

/** cv2.threshold(src, t, maxval, cv2.THRESH_BINARY)[1] for 8-bit input. */
export function threshold(src: Mat, t: number, maxval = 255): Mat {
  const out = mat(src.w, src.h, 1);
  const th = Math.floor(t); // 8-bit: OpenCV compares against floor(thresh)
  for (let i = 0; i < src.data.length; i++) out.data[i] = src.data[i] > th ? maxval : 0;
  return out;
}

// ---------------------------------------------------------------- filters

/** BORDER_REFLECT_101 index: gfedcb|abcdefgh|gfedcba */
function reflect101(p: number, n: number): number {
  if (n === 1) return 0;
  while (p < 0 || p >= n) {
    if (p < 0) p = -p;
    if (p >= n) p = 2 * n - 2 - p;
  }
  return p;
}

/**
 * cv2.blur(src, (k, k)) on a single-channel 8-bit image. For kernel areas <= 256
 * OpenCV sums in 16 bits and divides with a fixed-point reciprocal
 * ((sum + divDelta) * divScale) >> 16; larger kernels use a rounded double scale.
 */
export function blur(src: Mat, k: number): Mat {
  const { w, h } = src;
  const out = mat(w, h, 1);
  if (k <= 1) {
    out.data.set(src.data);
    return out;
  }
  const a = k >> 1; // anchor
  const rows = new Int32Array(w * h);
  for (let y = 0; y < h; y++) {
    const base = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let t = 0; t < k; t++) s += src.data[base + reflect101(x - a + t, w)];
      rows[base + x] = s;
    }
  }
  const area = k * k;
  let divScale = 1,
    divDelta = 0;
  const fixed = area <= 256;
  if (fixed) {
    const d = area;
    let scalef = 65536 / d;
    divScale = Math.floor(scalef);
    scalef -= divScale;
    divDelta = d >> 1;
    if (scalef < 0.5) divDelta++;
    else divScale++;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let t = 0; t < k; t++) s += rows[reflect101(y - a + t, h) * w + x];
      let v: number;
      if (fixed) v = Math.floor(((s + divDelta) * divScale) / 65536);
      else v = roundHalfEven(s / area);
      out.data[y * w + x] = v > 255 ? 255 : v;
    }
  }
  return out;
}

function roundHalfEven(v: number): number {
  const f = Math.floor(v);
  const r = v - f;
  if (r > 0.5) return f + 1;
  if (r < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * erode/dilate with np.ones((k,k)) and `iterations`. OpenCV folds iterations of an
 * all-ones kernel into one pass with size k + (it-1)(k-1) and anchor a*it; the
 * default constant border is ignored (never wins the min/max).
 */
function morph(src: Mat, k: number, iterations: number, isMax: boolean): Mat {
  const { w, h } = src;
  const out = mat(w, h, 1);
  if (iterations <= 0 || k <= 1) {
    out.data.set(src.data);
    return out;
  }
  const K = k + (iterations - 1) * (k - 1);
  const a = (k >> 1) * iterations;
  const tmp = new Uint8Array(w * h);
  const pick = isMax ? (p: number, q: number) => (q > p ? q : p) : (p: number, q: number) => (q < p ? q : p);
  const init = isMax ? 0 : 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = init;
      const x0 = Math.max(0, x - a),
        x1 = Math.min(w - 1, x - a + K - 1);
      for (let t = x0; t <= x1; t++) v = pick(v, src.data[y * w + t]);
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - a),
      y1 = Math.min(h - 1, y - a + K - 1);
    for (let x = 0; x < w; x++) {
      let v = init;
      for (let t = y0; t <= y1; t++) v = pick(v, tmp[t * w + x]);
      out.data[y * w + x] = v;
    }
  }
  return out;
}

export const erode = (src: Mat, k: number, it: number) => morph(src, k, it, false);
export const dilate = (src: Mat, k: number, it: number) => morph(src, k, it, true);

// ---------------------------------------------------------------- contours

export type Pt = [number, number];

/** icvCodeDeltas: 0 right, 1 up-right, 2 up, 3 up-left, 4 left, 5 down-left, 6 down, 7 down-right */
const CODE_DX = [1, 1, 0, -1, -1, -1, 0, 1];
const CODE_DY = [0, -1, -1, -1, 0, 1, 1, 1];

/**
 * cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0].
 * Suzuki-Abe border following on a zero-padded copy (as OpenCV >= 3.2 does), outer
 * borders only, returned in OpenCV's order: last-found first (bottom of the image
 * first for separate blobs).
 */
export function findContoursExternal(bw: Mat): Pt[][] {
  const W = bw.w + 2,
    H = bw.h + 2;
  const img = new Int8Array(W * H);
  for (let y = 0; y < bw.h; y++)
    for (let x = 0; x < bw.w; x++) img[(y + 1) * W + x + 1] = bw.data[y * bw.w + x] ? 1 : 0;
  const deltas = new Int32Array(16);
  for (let s = 0; s < 8; s++) deltas[s] = deltas[s + 8] = CODE_DY[s] * W + CODE_DX[s];

  // cvFindNextContour, mode 0 (RETR_EXTERNAL); nbd is always 2 in icvFetchContour
  const NBD = 2;
  const found: Pt[][] = [];
  for (let y = 1; y < H - 1; y++) {
    let prev = 0;
    let lnbdX = 0; // last marked border pixel on this row (value & -2 != 0)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const p = img[i];
      if (p === prev) continue;
      let skip = false;
      let isHole = false;
      if (!(prev === 0 && p === 1)) {
        if (p !== 0 || prev < 1) skip = true;
        else isHole = true;
      }
      // RETR_EXTERNAL: no holes, and nothing that starts inside a traced outer border
      if (!skip && (isHole || img[y * W + lnbdX] > 0)) skip = true;
      if (!skip) {
        const pts = trace(img, W, i, deltas, NBD);
        found.push(pts.map(([px, py]) => [px - 1, py - 1] as Pt));
      }
      prev = p;
      if (prev & -2) lnbdX = x;
    }
  }
  // contours are linked at the head of the list, so OpenCV returns them last-found first
  found.reverse();
  return found;
}

function trace(img: Int8Array, W: number, i0: number, deltas: Int32Array, nbd: number): Pt[] {
  const pts: Pt[] = [];
  let px = i0 % W,
    py = (i0 - px) / W;
  let s = 4;
  const sEnd0 = 4;
  let i1 = 0;
  do {
    s = (s - 1) & 7;
    i1 = i0 + deltas[s];
  } while (img[i1] === 0 && s !== sEnd0);

  if (s === sEnd0) {
    img[i0] = nbd | -128;
    pts.push([px, py]);
    return pts;
  }
  let i3 = i0;
  for (;;) {
    const sEnd = s;
    let i4 = 0;
    for (;;) {
      s++;
      i4 = i3 + deltas[s];
      if (img[i4] !== 0) break;
      if (s >= 15) break;
    }
    s &= 7;
    if (((s - 1) >>> 0) < (sEnd >>> 0)) img[i3] = nbd | -128;
    else if (img[i3] === 1) img[i3] = nbd;
    // CHAIN_APPROX_NONE writes every point
    pts.push([px, py]);
    px += CODE_DX[s];
    py += CODE_DY[s];
    if (i4 === i0 && i3 === i1) break;
    i3 = i4;
    s = (s + 4) & 7;
  }
  return pts;
}

// ---------------------------------------------------------------- moments

export interface Moments {
  m00: number;
  m10: number;
  m01: number;
}

/** cv2.moments(contour) (polygon moments via Green's theorem, sign-normalised). */
export function contourMoments(pts: Pt[]): Moments {
  const n = pts.length;
  if (n === 0) return { m00: 0, m10: 0, m01: 0 };
  let a00 = 0,
    a10 = 0,
    a01 = 0;
  let xi = pts[n - 1][0],
    yi = pts[n - 1][1];
  for (let i = 0; i < n; i++) {
    const xi1 = xi,
      yi1 = yi;
    xi = pts[i][0];
    yi = pts[i][1];
    const dxy = xi1 * yi - xi * yi1;
    a00 += dxy;
    a10 += dxy * (xi1 + xi);
    a01 += dxy * (yi1 + yi);
  }
  if (Math.abs(a00) > 1.1920928955078125e-7) {
    const s2 = a00 > 0 ? 0.5 : -0.5;
    const s6 = a00 > 0 ? 1 / 6 : -1 / 6;
    return { m00: a00 * s2, m10: a10 * s6, m01: a01 * s6 };
  }
  return { m00: 0, m10: 0, m01: 0 };
}

// ---------------------------------------------------------------- hull + minAreaRect

function sklansky(arr: Pt[], start: number, end: number, stack: Int32Array, off: number, nsign: number, sign2: number): number {
  const incr = end > start ? 1 : -1;
  let pprev = start,
    pcur = pprev + incr,
    pnext = pcur + incr;
  let stacksize = 3;
  if (start === end || (arr[start][0] === arr[end][0] && arr[start][1] === arr[end][1])) {
    stack[off] = start;
    return 1;
  }
  stack[off] = pprev;
  stack[off + 1] = pcur;
  stack[off + 2] = pnext;
  end += incr;
  while (pnext !== end) {
    const cury = arr[pcur][1];
    const nexty = arr[pnext][1];
    const by = nexty - cury;
    if (Math.sign(by) !== nsign) {
      const ax = arr[pcur][0] - arr[pprev][0];
      const bx = arr[pnext][0] - arr[pcur][0];
      const ay = cury - arr[pprev][1];
      const convexity = ay * bx - ax * by;
      if (Math.sign(convexity) === sign2 && (ax !== 0 || ay !== 0)) {
        pprev = pcur;
        pcur = pnext;
        pnext += incr;
        stack[off + stacksize] = pnext;
        stacksize++;
      } else if (pprev === start) {
        pcur = pnext;
        stack[off + 1] = pcur;
        pnext += incr;
        stack[off + 2] = pnext;
      } else {
        stack[off + stacksize - 2] = pnext;
        pcur = pprev;
        pprev = stack[off + stacksize - 4];
        stacksize--;
      }
    } else {
      pnext += incr;
      stack[off + stacksize - 1] = pnext;
    }
  }
  return --stacksize;
}

/** cv2.convexHull(points, clockwise, returnPoints=True) for integer points (Sklansky). */
export function convexHull(points: Pt[], clockwise: boolean): Pt[] {
  const total = points.length;
  if (total === 0) return [];
  const order = Array.from({ length: total }, (_, i) => i);
  // std::sort is not stable; ties are exact duplicates, which the hull tolerates
  order.sort((a, b) => points[a][0] - points[b][0] || points[a][1] - points[b][1]);
  const P = order.map((i) => points[i]);
  let miny = 0,
    maxy = 0;
  for (let i = 1; i < total; i++) {
    const y = P[i][1];
    if (P[miny][1] > y) miny = i;
    if (P[maxy][1] < y) maxy = i;
  }
  const stack = new Int32Array(total + 2);
  const hull: number[] = [];
  if (P[0][0] === P[total - 1][0] && P[0][1] === P[total - 1][1]) {
    hull.push(order[0]);
  } else {
    let tl = 0,
      tlCount = sklansky(P, 0, maxy, stack, 0, -1, 1);
    let tr = tlCount,
      trCount = sklansky(P, total - 1, maxy, stack, tr, -1, -1);
    if (!clockwise) {
      [tl, tr] = [tr, tl];
      [tlCount, trCount] = [trCount, tlCount];
    }
    for (let i = 0; i < tlCount - 1; i++) hull.push(order[stack[tl + i]]);
    for (let i = trCount - 1; i > 0; i--) hull.push(order[stack[tr + i]]);
    const stopIdx = trCount > 2 ? stack[tr + 1] : tlCount > 2 ? stack[tl + tlCount - 2] : -1;

    let bl = 0,
      blCount = sklansky(P, 0, miny, stack, 0, 1, -1);
    let br = blCount,
      brCount = sklansky(P, total - 1, miny, stack, br, 1, 1);
    if (clockwise) {
      [bl, br] = [br, bl];
      [blCount, brCount] = [brCount, blCount];
    }
    if (stopIdx >= 0) {
      const checkIdx = blCount > 2 ? stack[bl + 1] : blCount + brCount > 2 ? stack[br + 2 - blCount] : -1;
      if (
        checkIdx === stopIdx ||
        (checkIdx >= 0 && P[checkIdx][0] === P[stopIdx][0] && P[checkIdx][1] === P[stopIdx][1])
      ) {
        blCount = Math.min(blCount, 2);
        brCount = Math.min(brCount, 2);
      }
    }
    for (let i = 0; i < blCount - 1; i++) hull.push(order[stack[bl + i]]);
    for (let i = brCount - 1; i > 0; i--) hull.push(order[stack[br + i]]);

    // cyclic shift so the original indices ascend or descend, like OpenCV
    const nout = hull.length;
    if (nout >= 3) {
      let minI = 0,
        maxI = 0,
        lt = 0;
      for (let i = 1; i < nout; i++) {
        const idx = hull[i];
        lt += hull[i - 1] < idx ? 1 : 0;
        if (lt > 1 && lt <= i - 2) break;
        if (idx < hull[minI]) minI = i;
        if (idx > hull[maxI]) maxI = i;
      }
      const mmdist = Math.abs(maxI - minI);
      if ((mmdist === 1 || mmdist === nout - 1) && (lt <= 1 || lt >= nout - 2)) {
        const ascending = (maxI + 1) % nout === minI;
        const i0 = ascending ? minI : maxI;
        let j = i0;
        if (i0 > 0) {
          const tmp: number[] = [];
          let i = 0;
          for (; i < nout; i++) {
            const cur = hull[j];
            tmp.push(cur);
            const nj = j + 1 < nout ? j + 1 : 0;
            const nxt = hull[nj];
            if (i < nout - 1 && ascending !== cur < nxt) break;
            j = nj;
          }
          if (i === nout) for (let t = 0; t < nout; t++) hull[t] = tmp[t];
        }
      }
    }
  }
  return hull.map((i) => points[i]);
}

export interface RotatedRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** degrees, OpenCV convention */
  angle: number;
  corners: Pt[];
}

const f32 = Math.fround;

/** Rotating calipers, CALIPERS_MINAREARECT branch, in float32 like rotcalipers.cpp. */
function rotatingCalipers(pts: [number, number][]): [number, number][] {
  const n = pts.length;
  const vx = new Float32Array(n),
    vy = new Float32Array(n),
    inv = new Float32Array(n);
  let left = 0,
    bottom = 0,
    right = 0,
    top = 0;
  let leftX = pts[0][0],
    rightX = pts[0][0],
    topY = pts[0][1],
    bottomY = pts[0][1];
  let p0 = pts[0];
  for (let i = 0; i < n; i++) {
    if (p0[0] < leftX) (leftX = p0[0]), (left = i);
    if (p0[0] > rightX) (rightX = p0[0]), (right = i);
    if (p0[1] > topY) (topY = p0[1]), (top = i);
    if (p0[1] < bottomY) (bottomY = p0[1]), (bottom = i);
    const p = pts[i + 1 < n ? i + 1 : 0];
    const dx = p[0] - p0[0],
      dy = p[1] - p0[1];
    vx[i] = dx;
    vy[i] = dy;
    inv[i] = f32(1 / Math.sqrt(dx * dx + dy * dy));
    p0 = p;
  }
  let orientation = 0;
  {
    let ax = vx[n - 1],
      ay = vy[n - 1];
    for (let i = 0; i < n; i++) {
      const bx = vx[i],
        by = vy[i];
      const conv = ax * by - ay * bx;
      if (conv !== 0) {
        orientation = conv > 0 ? 1 : -1;
        break;
      }
      ax = bx;
      ay = by;
    }
  }
  let baseA = f32(orientation),
    baseB = 0;
  const seq = [bottom, right, top, left];
  let minarea = 3.4028234663852886e38;
  let best: { l: number; a: number; w: number; b: number; h: number; bt: number } | null = null;
  for (let k = 0; k < n; k++) {
    const dp = [
      f32(f32(baseA * vx[seq[0]]) + f32(baseB * vy[seq[0]])),
      f32(f32(-baseB * vx[seq[1]]) + f32(baseA * vy[seq[1]])),
      f32(f32(-baseA * vx[seq[2]]) - f32(baseB * vy[seq[2]])),
      f32(f32(baseB * vx[seq[3]]) - f32(baseA * vy[seq[3]])),
    ];
    let main = 0;
    let maxcos = f32(dp[0] * inv[seq[0]]);
    for (let i = 1; i < 4; i++) {
      const c = f32(dp[i] * inv[seq[i]]);
      if (c > maxcos) {
        main = i;
        maxcos = c;
      }
    }
    const pi = seq[main];
    const lx = f32(vx[pi] * inv[pi]),
      ly = f32(vy[pi] * inv[pi]);
    switch (main) {
      case 0:
        baseA = lx;
        baseB = ly;
        break;
      case 1:
        baseA = ly;
        baseB = -lx;
        break;
      case 2:
        baseA = -lx;
        baseB = -ly;
        break;
      default:
        baseA = -ly;
        baseB = lx;
    }
    seq[main] += 1;
    if (seq[main] === n) seq[main] = 0;

    let dx = f32(pts[seq[1]][0] - pts[seq[3]][0]);
    let dy = f32(pts[seq[1]][1] - pts[seq[3]][1]);
    const width = f32(f32(dx * baseA) + f32(dy * baseB));
    dx = f32(pts[seq[2]][0] - pts[seq[0]][0]);
    dy = f32(pts[seq[2]][1] - pts[seq[0]][1]);
    const height = f32(f32(-dx * baseB) + f32(dy * baseA));
    const area = f32(width * height);
    if (area <= minarea) {
      minarea = area;
      best = { l: seq[3], a: baseA, w: width, b: baseB, h: height, bt: seq[0] };
    }
  }
  const b = best!;
  const A1 = b.a,
    B1 = b.b,
    A2 = -b.b,
    B2 = b.a;
  const C1 = f32(f32(A1 * pts[b.l][0]) + f32(pts[b.l][1] * B1));
  const C2 = f32(f32(A2 * pts[b.bt][0]) + f32(pts[b.bt][1] * B2));
  const idet = f32(1 / f32(f32(A1 * B2) - f32(A2 * B1)));
  const px = f32(f32(f32(C1 * B2) - f32(C2 * B1)) * idet);
  const py = f32(f32(f32(A1 * C2) - f32(A2 * C1)) * idet);
  return [
    [px, py],
    [f32(A1 * b.w), f32(B1 * b.w)],
    [f32(A2 * b.h), f32(B2 * b.h)],
  ];
}

/** cv2.minAreaRect(contour) → ((cx, cy), (w, h), angle). */
export function minAreaRect(points: Pt[]): RotatedRect {
  const hull = convexHull(points, false).map(([x, y]) => [f32(x), f32(y)] as [number, number]);
  const n = hull.length;
  let cx = 0,
    cy = 0,
    w = 0,
    h = 0,
    angle = 0;
  if (n > 2) {
    const [o, e1, e2] = rotatingCalipers(hull);
    cx = f32(o[0] + f32(f32(e1[0] + e2[0]) * 0.5));
    cy = f32(o[1] + f32(f32(e1[1] + e2[1]) * 0.5));
    w = f32(Math.sqrt(e1[0] * e1[0] + e1[1] * e1[1]));
    h = f32(Math.sqrt(e2[0] * e2[0] + e2[1] * e2[1]));
    angle = Math.atan2(e1[1], e1[0]);
  } else if (n === 2) {
    cx = f32((hull[0][0] + hull[1][0]) * 0.5);
    cy = f32((hull[0][1] + hull[1][1]) * 0.5);
    const dx = hull[1][0] - hull[0][0],
      dy = hull[1][1] - hull[0][1];
    w = f32(Math.sqrt(dx * dx + dy * dy));
    h = 0;
    angle = Math.atan2(dy, dx);
  } else if (n === 1) {
    cx = hull[0][0];
    cy = hull[0][1];
  }
  angle = f32((angle * 180) / Math.PI);
  return { cx, cy, w, h, angle, corners: boxPoints(cx, cy, w, h, angle) };
}

/** cv2.boxPoints: the four corners of a RotatedRect. */
export function boxPoints(cx: number, cy: number, w: number, h: number, angleDeg: number): Pt[] {
  const t = (angleDeg * Math.PI) / 180;
  const b = Math.cos(t) * 0.5,
    a = Math.sin(t) * 0.5;
  const p0: Pt = [cx - a * h - b * w, cy + b * h - a * w];
  const p1: Pt = [cx + a * h - b * w, cy - b * h - a * w];
  const p2: Pt = [2 * cx - p0[0], 2 * cy - p0[1]];
  const p3: Pt = [2 * cx - p1[0], 2 * cy - p1[1]];
  return [p0, p1, p2, p3];
}
