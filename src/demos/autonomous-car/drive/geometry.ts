/**
 * Helpers for the #drive panel: where the lane crop lands on the ground, the |CTE|
 * colour ramp for the trail, and the ground texture bake for the top-down view.
 */
import { CAMERA, type CameraModel } from "../core/camera";
import { cropFor, type CropBox } from "../core/lane";
import type { LaneParams } from "../core/params";
import type { World } from "../core/world";

/** Ground point (car frame: fwd, left in metres) hit by the ray through pixel (u, v); null above the horizon. */
export function pixelToGround(u: number, v: number, cam: CameraModel = CAMERA): [number, number] | null {
  const cp = Math.cos(cam.pitch),
    sp = Math.sin(cam.pitch);
  const cx = (u - cam.W / 2) / cam.f,
    cy = (v - cam.H / 2) / cam.f;
  // same camera → car rotation as camera.ts rays()
  const fw = cp - cy * sp;
  const up = -(cy * cp + sp);
  const lf = -cx;
  if (up >= -1e-4) return null;
  const s = cam.height / -up;
  return [cam.forward + fw * s, lf * s];
}

export interface Footprint {
  crop: CropBox;
  /** crop band corners on the ground, car frame: top-left, top-right, bottom-right, bottom-left (image order) */
  corners: [number, number][];
  /** camera_centerline column through the band (far, near) */
  center: [[number, number], [number, number]];
  near: number;
  far: number;
}

/** The lane node's crop band (rows 240..336, cols 96..544 at 640x480) projected onto the ground. */
export function cropFootprint(lane: LaneParams, cam: CameraModel = CAMERA): Footprint {
  const crop = cropFor(cam.W, cam.H, lane);
  const pts: [number, number][] = [
    [crop.x0, crop.y0],
    [crop.x1, crop.y0],
    [crop.x1, crop.y1],
    [crop.x0, crop.y1],
  ].map(([u, v]) => pixelToGround(u, v, cam) ?? [0, 0]);
  const cu = crop.x0 + Math.trunc((crop.x1 - crop.x0) * lane.camera_centerline);
  const far = pixelToGround(cu, crop.y0, cam) ?? [0, 0];
  const near = pixelToGround(cu, crop.y1, cam) ?? [0, 0];
  return { crop, corners: pts, center: [far, near], near: near[0], far: far[0] };
}

/** |CTE| (m) → trail colour: cyan on the line, orange at 10 cm, red from 20 cm. */
export function cteColor(absCte: number): string {
  const t = Math.min(1, absCte / 0.2);
  const stops: [number, number, number, number][] = [
    [0, 34, 211, 238],
    [0.5, 249, 115, 22],
    [1, 220, 38, 38],
  ];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1],
      b = stops[i];
    if (t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0]);
      return `rgb(${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)},${Math.round(a[3] + (b[3] - a[3]) * k)})`;
    }
  }
  return "rgb(220,38,38)";
}

/** World extent drawn in the top-down view (metres): the lot plus a grass margin. */
export const VIEW = { x0: -1, x1: 45, y0: 1.5, y1: 28.5 };
export const VIEW_ASPECT = (VIEW.x1 - VIEW.x0) / (VIEW.y1 - VIEW.y0);

/** Bake rows [j0, j1) of the ground texture at `res` metres per pixel (north up). */
export function bakeRows(world: World, img: ImageData, res: number, j0: number, j1: number) {
  const px: [number, number, number] = [0, 0, 0];
  const w = img.width;
  const d = img.data;
  for (let j = j0; j < j1; j++) {
    const y = VIEW.y1 - (j + 0.5) * res;
    for (let i = 0; i < w; i++) {
      const x = VIEW.x0 + (i + 0.5) * res;
      world.sample(x, y, res, px);
      const o = (j * w + i) * 4;
      d[o] = px[0];
      d[o + 1] = px[1];
      d[o + 2] = px[2];
      d[o + 3] = 255;
    }
  }
}

/** Offscreen canvas (DOM canvas: works everywhere the page does). */
export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
