/**
 * render.ts -- canvas drawing for the vex field. World is y-up mm; canvas is
 * y-down CSS px. Pure functions, no React/DOM state beyond the 2d context.
 */
import { ROBOT_RADIUS, type RobotState, type World } from "./vexcode";

export interface View {
  scale: number; // css px per mm
  ox: number; // css px
  oy: number; // css px
}

/**
 * DPR-aware square canvas sizing, applied imperatively (no React state):
 * canvas.style.display is forced to "block", and resizes smaller than 2px
 * are ignored so a ResizeObserver-driven parent doesn't thrash the backing
 * store every frame.
 */
export function ensureCanvasSize(
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
  lastSize: { w: number; h: number } | null
): { w: number; h: number } {
  canvas.style.display = "block";
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(wrap.clientWidth));
  const h = w;
  const settled = lastSize !== null && Math.abs(w - lastSize.w) < 2 && Math.abs(h - lastSize.h) < 2;
  if (!settled) {
    const needW = Math.floor(w * dpr);
    const needH = Math.floor(h * dpr);
    if (canvas.width !== needW || canvas.height !== needH) {
      canvas.width = needW;
      canvas.height = needH;
    }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

export function computeView(world: World, cssW: number, cssH: number): View {
  const scale = Math.min(cssW / (2 * world.halfW), cssH / (2 * world.halfH)) * 0.92;
  return { scale, ox: cssW / 2, oy: cssH / 2 };
}

export function worldToScreen(view: View, x: number, y: number): { x: number; y: number } {
  return { x: view.ox + x * view.scale, y: view.oy - y * view.scale };
}

interface DrawOpts {
  accent: string;
  showSensorRay: boolean;
  sensorDistMm: number | null;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  world: World,
  robot: RobotState,
  opts: DrawOpts
): void {
  const view = computeView(world, cssW, cssH);
  ctx.clearRect(0, 0, cssW, cssH);

  // field background
  const fieldTL = worldToScreen(view, -world.halfW, world.halfH);
  ctx.fillStyle = "#faf7ef";
  ctx.fillRect(fieldTL.x, fieldTL.y, world.halfW * 2 * view.scale, world.halfH * 2 * view.scale);

  // subtle grid
  ctx.strokeStyle = "#e7e1d2";
  ctx.lineWidth = 1;
  const gridStep = 200; // mm
  for (let gx = -world.halfW; gx <= world.halfW; gx += gridStep) {
    const a = worldToScreen(view, gx, -world.halfH);
    const b = worldToScreen(view, gx, world.halfH);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (let gy = -world.halfH; gy <= world.halfH; gy += gridStep) {
    const a = worldToScreen(view, -world.halfW, gy);
    const b = worldToScreen(view, world.halfW, gy);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // floor marks (under walls, under robot)
  for (const m of world.floorMarks) {
    const tl = worldToScreen(view, m.x0, m.y1);
    ctx.fillStyle = m.color === "green" ? "#22c55e" : "#94a3b8";
    ctx.fillRect(tl.x, tl.y, (m.x1 - m.x0) * view.scale, (m.y1 - m.y0) * view.scale);
  }

  // pen trails
  ctx.strokeStyle = opts.accent;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const stroke of robot.trail) {
    if (stroke.length < 2) continue;
    ctx.beginPath();
    const p0 = worldToScreen(view, stroke[0].x, stroke[0].y);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < stroke.length; i++) {
      const p = worldToScreen(view, stroke[i].x, stroke[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // walls
  ctx.fillStyle = "#c0392b";
  for (const w of world.walls) {
    const tl = worldToScreen(view, w.x0, w.y1);
    ctx.fillRect(tl.x, tl.y, (w.x1 - w.x0) * view.scale, (w.y1 - w.y0) * view.scale);
  }

  // robot: chassis + heading wedge
  const rp = worldToScreen(view, robot.x, robot.y);
  const rr = Math.max(4, ROBOT_RADIUS * view.scale);
  const rad = (robot.heading * Math.PI) / 180;
  const fwd = { x: Math.sin(rad), y: -Math.cos(rad) }; // screen-space forward (y flipped)

  if (opts.showSensorRay && opts.sensorDistMm !== null) {
    const dMm = Math.min(opts.sensorDistMm, 4000);
    const tip = worldToScreen(
      view,
      robot.x + Math.sin(rad) * dMm,
      robot.y + Math.cos(rad) * dMm
    );
    ctx.strokeStyle = "rgba(245,158,11,0.55)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rp.x, rp.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.save();
  ctx.translate(rp.x, rp.y);
  ctx.rotate(Math.atan2(fwd.y, fwd.x) + Math.PI / 2);
  ctx.fillStyle = "#1f2937";
  ctx.beginPath();
  const rw = rr * 1.15;
  const rh = rr * 1.4;
  const radius = Math.min(6, rw * 0.3);
  ctx.roundRect(-rw / 2, -rh / 2, rw, rh, radius);
  ctx.fill();
  ctx.fillStyle = opts.accent;
  ctx.beginPath();
  ctx.moveTo(0, -rh / 2 - 2);
  ctx.lineTo(rw / 4, -rh / 2 + rh * 0.25);
  ctx.lineTo(-rw / 4, -rh / 2 + rh * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
