/**
 * Canvas helpers for the #vision panel: Mat → ImageData, the lane node's cv2 debug
 * overlay redrawn from locateCentroid's result, camera_driver2's detection box, and the
 * Python-style number formatting used in the log line.
 */
import type { Mat } from "../core/cv";
import type { LaneResult } from "../core/lane";
import type { Prediction } from "../core/detect";

/** OpenCV's BGR (0,255,0) / (0,0,255) / (255,0,0), as the node draws them. */
export const CV_GREEN = "rgb(0,255,0)";
export const CV_RED = "rgb(255,0,0)";
export const CV_BLUE = "rgb(0,0,255)";

/** Write a Mat into an offscreen canvas at 1:1 (BGR shown as RGB, gray as gray). */
export function matToCanvas(m: Mat, canvas: HTMLCanvasElement): void {
  if (canvas.width !== m.w) canvas.width = m.w;
  if (canvas.height !== m.h) canvas.height = m.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(m.w, m.h);
  const d = img.data;
  const s = m.data;
  const n = m.w * m.h;
  if (m.c === 3) {
    for (let i = 0; i < n; i++) {
      d[i * 4] = s[i * 3 + 2];
      d[i * 4 + 1] = s[i * 3 + 1];
      d[i * 4 + 2] = s[i * 3];
      d[i * 4 + 3] = 255;
    }
  } else {
    for (let i = 0; i < n; i++) {
      const v = s[i];
      d[i * 4] = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** count of non-zero pixels in a 1-channel Mat */
export function countOn(m: Mat): number {
  let n = 0;
  const d = m.data;
  for (let i = 0; i < d.length; i++) if (d[i]) n++;
  return n;
}

/**
 * The lane node's debug drawing on `img` (the crop), in crop pixel coordinates.
 * `k` is display pixels per image pixel so line widths match the 640-px original.
 * Rejected contours (not drawn by the node) are added dim and dashed with their width.
 */
export function drawLaneOverlay(ctx: CanvasRenderingContext2D, r: LaneResult, k: number, opts: { rejectLabels?: boolean; widthMin: number; widthMax: number }): void {
  const H = r.height;
  ctx.beginPath();
  ctx.rect(0, 0, r.width * k, H * k);
  ctx.save();
  ctx.clip();
  const passed = r.contours.some((c) => c.cx !== undefined);
  ctx.lineJoin = "miter";

  // rejected contours: dashed, dim red, with their minAreaRect width
  for (const c of r.contours) {
    if (c.pass) continue;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,90,90,0.85)";
    poly(ctx, c.rect.corners, k);
    ctx.stroke();
    ctx.setLineDash([]);
    if (opts.rejectLabels) {
      const w = c.rect.w;
      const why = w <= opts.widthMin ? `w ${fmtW(w)} ≤ ${opts.widthMin}` : `w ${fmtW(w)} ≥ ${opts.widthMax}`;
      const xs = c.rect.corners.map((p) => p[0]);
      const ys = c.rect.corners.map((p) => p[1]);
      const x = Math.max(0, Math.min(...xs)) * k;
      const y = Math.min(...ys) * k;
      label(ctx, why, x, y, "rgba(120,20,20,0.85)", "#ffd4d4");
    }
  }

  // centre + threshold lines are drawn inside the loop, i.e. only once a contour passed
  const lineX = (x: number) => Math.trunc(x) * k;
  const drawGuides = () => {
    ctx.strokeStyle = CV_GREEN;
    ctx.lineWidth = 4 * k;
    vline(ctx, lineX(r.centerX), H * k);
    ctx.strokeStyle = CV_RED;
    ctx.lineWidth = 2 * k;
    vline(ctx, lineX(r.threshX[0]), H * k);
    vline(ctx, lineX(r.threshX[1]), H * k);
  };
  if (!passed) {
    // not drawn by the node when nothing passes: shown faint so the band stays readable
    ctx.globalAlpha = 0.28;
    ctx.setLineDash([5, 4]);
    drawGuides();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  for (const c of r.contours) {
    if (!c.pass) continue;
    // box = np.int0(cv2.boxPoints(rect)); drawContours(..., (0,255,0), 3)
    ctx.strokeStyle = CV_GREEN;
    ctx.lineWidth = 3 * k;
    poly(
      ctx,
      c.rect.corners.map((p) => [Math.trunc(p[0]), Math.trunc(p[1])] as [number, number]),
      k,
    );
    ctx.stroke();
    // m00 == 0 raises ZeroDivisionError after the box is drawn: no dot, no guides
    if (c.cx === undefined || c.cy === undefined) continue;
    dot(ctx, c.cx * k, c.cy * k, 7 * k, CV_GREEN);
    drawGuides();
  }

  const d = r.decision;
  if (d.kind === "straight" || d.kind === "curve") {
    // circle (255,0,0) BGR = blue, then the red error line
    dot(ctx, d.target[0] * k, d.target[1] * k, 7 * k, CV_BLUE);
    ctx.strokeStyle = CV_RED;
    ctx.lineWidth = 4 * k;
    hline(ctx, lineX(r.centerX), d.target[0] * k, d.target[1] * k);
  } else if (d.kind === "single") {
    // single line: error line first, then a (0,0,255) BGR = red dot
    ctx.strokeStyle = CV_RED;
    ctx.lineWidth = 4 * k;
    hline(ctx, lineX(r.centerX), d.target[0] * k, d.target[1] * k);
    dot(ctx, d.target[0] * k, d.target[1] * k, 7 * k, CV_RED);
  }
  ctx.restore();
}

/**
 * camera_driver2.draw_detection: 2-px green box, filled green label strip, black
 * FONT_HERSHEY_SIMPLEX 0.5 text "garbage 0.87 W:112px"; plus the tracked target dot and
 * the red error line from the detector's own centre line (x = int(640 * 0.5)).
 */
export function drawDetections(ctx: CanvasRenderingContext2D, preds: Prediction[], k: number, targetIndex: number, imageWidth: number): void {
  ctx.save();
  for (const p of preds) {
    const x1 = Math.trunc(p.x - Math.floor(p.width / 2));
    const y1 = Math.trunc(p.y - Math.floor(p.height / 2));
    const x2 = Math.trunc(p.x + Math.floor(p.width / 2));
    const y2 = Math.trunc(p.y + Math.floor(p.height / 2));
    ctx.strokeStyle = CV_GREEN;
    ctx.lineWidth = 2 * k;
    ctx.strokeRect(x1 * k, y1 * k, (x2 - x1) * k, (y2 - y1) * k);
    const text = `garbage ${p.confidence.toFixed(2)} W:${p.width.toFixed(0)}px`;
    const fs = Math.max(9, 13 * k);
    ctx.font = `700 ${fs}px ui-sans-serif, system-ui, sans-serif`;
    const tw = ctx.measureText(text).width;
    const th = 12 * k; // getTextSize(..., 0.5, 2)[1] is ~12 px
    const top = y1 * k - th - 10 * k;
    ctx.fillStyle = CV_GREEN;
    ctx.fillRect(x1 * k, top, tw + 2, y1 * k - top);
    ctx.fillStyle = "#000";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, x1 * k + 1, y1 * k - 5 * k);
  }
  const t = preds[targetIndex];
  if (t) {
    const cam = Math.trunc(imageWidth * 0.5);
    ctx.strokeStyle = CV_RED;
    ctx.lineWidth = 4 * k;
    hline(ctx, cam * k, Math.trunc(t.x) * k, Math.trunc(t.y) * k);
    dot(ctx, Math.trunc(t.x) * k, Math.trunc(t.y) * k, 10 * k, CV_BLUE);
  }
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], k: number) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0] * k, p[1] * k) : ctx.moveTo(p[0] * k, p[1] * k)));
  ctx.closePath();
}

