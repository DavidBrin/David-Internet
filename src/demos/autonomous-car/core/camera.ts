/**
 * Virtual OAK-D Lite RGB camera: a pinhole looking down the car's nose. The real
 * RoboflowOak frames aren't archived, so the page renders the synthetic lot through
 * this camera and hands the pixels to the ported nodes. The frame is 640 px wide: in the
 * team's photo of the detector window the two red threshold lines (0.15 x W apart) span
 * about twice the box labelled "W:45px". The rest is assumed (disclosed on the page):
 * 640x480, the OAK-D Lite colour camera's 69 deg horizontal FOV, 30 cm above the ground,
 * pitched 18 deg down, 12 cm ahead of the car's reference point. With the team's crop
 * (rows 240-336) the lane node watches the ground 0.5-0.9 m ahead.
 *
 * Per-pixel ground rays are precomputed once, so a frame is a rotate + translate +
 * World.sample per pixel.
 */
import type { Garbage, World } from "./world";

export interface CameraModel {
  W: number;
  H: number;
  f: number;
  height: number;
  pitch: number;
  forward: number;
}

export const CAMERA: CameraModel = { W: 640, H: 480, f: 466, height: 0.3, pitch: (18 * Math.PI) / 180, forward: 0.12 };

export interface Pose {
  x: number;
  y: number;
  th: number;
}

interface RayTable {
  /** ground offsets in the car frame (forward, left) per pixel; NaN above the horizon */
  fwd: Float32Array;
  left: Float32Array;
  /** ground footprint of the pixel (m) */
  foot: Float32Array;
  /** sky gradient 0..1 for pixels above the horizon */
  sky: Float32Array;
}

const tables = new Map<CameraModel, RayTable>();

function rays(cam: CameraModel): RayTable {
  let t = tables.get(cam);
  if (t) return t;
  const { W, H, f, height, pitch, forward } = cam;
  const N = W * H;
  t = { fwd: new Float32Array(N), left: new Float32Array(N), foot: new Float32Array(N), sky: new Float32Array(N) };
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const i = v * W + u;
      const cx = (u + 0.5 - W / 2) / f,
        cy = (v + 0.5 - H / 2) / f;
      // camera (x right, y down, z forward) → car (fwd, left, up)
      const fw = cp - cy * sp;
      const up = -(cy * cp + sp);
      const lf = -cx;
      if (up >= -1e-4) {
        t.fwd[i] = NaN;
        t.left[i] = NaN;
        t.sky[i] = Math.min(1, Math.max(0, up * 3));
        continue;
      }
      const s = height / -up;
      const range = Math.min(60, s * Math.hypot(fw, lf));
      const k = range / (s * Math.hypot(fw, lf));
      t.fwd[i] = forward + fw * s * k;
      t.left[i] = lf * s * k;
      // pixel footprint grows with range and grazing angle
      const len = Math.hypot(fw, lf, up);
      t.foot[i] = (s * len * len) / f / Math.max(0.05, -up);
    }
  }
  tables.set(cam, t);
  return t;
}

/** xorshift for sensor noise; deterministic per frame seed */
function rng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000) / 1000;
  };
}

export interface RenderOptions {
  /** only render rows [y0, y1) (the lane node only reads its crop) */
  rows?: [number, number];
  noise?: number;
  seed?: number;
  exposure?: number;
  drawGarbage?: boolean;
}

/** Render the camera view into an RGBA buffer (length W*H*4). */
export function renderCamera(world: World, pose: Pose, out: Uint8ClampedArray, cam = CAMERA, opts: RenderOptions = {}): void {
  const t = rays(cam);
  const { W, H } = cam;
  const [y0, y1] = opts.rows ?? [0, H];
  const c = Math.cos(pose.th),
    s = Math.sin(pose.th);
  const noise = opts.noise ?? 3;
  const exp = opts.exposure ?? 1;
  const rand = rng(opts.seed ?? 1);
  const px: [number, number, number] = [0, 0, 0];
  for (let v = y0; v < y1; v++) {
    for (let u = 0; u < W; u++) {
      const i = v * W + u;
      const o = i * 4;
      const fw = t.fwd[i];
      let r: number, g: number, b: number;
      if (fw !== fw) {
        // sky over a line of trees/buildings
        const k = t.sky[i];
        if (k < 0.08) {
          r = 88;
          g = 104;
          b = 84;
        } else {
          r = 190 - 60 * k;
          g = 212 - 40 * k;
          b = 236 - 10 * k;
        }
      } else {
        const lf = t.left[i];
        const wx = pose.x + fw * c - lf * s;
        const wy = pose.y + fw * s + lf * c;
        const col = world.sample(wx, wy, t.foot[i], px);
        r = col[0];
        g = col[1];
        b = col[2];
        // distance haze
        const range = Math.hypot(fw, lf);
        if (range > 6) {
          const h = Math.min(0.6, (range - 6) / 40);
          r += (180 - r) * h;
          g += (190 - g) * h;
          b += (200 - b) * h;
        }
      }
      const n = noise ? (rand() - 0.5) * 2 * noise : 0;
      out[o] = r * exp + n;
      out[o + 1] = g * exp + n;
      out[o + 2] = b * exp + n;
      out[o + 3] = 255;
    }
  }
  if (opts.drawGarbage !== false) drawGarbage(world.garbage, pose, out, cam, y0, y1);
}

