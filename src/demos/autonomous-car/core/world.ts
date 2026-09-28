/**
 * The synthetic test lot the demo drives on, modelled on the team's footage: grey
 * asphalt, a dashed yellow tape centre line (2-inch tape, ~30 cm dashes), white
 * parking lines, a grass infield and verge, soft tree shade, and a few pieces of
 * "garbage" for the detector stand-in.
 *
 * The course is a stadium loop (20 m straights, 8 m radius ends, ~90 m a lap): the
 * team's steering gain (Kp 0.2) is sized for a parking-lot course, and anything much
 * tighter than ~6 m radius pushes the tape out of the lane crop.
 *
 * Units are metres; x east, y north; the car drives counter-clockwise. Colors are RGB.
 * Everything is deterministic (seeded) so fixture frames reproduce exactly.
 *
 * Rendering speed: the ground albedo (everything but the tape and shade) is baked once
 * into a 4 cm texture with two coarser mip levels (shared by every World with the same
 * seed); the tape is drawn analytically from a segment grid so its edges stay crisp.
 */

export type RGB = [number, number, number];

export interface Garbage {
  id: string;
  x: number;
  y: number;
  /** footprint (m) and height (m) */
  w: number;
  d: number;
  h: number;
  yaw: number;
  color: RGB;
  label: string;
}

export interface Shade {
  x: number;
  y: number;
  r: number;
  /** multiplier at the centre (1 = no shade) */
  k: number;
}

export interface WorldOptions {
  /** 0 = no shade, 1 = the default light canopy shade, ~2.5 = deep shade */
  shadeScale?: number;
  garbage?: Garbage[];
  seed?: number;
}

export const LOT = { x0: 1, y0: 3.2, x1: 43, y1: 26.5 };
export const TAPE = { width: 0.048, dash: 0.3, gap: 0.35 };
export const STADIUM = { x0: 12, x1: 32, cy: 14, r: 8 };

export const WHITE_LINES: [number, number, number, number][] = [
  // parking stall lines along the south edge (x0, y0, x1, y1), 10 cm paint
  ...[8, 11, 14, 17, 20, 23, 26, 29, 32, 35].map((x) => [x, 3.4, x, 4.6] as [number, number, number, number]),
  [6, 24.8, 38, 24.8],
  [41.6, 8, 41.6, 20],
];

const WHITE_W = 0.1;

// ---------------------------------------------------------------- helpers

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed),
    b = hash2(ix + 1, iy, seed),
    c = hash2(ix, iy + 1, seed),
    d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Stadium centre line, counter-clockwise from the middle of the south straight. */
