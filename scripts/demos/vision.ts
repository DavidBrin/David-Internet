/**
 * Computer Vision demo prep — thin wrapper around the Python half.
 *
 *   pnpm sync-demos vision
 *
 * scripts/demos/vision_prep.py (py -3.12, needs numpy/scipy/opencv/sklearn/Pillow)
 * re-renders the photometric-stereo inputs from facedata.npy, ships downscaled
 * course image pairs + correspondence data, rebuilds the bag-of-words vocabulary,
 * extracts the archived CNN curves, curates real notebook figures, and writes
 * the fixtures the TS ports are tested against.
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

export default async function run(ctx: PrepContext): Promise<void> {
  const rawDir = path.join(ctx.rawRoot, "computer_vision_cse152_raw");
  const script = path.join(ctx.repoRoot, "scripts", "demos", "vision_prep.py");
  const py = process.env.PYTHON_BIN ?? "py";
  const args = process.env.PYTHON_BIN ? [] : ["-3.12"];
  const r = spawnSync(py, [...args, script, rawDir, ctx.outDir, ctx.repoRoot], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
    timeout: 20 * 60 * 1000,
  });
  if (r.error) throw r.error;
  if (r.stdout) for (const line of r.stdout.split(/\r?\n/)) if (line.trim()) ctx.log(line);
  if (r.status !== 0) {
    throw new Error(`vision_prep.py exited ${r.status}:\n${r.stderr}`);
  }
}
