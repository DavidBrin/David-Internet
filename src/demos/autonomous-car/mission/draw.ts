/**
 * Canvas drawing for the #mission panel: the top-down local view that follows the car,
 * and the camera inset annotated exactly the way camera_driver2.py annotates the frame
 * it shows with cv2.imshow("Frame").
 */
import { CAMERA, renderCamera, type CameraModel, type Pose } from "../core/camera";
import type { DetectorOutput } from "../core/detect";
import { DETECT_PARAMS } from "../core/params";
import { TAPE, WHITE_LINES, type World } from "../core/world";
import type { MissionRun } from "./run";

// ------------------------------------------------------------------ top-down scene

export interface SceneCam {
  cx: number;
  cy: number;
}

/** Dash segments of the whole tape loop in world coordinates (computed once per World). */
const DASHES = new WeakMap<World, [number, number, number, number][]>();
function dashes(world: World) {
  let d = DASHES.get(world);
  if (d) return d;
  d = [];
  const period = TAPE.dash + TAPE.gap;
  for (let s = 0; s < world.length; s += period) {
    const a = world.pointAt(s + 0.002);
    const b = world.pointAt(s + TAPE.dash - 0.002);
    d.push([a.x, a.y, b.x, b.y]);
  }
  DASHES.set(world, d);
  return d;
}

