/**
 * Early 3D Modeling demo prep — thin wrapper around the Python half.
 *
 *   pnpm sync-demos modeling
 *
 * scripts/demos/modeling_prep.py (py -3.12, needs Pillow) compresses the
 * Inventor renders and curated VEXcode VR screenshots to WebP, parses the
 * .vrblocks Blockly XML into readable listings, extracts the .vrpython
 * sources, and writes programs.json + the Source drawer copies. No Inventor
 * or VEX toolchain involved — no 3D exports exist (a GLB viewer can be added
 * if models are ever exported).
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

export default async function run(ctx: PrepContext): Promise<void> {
  const script = path.join(ctx.repoRoot, "scripts", "demos", "modeling_prep.py");
  const py = process.env.PYTHON_BIN ?? "py";
  const args = process.env.PYTHON_BIN ? [] : ["-3.12"];
  const r = spawnSync(py, [...args, script, ctx.rawRoot, ctx.outDir, ctx.repoRoot], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
    timeout: 10 * 60 * 1000,
  });
  if (r.error) throw r.error;
  if (r.stdout) for (const line of r.stdout.split(/\r?\n/)) if (line.trim()) ctx.log(line);
  if (r.status !== 0) {
    throw new Error(`modeling_prep.py exited ${r.status}:\n${r.stderr}`);
  }
}