function stadium(step: number): [number, number][] {
  const { x0, x1, cy, r } = STADIUM;
  const straight = x1 - x0;
  const arcLen = Math.PI * r;
  const L = 2 * straight + 2 * arcLen;
  const pts: [number, number][] = [];
  const n = Math.round(L / step);
  for (let i = 0; i < n; i++) {
    let s = (i * L) / n + straight / 2; // start mid south straight
    s %= L;
    if (s < straight) pts.push([x0 + s, cy - r]);
    else if (s < straight + arcLen) {
      const a = -Math.PI / 2 + (s - straight) / r;
      pts.push([x1 + r * Math.cos(a), cy + r * Math.sin(a)]);
    } else if (s < 2 * straight + arcLen) pts.push([x1 - (s - straight - arcLen), cy + r]);
    else {
      const a = Math.PI / 2 + (s - 2 * straight - arcLen) / r;
      pts.push([x0 + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

function segDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const ex = x1 - x0,
    ey = y1 - y0;
  let t = ((px - x0) * ex + (py - y0) * ey) / (ex * ex + ey * ey);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x0 + t * ex - px, y0 + t * ey - py);
}

/** Albedo (no tape, no shade) of the lot at a point: asphalt, paint, grass. */
function albedoAt(x: number, y: number, seed: number): RGB {
  const inLot = x > LOT.x0 && x < LOT.x1 && y > LOT.y0 && y < LOT.y1;
  const infield = segDist(x, y, STADIUM.x0, STADIUM.cy, STADIUM.x1, STADIUM.cy) < STADIUM.r - 3.2;
  if (!inLot || infield) {
    const n1 = valueNoise(x * 1.3, y * 1.3, seed + 11);
    const n2 = valueNoise(x * 5, y * 5, seed + 12);
    const sun = n1 * 0.7 + n2 * 0.3; // sunlit tufts drift toward yellow-green
    return [70 + 95 * sun, 100 + 95 * sun, 38 + 22 * sun];
  }
  const n1 = valueNoise(x * 0.8, y * 0.8, seed + 1);
  const n2 = valueNoise(x * 5, y * 5, seed + 2);
  const base = 112 + 22 * n1 + 14 * (n2 - 0.5);
  for (const [x0, y0, x1, y1] of WHITE_LINES) {
    if (segDist(x, y, x0, y0, x1, y1) < WHITE_W / 2) {
      const worn = 0.85 + 0.15 * valueNoise(x * 6, y * 6, seed + 5);
      return [226 * worn, 228 * worn, 222 * worn];
    }
  }
  return [base, base - 2, base - 6];
}

interface Mip {
  res: number;
  w: number;
  h: number;
  data: Uint8Array;
}

/** Baked albedo mips over the lot + margin, keyed by seed. */
const BAKES = new Map<number, Mip[]>();
const BAKE_X0 = -2,
  BAKE_Y0 = 0,
  BAKE_W = 48,
  BAKE_H = 30;

function bake(seed: number): Mip[] {
  const cached = BAKES.get(seed);
  if (cached) return cached;
  const res = 0.04;
  const w = Math.round(BAKE_W / res),
    h = Math.round(BAKE_H / res);
  const data = new Uint8Array(w * h * 3);
  for (let j = 0; j < h; j++) {
    const y = BAKE_Y0 + (j + 0.5) * res;
    for (let i = 0; i < w; i++) {
      const c = albedoAt(BAKE_X0 + (i + 0.5) * res, y, seed);
      const o = (j * w + i) * 3;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
    }
  }
  const mips: Mip[] = [{ res, w, h, data }];
  for (let l = 1; l < 3; l++) {
    const src = mips[l - 1];
    const f = 4;
    const nw = Math.floor(src.w / f),
      nh = Math.floor(src.h / f);
    const nd = new Uint8Array(nw * nh * 3);
    for (let j = 0; j < nh; j++)
      for (let i = 0; i < nw; i++)
        for (let c = 0; c < 3; c++) {
          let s = 0;
          for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += src.data[((j * f + dy) * src.w + i * f + dx) * 3 + c];
          nd[(j * nw + i) * 3 + c] = s / (f * f);
        }
    mips.push({ res: src.res * f, w: nw, h: nh, data: nd });
  }
  BAKES.set(seed, mips);
  return mips;
}

/** Uniform grid of centre-line segment indices for nearest-segment queries. */
class SegGrid {
  readonly cells: Int32Array[];
  readonly nx: number;
  readonly ny: number;
  constructor(
    pts: [number, number][],
    readonly cell: number,
    band: number,
  ) {
    this.nx = Math.ceil(BAKE_W / cell);
    this.ny = Math.ceil(BAKE_H / cell);
    const lists: number[][] = Array.from({ length: this.nx * this.ny }, () => []);
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i],
        b = pts[(i + 1) % n];
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - band - BAKE_X0) / cell));
      const i1 = Math.min(this.nx - 1, Math.floor((Math.max(a[0], b[0]) + band - BAKE_X0) / cell));
      const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - band - BAKE_Y0) / cell));
      const j1 = Math.min(this.ny - 1, Math.floor((Math.max(a[1], b[1]) + band - BAKE_Y0) / cell));
      for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) lists[j * this.nx + k].push(i);
    }
    this.cells = lists.map((l) => Int32Array.from(l));
  }
  at(x: number, y: number): Int32Array | null {
    const i = Math.floor((x - BAKE_X0) / this.cell),
      j = Math.floor((y - BAKE_Y0) / this.cell);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return null;
    const c = this.cells[j * this.nx + i];
    return c.length ? c : null;
  }
}

// ---------------------------------------------------------------- world

export class World {
  /** centre line at ~1 cm spacing */
  readonly center: [number, number][];
  /** cumulative arc length at each centre-line vertex */
  readonly arc: Float64Array;
  readonly length: number;
  readonly shades: Shade[];
  garbage: Garbage[];
  readonly seed: number;
  private readonly mips: Mip[];
  /** 5 cm segments for distance queries */
  private readonly segs: [number, number][];
  private readonly segArc: Float64Array;
  private readonly tapeGrid: SegGrid;
  private readonly trackGrid: SegGrid;
  // 5 cm shade map over the bake area
  private readonly shadeRes = 0.05;
  private readonly sw: number;
  private readonly sh: number;
  private readonly shade: Float32Array;

