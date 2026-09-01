/**
 * Data loading + rendering helpers for the photometric-stereo panel.
 * Kept separate from StereoPanel.tsx so the component stays readable.
 */
import type { Grid, StereoResult } from "@/demos/vision/core/stereo";
import { grid } from "@/demos/vision/core/stereo";

export interface FaceLights {
  lights: number[][];
  width: number;
  height: number;
  note: string;
}

export interface FaceHeightmap {
  scale: number;
  q: number;
  data: number[][];
}

const FACE_BASE = "/demos/vision/face";

/** Load a grayscale PNG into a Grid by drawing it to an offscreen canvas and reading R/255. */
export function loadGrid(src: string): Promise<Grid> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no 2d context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, w, h);
      const data = new Float64Array(w * h);
      for (let p = 0; p < w * h; p++) data[p] = id.data[p * 4] / 255;
      resolve({ data, w, h });
    };
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

export async function loadFaceData(): Promise<{
  images: Grid[];
  lights: FaceLights;
  heightmap: FaceHeightmap;
}> {
  const [lights, heightmap, im1, im2, im3, im4] = await Promise.all([
    fetch(`${FACE_BASE}/lights.json`).then((r) => r.json() as Promise<FaceLights>),
    fetch(`${FACE_BASE}/heightmap.json`).then((r) => r.json() as Promise<FaceHeightmap>),
    loadGrid(`${FACE_BASE}/im1.png`),
    loadGrid(`${FACE_BASE}/im2.png`),
    loadGrid(`${FACE_BASE}/im3.png`),
    loadGrid(`${FACE_BASE}/im4.png`),
  ]);
  return { images: [im1, im2, im3, im4], lights, heightmap };
}

export function faceImgSrc(i: 1 | 2 | 3 | 4): string {
  return `${FACE_BASE}/im${i}.png`;
}

/** DPR-aware canvas fit; skips resizes under 2px. Returns the 2d context sized in CSS px. */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  lastRef: { w: number; h: number } | null,
): { ctx: CanvasRenderingContext2D; w: number; h: number; changed: boolean } | null {
  if (cssW <= 0 || cssH <= 0) return null;
  canvas.style.display = "block";
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(cssW);
  const h = Math.round(cssH);
  const settled = lastRef !== null && Math.abs(w - lastRef.w) < 2 && Math.abs(h - lastRef.h) < 2;
  let changed = false;
  if (!settled) {
    const pxW = Math.floor(w * dpr);
    const pxH = Math.floor(h * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      changed = true;
    }
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h, changed };
}

/** RGB-encode surface normals as (n+1)/2, optionally only up to `rows` (rest left transparent). */
export function normalMapImageData(
  nx: Grid,
  ny: Grid,
  nz: Grid,
  rows?: number,
): ImageData {
  const { w, h } = nx;
  const out = new ImageData(w, h);
  const limit = rows ?? h;
  for (let y = 0; y < h; y++) {
    const draw = y < limit;
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const o = p * 4;
      if (!draw) {
        out.data[o + 3] = 0;
        continue;
      }
      out.data[o] = clamp255(((nx.data[p] + 1) / 2) * 255);
      out.data[o + 1] = clamp255(((ny.data[p] + 1) / 2) * 255);
      out.data[o + 2] = clamp255(((nz.data[p] + 1) / 2) * 255);
      out.data[o + 3] = 255;
    }
  }
  return out;
}

/** Grayscale-encode a [0,1] grid (albedo, or a rendered face), optionally revealed to `rows`. */
export function grayImageData(g: Grid, rows?: number, gain = 1): ImageData {
  const { w, h } = g;
  const out = new ImageData(w, h);
  const limit = rows ?? h;
  for (let y = 0; y < h; y++) {
    const draw = y < limit;
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const o = p * 4;
      if (!draw) {
        out.data[o + 3] = 0;
        continue;
      }
      const v = clamp255(g.data[p] * gain * 255);
      out.data[o] = v;
      out.data[o + 1] = v;
      out.data[o + 2] = v;
      out.data[o + 3] = 255;
    }
  }
  return out;
}

function clamp255(v: number): number {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return v;
}

/** Downsample a gradient grid by stride (nearest-sample) for fast Horn integration. */
export function downsample(g: Grid, stride: number): Grid {
  const w2 = Math.max(1, Math.ceil(g.w / stride));
  const h2 = Math.max(1, Math.ceil(g.h / stride));
  const out = grid(w2, h2);
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      const sx = Math.min(g.w - 1, x * stride);
      const sy = Math.min(g.h - 1, y * stride);
      out.data[y * w2 + x] = g.data[sy * g.w + sx];
    }
  }
  return out;
}

/**
 * Hillshade a height field into a grayscale ImageData: per-pixel normal from central
 * differences, lit by (lx,ly,lz), with a small ambient term so shadows aren't pure black.
 */
export function hillshade(
  height: Float64Array,
  w: number,
  h: number,
  light: [number, number, number],
  exaggeration: number,
): ImageData {
  const out = new ImageData(w, h);
  const [lx, ly, lz] = light;
  for (let y = 0; y < h; y++) {
    const y0 = y > 0 ? y - 1 : y;
    const y1 = y < h - 1 ? y + 1 : y;
    const dy = y1 - y0 || 1;
    for (let x = 0; x < w; x++) {
      const x0 = x > 0 ? x - 1 : x;
      const x1 = x < w - 1 ? x + 1 : x;
      const dx = x1 - x0 || 1;
      const dzdx = ((height[y * w + x1] - height[y * w + x0]) / dx) * exaggeration;
      const dzdy = ((height[y1 * w + x] - height[y0 * w + x]) / dy) * exaggeration;
      let nx = -dzdx,
        ny = -dzdy,
        nz = 1;
      const norm = Math.hypot(nx, ny, nz) || 1;
      nx /= norm;
      ny /= norm;
      nz /= norm;
      const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
      const v = clamp255((0.18 + 0.82 * diffuse) * 255);
      const p = (y * w + x) * 4;
      out.data[p] = v;
      out.data[p + 1] = v;
      out.data[p + 2] = v;
      out.data[p + 3] = 255;
    }
  }
  return out;
}

/** Mean absolute difference between two same-shaped grids. */
export function meanAbsDiff(a: Grid, b: Grid): number {
  let s = 0;
  for (let p = 0; p < a.data.length; p++) s += Math.abs(a.data[p] - b.data[p]);
  return s / a.data.length;
}

/** Draw an ImageData into a canvas 2d context, scaled to fill (w,h) CSS px, no smoothing seams. */
export function blitImageData(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  destW: number,
  destH: number,
): void {
  // putImageData can't scale, so stage on an offscreen canvas at native res then drawImage-scale.
  const off = document.createElement("canvas");
  off.width = img.width;
  off.height = img.height;
  const octx = off.getContext("2d");
  if (!octx) return;
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, destW, destH);
  ctx.drawImage(off, 0, 0, img.width, img.height, 0, 0, destW, destH);
}
