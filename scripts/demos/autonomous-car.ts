/**
 * Autonomous Car demo prep (UCSD ECE/MAE 148, spring 2025, Team 3).
 *
 *   pnpm sync-demos autonomous-car
 *
 * 1. Renders the fixture frames with the page's own virtual camera (core/camera.ts) into
 *    .cache/autonomous-car-fixture/ (BGR, the layout cv_bridge hands the node).
 * 2. Spawns scripts/demos/autonomous-car_prep.py (py -3.12, needs numpy + opencv-python +
 *    Pillow), which imports David's ORIGINAL node files from demos/autonomous_car_raw/Code
 *    under stubbed rclpy / cv_bridge / roboflowoak / PCA9685 modules, runs them on those
 *    frames and scripted message streams, and writes tests/fixtures/autonomous-car-*.json.
 *    It also ships the photos and clips to public/demos/autonomous-car/.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";
import { CAMERA, renderCamera } from "../../src/demos/autonomous-car/core/camera";
import { bgrFromRGBA } from "../../src/demos/autonomous-car/core/cv";
import { World } from "../../src/demos/autonomous-car/core/world";

interface Scene {
  name: string;
  s: number;
  /** lateral offset from the tape (m, + = left) and heading offset (rad) */
  off: number;
  dth: number;
  shade?: number;
  garbage?: boolean;
}

/** Straights, curve entries, dash gaps, offsets that put the tape near the threshold band, shade, garbage. */
const SCENES: Scene[] = [
  { name: "straight", s: 2.0, off: 0, dth: 0 },
  { name: "straight_gap", s: 2.35, off: 0, dth: 0 },
  { name: "offset_left", s: 5.0, off: 0.12, dth: 0 },
  { name: "offset_right", s: 6.1, off: -0.1, dth: 0.05 },
  { name: "curve_entry", s: 9.4, off: 0, dth: 0 },
  { name: "curve_mid", s: 16.0, off: 0.05, dth: -0.08 },
  { name: "curve_wide", s: 24.0, off: -0.25, dth: 0.2 },
  { name: "yawed", s: 33.0, off: 0.0, dth: 0.25 },
  { name: "shade_light", s: 11.8, off: 0, dth: 0, shade: 1 },
  { name: "shade_deep", s: 11.8, off: 0, dth: 0, shade: 2.6 },
  { name: "grass_edge", s: 70.0, off: 0.3, dth: -0.35 },
  { name: "garbage_ahead", s: 5.0, off: 0, dth: 0, garbage: true },
];

export default async function run(ctx: PrepContext): Promise<void> {
  const cache = path.join(ctx.repoRoot, ".cache", "autonomous-car-fixture");
  fs.mkdirSync(cache, { recursive: true });
  const rgba = new Uint8ClampedArray(CAMERA.W * CAMERA.H * 4);
  const manifest: { name: string; file: string; w: number; h: number; pose: number[] }[] = [];
  for (const sc of SCENES) {
    const garbage = sc.garbage
      ? [{ id: "box", x: 0, y: 0, w: 0.26, d: 0.2, h: 0.14, yaw: 0.25, color: [176, 128, 84] as [number, number, number], label: "cardboard box" }]
      : [];
    const world = new World({ shadeScale: sc.shade ?? 1, garbage });
    const p = world.pointAt(sc.s);
    const pose = { x: p.x - Math.sin(p.th) * sc.off, y: p.y + Math.cos(p.th) * sc.off, th: p.th + sc.dth };
    if (sc.garbage) {
      const g = world.garbage[0];
      g.x = pose.x + Math.cos(pose.th) * 1.1;
      g.y = pose.y + Math.sin(pose.th) * 1.1 + 0.05;
    }
    renderCamera(world, pose, rgba, CAMERA, { seed: 7 });
    const bgr = bgrFromRGBA(rgba, CAMERA.W, CAMERA.H);
    const file = `${sc.name}.bgr`;
    fs.writeFileSync(path.join(cache, file), bgr.data);
    manifest.push({ name: sc.name, file, w: CAMERA.W, h: CAMERA.H, pose: [pose.x, pose.y, pose.th] });
  }
  fs.writeFileSync(path.join(cache, "frames.json"), JSON.stringify(manifest, null, 1));
  ctx.log(`rendered ${manifest.length} fixture frames -> ${path.relative(ctx.repoRoot, cache)}`);

  const rawDir = path.join(ctx.rawRoot, "autonomous_car_raw");
  const script = path.join(ctx.repoRoot, "scripts", "demos", "autonomous-car_prep.py");
  const py = process.env.PYTHON_BIN ?? "py";
  const args = process.env.PYTHON_BIN ? [] : ["-3.12"];
  const r = spawnSync(py, [...args, script, rawDir, ctx.outDir, ctx.repoRoot, cache], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
    timeout: 20 * 60 * 1000,
  });
  if (r.error) throw r.error;
  if (r.stdout) for (const line of r.stdout.split(/\r?\n/)) if (line.trim()) ctx.log(line);
  if (r.status !== 0) throw new Error(`autonomous-car_prep.py exited ${r.status}:\n${r.stderr}`);
}
