/**
 * P300 Speller demo prep — thin wrapper around the Python half.
 *
 *   pnpm sync-demos p300
 *
 * scripts/demos/p300_prep.py (py -3.12, needs numpy/Pillow) compresses the
 * README figures, packages the notebook results (subject B runs committed in
 * the raw repo) into results.json, builds the 64-electrode head-map layout +
 * illustrative first-layer filters into head.json, extracts notebook code
 * cells for the Source drawer, and writes the decode fixture the TS port of
 * the speller's letter-decoding logic is tested against.
 *
 * No dataset and no training: the BCI Competition III .mat files and trained
 * models were never archived (excluded at crawl time) — the live speller runs
 * on synthetic EEG and the quoted numbers are the notebooks' committed outputs.
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

export default async function run(ctx: PrepContext): Promise<void> {
  const script = path.join(ctx.repoRoot, "scripts", "demos", "p300_prep.py");
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
    throw new Error(`p300_prep.py exited ${r.status}:\n${r.stderr}`);
  }
}