let speckle: HTMLCanvasElement | null = null;
/** 1 m x 1 m tile of asphalt grain (128 px), anchored to world coordinates. */
function speckleTile(): HTMLCanvasElement {
  if (speckle) return speckle;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#4a4d52";
  g.fillRect(0, 0, 128, 128);
  let s = 1234567;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
  for (let i = 0; i < 1400; i++) {
    const v = 60 + Math.floor(rnd() * 70);
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.35 + rnd() * 0.4})`;
    const r = rnd() < 0.85 ? 1 : 2;
    g.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), r, r);
  }
  speckle = c;
  return c;
}

/** Metres shown across the canvas: 7 m on a wide panel, down to 4.5 m on a phone. */
export function sceneSpan(w: number) {
  return Math.max(4.5, Math.min(7, w / 140));
}

export function followCam(cam: SceneCam, pose: Pose, k: number) {
  const tx = pose.x + 1.2 * Math.cos(pose.th);
  const ty = Math.max(5.2, Math.min(7.2, pose.y));
  cam.cx += (tx - cam.cx) * k;
  cam.cy += (ty - cam.cy) * k;
}

export function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, run: MissionRun | null, cam: SceneCam) {
  const k = w / sceneSpan(w);
  const X = (x: number) => (x - cam.cx) * k + w / 2;
  const Y = (y: number) => h / 2 - (y - cam.cy) * k;

  // asphalt
  ctx.fillStyle = "#44474c";
  ctx.fillRect(0, 0, w, h);
  const pat = ctx.createPattern(speckleTile(), "repeat");
  if (pat) {
    pat.setTransform(new DOMMatrix().translate(X(0), Y(0)).scale(k / 128));
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
  }
  if (!run) return;
  const world = run.sim.world;

  // tree shade
  for (const s of world.shades) {
    const g = ctx.createRadialGradient(X(s.x), Y(s.y), 0, X(s.x), Y(s.y), s.r * k);
    g.addColorStop(0, `rgba(10,14,20,${(1 - s.k) * 0.9})`);
    g.addColorStop(0.7, `rgba(10,14,20,${(1 - s.k) * 0.7})`);
    g.addColorStop(1, "rgba(10,14,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(X(s.x), Y(s.y), s.r * k, 0, Math.PI * 2);
    ctx.fill();
  }

  // white stall paint
  ctx.strokeStyle = "rgba(232,232,226,0.85)";
  ctx.lineWidth = Math.max(1.5, 0.1 * k);
  ctx.lineCap = "butt";
  ctx.beginPath();
  for (const [x0, y0, x1, y1] of WHITE_LINES) {
    ctx.moveTo(X(x0), Y(y0));
    ctx.lineTo(X(x1), Y(y1));
  }
  ctx.stroke();

  // dashed yellow tape
  const minX = cam.cx - w / k / 2 - 1,
    maxX = cam.cx + w / k / 2 + 1,
    minY = cam.cy - h / k / 2 - 1,
    maxY = cam.cy + h / k / 2 + 1;
  ctx.strokeStyle = "#f0c232";
  ctx.lineWidth = Math.max(2, TAPE.width * k);
  ctx.beginPath();
  for (const [x0, y0, x1, y1] of dashes(world)) {
    if (Math.max(x0, x1) < minX || Math.min(x0, x1) > maxX || Math.max(y0, y1) < minY || Math.min(y0, y1) > maxY) continue;
    ctx.moveTo(X(x0), Y(y0));
    ctx.lineTo(X(x1), Y(y1));
  }
  ctx.stroke();

  // trail
  const tr = run.trail;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  for (let i = 1; i < tr.length; i++) {
    const a = tr[i - 1],
      b = tr[i];
    ctx.strokeStyle = b.avoid ? "rgba(96,165,250,0.95)" : "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.moveTo(X(a.x), Y(a.y));
    ctx.lineTo(X(b.x), Y(b.y));
    ctx.stroke();
  }

  // the maneuver as the step list describes it
  if (run.plan) drawPlan(ctx, run, X, Y, k);

  // garbage: live items and the outlines of collected ones
  const live = new Set(world.garbage.map((g) => g.id));
  const placed: [number, number, number][] = [];
  ctx.font = "600 11px ui-monospace, Menlo, Consolas, monospace";
  for (const g of run.items) {
    const on = live.has(g.id);
    ctx.save();
    ctx.translate(X(g.x), Y(g.y));
    ctx.rotate(-g.yaw);
    if (on) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect((-g.w / 2) * k + 2, (-g.d / 2) * k + 3, g.w * k, g.d * k);
      ctx.fillStyle = `rgb(${g.color[0]},${g.color[1]},${g.color[2]})`;
      ctx.fillRect((-g.w / 2) * k, (-g.d / 2) * k, g.w * k, g.d * k);
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect((-g.w / 2) * k, (-g.d / 2) * k, g.w * k, g.d * k);
    } else {
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "rgba(240,194,50,0.7)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect((-g.w / 2) * k, (-g.d / 2) * k, g.w * k, g.d * k);
      ctx.setLineDash([]);
    }
    ctx.restore();
    if (on) {
      // items outside the view keep a clamped label that points the way
      const cw = ctx.canvas.clientWidth || ctx.canvas.width;
      const gx = X(g.x);
      const text = gx > cw ? `${g.label} →` : gx < 0 ? `← ${g.label}` : g.label;
      chip(ctx, text, gx, Y(g.y) - Math.max(g.w, g.d) * k * 0.6 - 10, "#111315", "#f5f5f2", true, placed);
    }
    else {
      // a small check where the scoop took it
      const cx = X(g.x),
        cy = Y(g.y);
      ctx.strokeStyle = "#f0c232";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy);
      ctx.lineTo(cx - 1, cy + 4);
      ctx.lineTo(cx + 6, cy - 4);
      ctx.stroke();
    }
  }

  drawCar(ctx, run, X, Y, k);

  // scale bar
  const x0 = 12,
    y0 = h - 12;
  ctx.strokeStyle = "#f5f5f2";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0 - 5);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x0 + k, y0);
  ctx.lineTo(x0 + k, y0 - 5);
  ctx.stroke();
  ctx.fillStyle = "#f5f5f2";
  ctx.font = "600 11px ui-monospace, Menlo, Consolas, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("1 m", x0 + k + 6, y0 + 2);
}

function chip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg: string, clamp = true, avoid?: [number, number, number][]) {
  ctx.font = "600 10.5px ui-monospace, Menlo, Consolas, monospace";
  const tw = ctx.measureText(text).width;
  const cw = ctx.canvas.clientWidth || ctx.canvas.width;
  // keep item labels inside the canvas; drop maneuver labels whose anchor has scrolled away
  if (clamp) x = Math.max(tw / 2 + 9, Math.min(cw - tw / 2 - 9, x));
  else if (x < -tw / 2 || x > cw + tw / 2) return;
  // step up past earlier chips this frame that it would overlap
  if (avoid) {
    for (const [l, r, cy] of avoid) if (x + tw / 2 + 5 > l && x - tw / 2 - 5 < r && Math.abs(y - cy) < 17) y = cy - 18;
    avoid.push([x - tw / 2 - 5, x + tw / 2 + 5, y]);
  }
  ctx.fillStyle = bg;
  const bx = x - tw / 2 - 5,
    by = y - 8;
  ctx.beginPath();
  ctx.roundRect(bx, by, tw + 10, 16, 4);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
}

function drawPlan(ctx: CanvasRenderingContext2D, run: MissionRun, X: (x: number) => number, Y: (y: number) => number, k: number) {
  const plan = run.plan!;
  const p0 = plan.pose;
  const byStep = (n: number) => plan.pts.filter((q) => q.step === n);
  ctx.save();
  ctx.strokeStyle = plan.frozen ? "rgba(147,197,253,0.95)" : "rgba(147,197,253,0.6)";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.6;
  // step 2 out (and step 3 back along the same line), step 5 forward
  const s2 = byStep(2),
    s5 = byStep(5);
  const spurEnd = s2[s2.length - 1];
  if (spurEnd) {
    ctx.beginPath();
    ctx.moveTo(X(p0.x), Y(p0.y));
    ctx.lineTo(X(spurEnd.x), Y(spurEnd.y));
    ctx.stroke();
  }
  if (s5.length) {
    const a = s5[0],
      b = s5[s5.length - 1];
    ctx.beginPath();
    ctx.moveTo(X(a.x), Y(a.y));
    ctx.lineTo(X(b.x), Y(b.y));
    ctx.stroke();
    arrowHead(ctx, X(a.x), Y(a.y), X(b.x), Y(b.y));
  }
  // steps 1 and 4: 80 deg in place (arc around the pivot)
  ctx.setLineDash([]);
  const r = 0.22 * k;
  const th = p0.th;
  const turn = (run.sim.planner.p.turn_angle_deg * Math.PI) / 180;
  ctx.beginPath();
  ctx.arc(X(p0.x), Y(p0.y), r, -th, -th + turn, false);
  ctx.stroke();
  if (spurEnd) arrowHead(ctx, X(p0.x), Y(p0.y), X(spurEnd.x), Y(spurEnd.y));
  ctx.restore();

  const narrow = (ctx.canvas.clientWidth || 999) < 420;
  const lab = (t: string, x: number, y: number) => chip(ctx, t, x, y, "rgba(17,19,21,0.85)", "#bfdbfe", false);
  if (spurEnd) {
    const ang = Math.atan2(spurEnd.y - p0.y, spurEnd.x - p0.x);
    lab(narrow ? "2, 3: 0.4 m" : "2 out, 3 back: 0.4 m", X(spurEnd.x + 0.12 * Math.cos(ang)), Y(spurEnd.y + 0.12 * Math.sin(ang)) + 10);
    lab(narrow ? "1, 4: 80°" : "1, 4: 80° turn in place", X(p0.x) - (narrow ? 20 : 44), Y(p0.y) - 0.3 * k - 8);
  }
  if (s5.length) {
    const b = s5[s5.length - 1];
    lab("5: 0.34 m", X(b.x) + (narrow ? 26 : 40), Y(b.y) + 0.22 * k + 8);
  }
}

function arrowHead(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 8 * Math.cos(a - 0.4), y1 - 8 * Math.sin(a - 0.4));
  ctx.lineTo(x1 - 8 * Math.cos(a + 0.4), y1 - 8 * Math.sin(a + 0.4));
  ctx.closePath();
  ctx.fill();
}

/** Car sprite (drawn around the sim's reference point), with the blue scoop arm at the nose. */
function drawCar(ctx: CanvasRenderingContext2D, run: MissionRun, X: (x: number) => number, Y: (y: number) => number, k: number) {
  const { pose, servoAngle, servoOn } = run.sim;
  ctx.save();
  ctx.translate(X(pose.x), Y(pose.y));
  ctx.rotate(-pose.th);
  ctx.scale(k, k); // metres from here; +x forward, +y right (screen y down)
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.roundRect(-0.2 + 0.015, -0.13 + 0.025, 0.38, 0.26, 0.04);
  ctx.fill();
  // tyres
  ctx.fillStyle = "#0b0c0d";
  for (const [x, y] of [
    [-0.13, -0.135],
    [-0.13, 0.135],
    [0.11, -0.135],
    [0.11, 0.135],
  ])
    ctx.fillRect(x - 0.045, y - 0.025, 0.09, 0.05);
  // chassis + electronics box
  ctx.fillStyle = "#1c1e21";
  ctx.beginPath();
  ctx.roundRect(-0.2, -0.11, 0.38, 0.22, 0.035);
  ctx.fill();
  ctx.fillStyle = "#b91c1c";
  ctx.fillRect(-0.13, -0.065, 0.13, 0.13);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(-0.1, -0.035, 0.07, 0.07);
  // OAK-D Lite at the nose
  ctx.fillStyle = "#6b7280";
  ctx.fillRect(0.1, -0.045, 0.03, 0.09);
  // yellow nose stripe
  ctx.fillStyle = "#eab308";
  ctx.fillRect(0.155, -0.11, 0.025, 0.22);

  // scoop arm: pivots at the nose; its forward reach is L cos(angle) seen from above
  // (0 deg reaches forward, 100 deg has swung up and back over the nose)
  const a = (servoAngle * Math.PI) / 180;
  const reach = 0.17 * Math.cos(a);
  const px = 0.17;
  ctx.fillStyle = servoOn ? "#3b82f6" : "#2563eb";
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.006;
  for (const y of [-0.07, 0.07]) {
    ctx.beginPath();
    ctx.rect(Math.min(px, px + reach), y - 0.015, Math.abs(reach) + 0.02, 0.03);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.rect(px + reach - 0.02, -0.1, 0.04, 0.2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ camera inset

/** Half-resolution copy of the OAK-D model for the 5 Hz display render (same optics). */
export const CAM_DISPLAY: CameraModel = { ...CAMERA, W: 320, H: 240, f: CAMERA.f / 2 };

export class CameraRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly img: ImageData;
  private seed = 1;
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = CAM_DISPLAY.W;
    this.canvas.height = CAM_DISPLAY.H;
    this.img = new ImageData(CAM_DISPLAY.W, CAM_DISPLAY.H);
  }
  render(world: World, pose: Pose) {
    renderCamera(world, pose, this.img.data, CAM_DISPLAY, { seed: ++this.seed });
    this.canvas.getContext("2d")!.putImageData(this.img, 0, 0);
  }
}

/**
 * The annotated frame, in the node's own 640x480 pixel coordinates: draw_detection for
 * every prediction, then draw_steering_visualization (BGR colors converted to RGB).
 */
export function drawCameraFrame(ctx: CanvasRenderingContext2D, w: number, h: number, frame: HTMLCanvasElement | null, det: DetectorOutput | null) {
  ctx.fillStyle = "#0b0c0d";
  ctx.fillRect(0, 0, w, h);
  if (frame) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(frame, 0, 0, w, h);
  }
  if (!det || !det.preds.length) return;
  const W = CAMERA.W,
    H = CAMERA.H;
  ctx.save();
  ctx.scale(w / W, h / H);
  const GREEN = "rgb(0,255,0)",
    RED = "rgb(255,0,0)",
    BLUE_DOT = "rgb(0,0,255)";
  for (const p of det.preds) {
    const x1 = Math.trunc(p.x - Math.floor(p.width / 2)),
      y1 = Math.trunc(p.y - Math.floor(p.height / 2)),
      x2 = Math.trunc(p.x + Math.floor(p.width / 2)),
      y2 = Math.trunc(p.y + Math.floor(p.height / 2));
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 2;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    const label = `garbage ${p.confidence.toFixed(2)} W:${p.width.toFixed(0)}px`;
    // cv2.FONT_HERSHEY_SIMPLEX at scale 0.5, thickness 2 is about 11 px tall; drawn a
    // little larger here so it stays legible at inset size
    ctx.font = "bold 18px Arial, Helvetica, sans-serif";
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = GREEN;
    ctx.fillRect(x1, y1 - 13 - 10, tw, 13 + 10);
    ctx.fillStyle = "#000";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label, x1, y1 - 5);
  }
  const cam = Math.trunc(W * DETECT_PARAMS.camera_centerline);
  const off = Math.trunc((DETECT_PARAMS.error_threshold * W) / 2);
  ctx.lineCap = "butt";
  vline(ctx, cam, H, GREEN, 4);
  vline(ctx, cam - off, H, RED, 2);
  vline(ctx, cam + off, H, RED, 2);
  const tp = det.preds[det.targetIndex >= 0 ? det.targetIndex : 0];
  const tx = Math.trunc(tp.x),
    ty = Math.trunc(tp.y);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cam, ty);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.fillStyle = BLUE_DOT;
  ctx.beginPath();
  ctx.arc(tx, ty, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function vline(ctx: CanvasRenderingContext2D, x: number, H: number, color: string, lw: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, H);
  ctx.stroke();
}

