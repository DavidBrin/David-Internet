/**
 * Anatomy of a Spike demo prep — thin wrapper around the Python half.
 *
 *   pnpm sync-demos spikes
 *
 * scripts/demos/spikes_prep.py (py -3.12, needs numpy/scipy/statsmodels/h5py/
 * dandi/Pillow and the spikeparam package from demos/spikeparam_raw/) downloads
 * a small per-subject sample of DANDI:001776 into .cache/spikes_nwb/ (first run
 * only), runs the real spikeparam pipeline, and writes the committed assets
 * under public/demos/spikes/ plus the fit fixtures under tests/fixtures/.
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

export default async function run(ctx: PrepContext): Promise<void> {
  const rawDir = path.join(ctx.rawRoot, "spike_proj_raw");
  const script = path.join(ctx.repoRoot, "scripts", "demos", "spikes_prep.py");
  const py = process.env.PYTHON_BIN ?? "py";
  const args = process.env.PYTHON_BIN ? [] : ["-3.12"];
  const r = spawnSync(py, [...args, script, rawDir, ctx.outDir, ctx.repoRoot], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
    timeout: 45 * 60 * 1000,
  });
  if (r.error) throw r.error;
  if (r.stdout) for (const line of r.stdout.split(/\r?\n/)) if (line.trim()) ctx.log(line);
  if (r.status !== 0) {
    throw new Error(`spikes_prep.py exited ${r.status}:\n${r.stderr}`);
  }
}