function vline(ctx: CanvasRenderingContext2D, x: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();
}

function hline(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1.5, r), 0, Math.PI * 2);
  ctx.fill();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg: string) {
  ctx.font = "600 10.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const w = ctx.measureText(text).width + 6;
  const top = Math.max(0, y - 15);
  ctx.fillStyle = bg;
  ctx.fillRect(x, top, w, 14);
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 3, top + 7.5);
}

export function fmtW(w: number): string {
  return Number.isInteger(w) ? String(w) : w.toFixed(1);
}

/** Python repr() of a float (JS and Python both print the shortest round-trip digits). */
export function pyFloat(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  if (Number.isInteger(x) && Math.abs(x) < 1e16) return x.toFixed(1);
  const s = String(x);
  // Python pads the exponent to two digits: 1e-5 → 1e-05
  return s.replace(/e([+-])(\d)$/, "e$10$2");
}

/** The node's get_logger().info(...) line for this frame. */
export function logLine(r: LaneResult): string {
  const d = r.decision;
  if (d.kind === "none") return "Nothing detected";
  // phi is left over from the last contour the for-loop visited (passed or not)
  const last = r.contours[r.contours.length - 1];
  const phi = last ? pyFloat(last.rect.angle) : "?";
  // a replaced curve error is the Python int 1
  const err =
    d.kind === "curve" && d.error === 1 && !d.rawErrors.includes(1) ? "1" : pyFloat(d.error);
  const head = d.kind === "straight" ? "Straight curve" : d.kind === "curve" ? "Curvy road" : "Only detected one line";
  return `${head}: [tracking error: ${err}], [tracking angle: ${phi}]`;
}
