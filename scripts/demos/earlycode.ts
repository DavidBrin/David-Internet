/**
 * Early Code demo prep — thin wrapper around the Python half.
 *
 *   pnpm sync-demos earlycode
 *
 * scripts/demos/earlycode_prep.py (py -3.12, stdlib only) ships the C++
 * final's numbers files (large one truncated), synthesizes the doc-search
 * stand-in corpus, gathers the CSE 12 Java from OneDrive into
 * demos/java_servers_raw/cse12/ (PID/email scrubbed), vendors drawer sources
 * and notebook extracts, and writes the Aho-Corasick + cpp-final fixtures
 * from pure-Python reference implementations.
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

export default async function run(ctx: PrepContext): Promise<void> {
  const script = path.join(ctx.repoRoot, "scripts", "demos", "earlycode_prep.py");
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
    throw new Error(`earlycode_prep.py exited ${r.status}:\n${r.stderr}`);
  }
}