  constructor(opts: WorldOptions = {}) {
    this.seed = opts.seed ?? 148;
    this.garbage = opts.garbage ?? [];
    this.mips = bake(this.seed);

    this.center = stadium(0.01);
    const arc = new Float64Array(this.center.length + 1);
    for (let i = 1; i <= this.center.length; i++) {
      const a = this.center[i - 1],
        b = this.center[i % this.center.length];
      arc[i] = arc[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    this.arc = arc;
    this.length = arc[this.center.length];

    this.segs = this.center.filter((_, i) => i % 5 === 0);
    this.segArc = new Float64Array(this.segs.length + 1);
    for (let i = 0; i <= this.segs.length; i++) this.segArc[i] = arc[Math.min(i * 5, this.center.length)];
    this.tapeGrid = new SegGrid(this.segs, 0.25, 0.08);
    this.trackGrid = new SegGrid(this.segs, 1, 1.6);

    const k = opts.shadeScale ?? 1;
    this.shades = [
      { x: 21.5, y: 5.4, r: 2.4, k: Math.max(0.2, 1 - 0.26 * k) },
      { x: 38.6, y: 19.5, r: 2.2, k: Math.max(0.2, 1 - 0.24 * k) },
      { x: 5.2, y: 17.5, r: 2.3, k: Math.max(0.2, 1 - 0.28 * k) },
    ];
    this.sw = Math.round(BAKE_W / this.shadeRes) + 1;
    this.sh = Math.round(BAKE_H / this.shadeRes) + 1;
    this.shade = new Float32Array(this.sw * this.sh).fill(1);
    for (const s of this.shades) {
      const i0 = Math.max(0, Math.floor((s.x - s.r - BAKE_X0) / this.shadeRes)),
        i1 = Math.min(this.sw - 1, Math.ceil((s.x + s.r - BAKE_X0) / this.shadeRes));
      const j0 = Math.max(0, Math.floor((s.y - s.r - BAKE_Y0) / this.shadeRes)),
        j1 = Math.min(this.sh - 1, Math.ceil((s.y + s.r - BAKE_Y0) / this.shadeRes));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const x = BAKE_X0 + i * this.shadeRes,
            y = BAKE_Y0 + j * this.shadeRes;
          const r = Math.hypot(x - s.x, y - s.y) / s.r;
          if (r >= 1) continue;
          // soft-edged canopy with some dappling
          const edge = r < 0.7 ? 1 : 1 - (r - 0.7) / 0.3;
          const dapple = 0.85 + 0.3 * valueNoise(x * 3.1, y * 3.1, this.seed + 7);
          this.shade[j * this.sw + i] *= 1 - (1 - s.k) * Math.min(1, edge * dapple);
        }
    }
  }

  /** Point + heading on the centre line at arc length s (wraps). */
  pointAt(s: number): { x: number; y: number; th: number } {
    const L = this.length;
    s = ((s % L) + L) % L;
    let lo = 0,
      hi = this.center.length;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.arc[mid] <= s) lo = mid;
      else hi = mid;
    }
    const a = this.center[lo],
      b = this.center[(lo + 1) % this.center.length];
    const seg = this.arc[lo + 1] - this.arc[lo] || 1e-9;
    const t = (s - this.arc[lo]) / seg;
    return { x: a[0] + t * (b[0] - a[0]), y: a[1] + t * (b[1] - a[1]), th: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }

  private nearest(grid: SegGrid, x: number, y: number, maxD: number): { d: number; s: number; sign: number } | null {
    const cell = grid.at(x, y);
    if (!cell) return null;
    let best = maxD,
      bs = 0,
      sign = 1;
    const n = this.segs.length;
    for (let k = 0; k < cell.length; k++) {
      const i = cell[k];
      const a = this.segs[i],
        b = this.segs[(i + 1) % n];
      const ex = b[0] - a[0],
        ey = b[1] - a[1];
      const L2 = ex * ex + ey * ey;
      let t = ((x - a[0]) * ex + (y - a[1]) * ey) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = a[0] + t * ex - x,
        dy = a[1] + t * ey - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < best) {
        best = d;
        bs = this.segArc[i] + t * (this.segArc[i + 1] - this.segArc[i]);
        sign = ex * (y - a[1]) - ey * (x - a[0]) >= 0 ? 1 : -1;
      }
    }
    return best < maxD ? { d: best, s: bs, sign } : null;
  }

  /** Signed distance to the centre line (+ = left of travel) and arc length, or null > 1.5 m away. */
  track(x: number, y: number): { d: number; s: number } | null {
    const r = this.nearest(this.trackGrid, x, y, 1.5);
    return r ? { d: r.d * r.sign, s: r.s } : null;
  }

  isDash(s: number): boolean {
    const p = TAPE.dash + TAPE.gap;
    const m = ((s % p) + p) % p;
    return m < TAPE.dash;
  }

  shadeAt(x: number, y: number): number {
    const i = Math.round((x - BAKE_X0) / this.shadeRes),
      j = Math.round((y - BAKE_Y0) / this.shadeRes);
    if (i < 0 || j < 0 || i >= this.sw || j >= this.sh) return 1;
    return this.shade[j * this.sw + i];
  }

  /**
   * Ground color (RGB 0-255, unclamped floats) at world point (x, y), written into `out`.
   * `footprint` is the pixel's ground size in metres (picks the mip level and fades
   * the fine grain and the tape's edge).
   */
  sample(x: number, y: number, footprint: number, out: RGB): RGB {
    let r: number, g: number, b: number;
    const lvl = footprint < 0.06 ? 0 : footprint < 0.24 ? 1 : 2;
    const m = this.mips[lvl];
    const fx = (x - BAKE_X0) / m.res - 0.5,
      fy = (y - BAKE_Y0) / m.res - 0.5;
    const ix = Math.floor(fx),
      iy = Math.floor(fy);
    if (ix < 0 || iy < 0 || ix >= m.w - 1 || iy >= m.h - 1) {
      // open field beyond the baked area
      const n = hash2(Math.floor(x * 0.5), Math.floor(y * 0.5), this.seed + 21);
      r = 92 + 30 * n;
      g = 122 + 30 * n;
      b = 46 + 8 * n;
    } else {
      const tx = fx - ix,
        ty = fy - iy;
      const d = m.data,
        o00 = (iy * m.w + ix) * 3,
        o10 = o00 + 3,
        o01 = o00 + m.w * 3,
        o11 = o01 + 3;
      const w00 = (1 - tx) * (1 - ty),
        w10 = tx * (1 - ty),
        w01 = (1 - tx) * ty,
        w11 = tx * ty;
      r = d[o00] * w00 + d[o10] * w10 + d[o01] * w01 + d[o11] * w11;
      g = d[o00 + 1] * w00 + d[o10 + 1] * w10 + d[o01 + 1] * w01 + d[o11 + 1] * w11;
      b = d[o00 + 2] * w00 + d[o10 + 2] * w10 + d[o01 + 2] * w01 + d[o11 + 2] * w11;
      if (footprint < 0.02) {
        // asphalt grain finer than the bake
        const g1 = hash2(Math.floor(x * 160), Math.floor(y * 160), this.seed + 3) - 0.5;
        const g2 = valueNoise(x * 40, y * 40, this.seed + 9) - 0.5;
        const grain = g1 * 14 + g2 * 12;
        r += grain;
        g += grain;
        b += grain;
      }
      // tape, anti-aliased by the pixel footprint
      const t = this.nearest(this.tapeGrid, x, y, TAPE.width / 2 + Math.max(footprint, 0.002));
      if (t && this.isDash(t.s)) {
        const a = Math.max(0, Math.min(1, (TAPE.width / 2 - t.d) / Math.max(footprint, 1e-3) + 0.5));
        if (a > 0) {
          const wear = 0.93 + 0.07 * hash2(Math.floor(x * 40), Math.floor(y * 40), this.seed + 4);
          r += (238 * wear - r) * a;
          g += (196 * wear - g) * a;
          b += (42 * wear - b) * a;
        }
      }
    }
    const k = this.shadeAt(x, y);
    // shade is bluish skylight
    out[0] = r * k;
    out[1] = g * k;
    out[2] = b * (k + (1 - k) * 0.25);
    return out;
  }

  static defaultGarbage(): Garbage[] {
    return [
      { id: "box", x: 27.0, y: 6.1, w: 0.26, d: 0.2, h: 0.14, yaw: 0.25, color: [176, 128, 84], label: "cardboard box" },
      { id: "bag", x: 20.0, y: 21.9, w: 0.28, d: 0.2, h: 0.12, yaw: 0.8, color: [232, 232, 226], label: "paper bag" },
      { id: "bottle", x: 4.1, y: 14.3, w: 0.26, d: 0.08, h: 0.08, yaw: 1.4, color: [40, 150, 90], label: "plastic bottle" },
    ];
  }
}