// ---------------------------------------------------------------- 3D boxes

type V3 = [number, number, number];

/** world point → camera pixel (u, v, depth) or null behind the camera */
export function project(pose: Pose, p: V3, cam = CAMERA): [number, number, number] | null {
  const c = Math.cos(pose.th),
    s = Math.sin(pose.th);
  const dx = p[0] - pose.x,
    dy = p[1] - pose.y;
  const fw = dx * c + dy * s - cam.forward;
  const lf = -dx * s + dy * c;
  const up = p[2] - cam.height;
  const cp = Math.cos(cam.pitch),
    sp = Math.sin(cam.pitch);
  // car → camera: z forward (pitched), y down, x right
  const z = fw * cp - up * sp;
  const y = -(fw * sp + up * cp);
  const x = -lf;
  if (z < 0.03) return null;
  return [cam.W / 2 + (cam.f * x) / z, cam.H / 2 + (cam.f * y) / z, z];
}

function boxCorners(g: Garbage): V3[] {
  const c = Math.cos(g.yaw),
    s = Math.sin(g.yaw);
  const out: V3[] = [];
  for (const z of [0, g.h])
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const lx = (a * g.w) / 2,
        ly = (b * g.d) / 2;
      out.push([g.x + lx * c - ly * s, g.y + lx * s + ly * c, z]);
    }
  return out;
}

const FACES: [number[], number][] = [
  [[4, 5, 6, 7], 1.0], // top
  [[0, 1, 5, 4], 0.78],
  [[1, 2, 6, 5], 0.66],
  [[2, 3, 7, 6], 0.72],
  [[3, 0, 4, 7], 0.6],
];

function fillPoly(out: Uint8ClampedArray, W: number, y0: number, y1: number, pts: [number, number][], col: RGB3) {
  let minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  const ya = Math.max(y0, Math.ceil(minY - 0.5)),
    yb = Math.min(y1 - 1, Math.floor(maxY - 0.5));
  for (let v = ya; v <= yb; v++) {
    const yc = v + 0.5;
    let xl = Infinity,
      xr = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
        const x = a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
        xl = Math.min(xl, x);
        xr = Math.max(xr, x);
      }
    }
    const ua = Math.max(0, Math.ceil(xl - 0.5)),
      ub = Math.min(W - 1, Math.floor(xr - 0.5));
    for (let u = ua; u <= ub; u++) {
      const o = (v * W + u) * 4;
      out[o] = col[0];
      out[o + 1] = col[1];
      out[o + 2] = col[2];
    }
  }
}

type RGB3 = [number, number, number];

function drawGarbage(items: Garbage[], pose: Pose, out: Uint8ClampedArray, cam: CameraModel, y0: number, y1: number) {
  const vis = items
    .map((g) => ({ g, corners: boxCorners(g).map((p) => project(pose, p, cam)) }))
    .filter((e) => e.corners.every((p) => p !== null))
    .sort((a, b) => b.corners[0]![2] - a.corners[0]![2]);
  for (const { g, corners } of vis) {
    const P = corners as [number, number, number][];
    // back-to-front faces by mean depth; top face last
    const faces = FACES.map(([idx, k]) => ({ idx, k, z: idx.reduce((m, i) => m + P[i][2], 0) / 4 })).sort((a, b) => b.z - a.z);
    for (const f of faces) {
      const pts = f.idx.map((i) => [P[i][0], P[i][1]] as [number, number]);
      fillPoly(out, cam.W, y0, y1, pts, [g.color[0] * f.k, g.color[1] * f.k, g.color[2] * f.k]);
    }
  }
}

export interface Box2D {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** distance from the camera (m), for the stand-in confidence */
  range: number;
}

/** Axis-aligned image bbox of each garbage item fully in front of the camera (clipped to the frame). */
export function garbageBoxes(world: World, pose: Pose, cam = CAMERA): Box2D[] {
  const out: Box2D[] = [];
  for (const g of world.garbage) {
    const P = boxCorners(g).map((p) => project(pose, p, cam));
    if (P.some((p) => p === null)) continue;
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const p of P as [number, number, number][]) {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(cam.W, x1);
    y1 = Math.min(cam.H, y1);
    if (x1 - x0 < 4 || y1 - y0 < 4) continue;
    const range = Math.hypot(g.x - pose.x, g.y - pose.y);
    out.push({ id: g.id, label: g.label, x: (x0 + x1) / 2, y: (y0 + y1) / 2, width: x1 - x0, height: y1 - y0, range });
  }
  return out;
}
