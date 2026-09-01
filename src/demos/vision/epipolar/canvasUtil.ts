/**
 * Canvas setup shared by the epipolar sub-panels.
 *
 * Every canvas here shows one course image at a fixed natural resolution
 * (dino0 is 760x570, im0 is 512x288, ...) drawn at a small "display scale"
 * (data.json images[name].scale) so several fit side by side. Rather than a
 * generic wrap-driven resize loop (there is nothing to observe: the intrinsic
 * size is the image's own aspect ratio), the canvas bitmap is sized once from
 * (naturalW*scale*dpr), CSS width is pinned to naturalW*scale px, and CSS
 * height is left "auto" so `.vsEpCanvas { max-width: 100% }` can shrink the
 * whole thing proportionally on narrow screens without any resize-observer
 * churn to debounce (satisfies "skip sub-2px resizes" vacuously — there is no
 * per-frame resize measurement to jitter). The draw transform maps ORIGINAL
 * image-pixel coordinates directly to canvas pixels, so all math (F, corner
 * coords, correspondences) can draw itself with zero extra conversion.
 */

export interface EpiCanvas {
  ctx: CanvasRenderingContext2D;
  dispW: number;
  dispH: number;
}

/** (Re)size + transform a canvas for a naturalW x naturalH image shown at `scale`. */
export function setupImageCanvas(
  canvas: HTMLCanvasElement,
  naturalW: number,
  naturalH: number,
  scale: number
): EpiCanvas {
  const dpr = window.devicePixelRatio || 1;
  const dispW = Math.round(naturalW * scale);
  const dispH = Math.round(naturalH * scale);
  canvas.style.display = "block"; // avoid the inline-canvas baseline gap
  const needW = Math.max(1, Math.round(dispW * dpr));
  const needH = Math.max(1, Math.round(dispH * dpr));
  if (canvas.width !== needW || canvas.height !== needH) {
    canvas.width = needW;
    canvas.height = needH;
  }
  canvas.style.width = `${dispW}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  return { ctx, dispW, dispH };
}

/** CSS-space (clientX, clientY) -> original image-pixel coordinates, DPR/shrink-safe. */
export function toNaturalXY(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  naturalW: number
): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const effScale = rect.width / naturalW || 1;
  return [(clientX - rect.left) / effScale, (clientY - rect.top) / effScale];
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Small magma-ish heat ramp, t in [0,1]. */
export function heatColor(t: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0, [8, 8, 24]],
    [0.35, [92, 24, 120]],
    [0.65, [200, 60, 90]],
    [1, [255, 200, 40]],
  ];
  const c = clamp(t, 0, 1);
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (c <= t1 || i === stops.length - 2) {
      const f = t1 > t0 ? (c - t0) / (t1 - t0) : 0;
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return [255, 255, 255];
}
