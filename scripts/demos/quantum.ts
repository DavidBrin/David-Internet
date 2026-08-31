/**
 * Quantum Playground demo prep — thin wrapper around the Python half.
 *
 *   pnpm sync-demos quantum
 *
 * scripts/demos/quantum_prep.py (py -3.12, needs numpy) generates the NumPy fixtures
 * the TypeScript simulator is tested against. Outputs are committed, so builds
 * elsewhere don't need Python.
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

export default async function run(ctx: PrepContext): Promise<void> {
  const rawDir = path.join(ctx.rawRoot, "quantum_information_qutip_raw");
  const script = path.join(ctx.repoRoot, "scripts", "demos", "quantum_prep.py");
  const py = process.env.PYTHON_BIN ?? "py";
  const args = process.env.PYTHON_BIN ? [] : ["-3.12"];
  const r = spawnSync(py, [...args, script, rawDir, ctx.outDir, ctx.repoRoot], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  if (r.error) throw r.error;
  if (r.stdout) for (const line of r.stdout.split(/\r?\n/)) if (line.trim()) ctx.log(line);
  if (r.status !== 0) throw new Error(`quantum_prep.py exited ${r.status}:\n${r.stderr}`);
}
