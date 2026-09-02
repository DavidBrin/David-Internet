/**
 * Shared math + types for the head-map zone: the /demos/p300/head.json
 * shape, the head-centered -> logical-pixel projection (shared by the SVG
 * electrode layer and the canvas interpolation underlay, both drawn in a
 * fixed 300x300 logical square), the diverging colormap, and a coarse IDW
 * scalp-map interpolation used for the filter-weight view.
 */

export type LobeKey = "F" | "C" | "P" | "O" | "LT" | "RT";
export type SubsetKey = "all" | "cnn2a" | "cnn2b_A" | "cnn2b_B" | LobeKey;

export interface HeadData {
  names: string[];
  pos: Record<string, [number, number]>;
  subsets: {
    cnn2a: number[];
    cnn2b_A: number[];
    cnn2b_B: number[];
    F: number[];
    C: number[];
    P: number[];
    O: number[];
    LT: number[];
    RT: number[];
  };
  filters: number[][];
  filtersNote: string;
  posNote: string;
}

/** Fixed logical coordinate space both the SVG (viewBox) and canvas underlay draw in. */
export const HEAD_LOGICAL = 300;
const HEAD_R = HEAD_LOGICAL / 2 / 1.18; // scalp-circle radius; leaves room for nose tip + ears

export interface HeadTransform {
  cx: number;
  cy: number;
  scale: number;
  r: number;
}

export function headTransform(): HeadTransform {
  const cx = HEAD_LOGICAL / 2;
  const cy = HEAD_LOGICAL / 2;
  return { cx, cy, scale: HEAD_R, r: HEAD_R };
}

/** Project a head-centered (x, y), +y = nose/front, into logical pixels with +y up on screen. */
export function project(t: HeadTransform, x: number, y: number): [number, number] {
  return [t.cx + x * t.scale, t.cy - y * t.scale];
}

const COLOR_NEG: [number, number, number] = [37, 99, 235]; // blue, weight -1
const COLOR_MID: [number, number, number] = [255, 255, 255]; // white, weight 0
const COLOR_POS: [number, number, number] = [168, 85, 247]; // accent purple, weight +1

function lerp3(a: readonly [number, number, number], b: readonly [number, number, number], k: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** Diverging blue-white-purple colormap for weights in roughly [-1, 1]. */
export function divergingRgb(v: number): [number, number, number] {
  const t = Math.max(-1, Math.min(1, v));
  const [r, g, b] = t < 0 ? lerp3(COLOR_NEG, COLOR_MID, t + 1) : lerp3(COLOR_MID, COLOR_POS, t);
  return [Math.round(r), Math.round(g), Math.round(b)];
}

export function divergingCss(v: number): string {
  const [r, g, b] = divergingRgb(v);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Build a coarse inverse-distance-weighted scalp-map image (gridSize x
 * gridSize, RGBA) for one filter's 64 weights, cut off outside the scalp
 * circle. Meant to be drawn small and then scaled up with image smoothing
 * for a soft, interpolated look rather than computed at full resolution.
 */
export function buildFilterGrid(
  positions: readonly [number, number][],
  weights: readonly number[],
  gridSize: number,
): ImageData {
  const img = new ImageData(gridSize, gridSize);
  const half = 1.16; // logical head-units spanned by the grid, matches HEAD_R fit
  const cutoff = 1.05;
  for (let gy = 0; gy < gridSize; gy++) {
    const ly = half - (gy / (gridSize - 1)) * 2 * half;
    for (let gx = 0; gx < gridSize; gx++) {
      const lx = -half + (gx / (gridSize - 1)) * 2 * half;
      const idx = (gy * gridSize + gx) * 4;
      if (lx * lx + ly * ly > cutoff * cutoff) {
        img.data[idx + 3] = 0;
        continue;
      }
      let num = 0;
      let den = 0;
      for (let i = 0; i < positions.length; i++) {
        const dx = lx - positions[i][0];
        const dy = ly - positions[i][1];
        const w = 1 / (dx * dx + dy * dy + 0.012);
        num += w * weights[i];
        den += w;
      }
      const val = den > 0 ? num / den : 0;
      const [r, g, b] = divergingRgb(val);
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 235;
    }
  }
  return img;
}
