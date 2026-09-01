/**
 * arXiv Semantic Graph demo prep — thin wrapper around the Python half.
 *
 *   pnpm sync-demos arxiv
 *
 * scripts/demos/arxiv_prep.py (py -3.12, needs numpy/sklearn/networkx/
 * tensorflow-hub/Pillow) streams the Kaggle arXiv metadata snapshot from
 * .cache/kagglehub/ (download once via kagglehub), embeds a 2,500-paper
 * stratified subsample with USE v4, mirrors the Group 36 pipeline
 * (k-NN distances → τ candidates → per-τ Louvain), and writes the committed
 * assets under public/demos/arxiv/ plus fixtures under tests/fixtures/.
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

export default async function run(ctx: PrepContext): Promise<void> {
  const rawDir = path.join(ctx.rawRoot, "arxiv_semantic_graph_raw");
  const script = path.join(ctx.repoRoot, "scripts", "demos", "arxiv_prep.py");
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
    throw new Error(`arxiv_prep.py exited ${r.status}:\n${r.stderr}`);
  }
}
