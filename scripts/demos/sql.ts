/**
 * SQL Playground demo prep — Python half plus the sql.js wasm copy.
 *
 *   pnpm sync-demos sql
 *
 * scripts/demos/sql_prep.py (py -3.12, needs Pillow; sqlite3 is stdlib)
 * translates the MariaDB course scripts to SQLite, ships the .sqlite files,
 * presets, schema graphs, compressed ER drawings, vendored sources and the
 * preset fixture. This wrapper also copies sql.js's wasm binary into
 * public/demos/sql/ so the page can load it without a CDN.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

export default async function run(ctx: PrepContext): Promise<void> {
  const script = path.join(ctx.repoRoot, "scripts", "demos", "sql_prep.py");
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
    throw new Error(`sql_prep.py exited ${r.status}:\n${r.stderr}`);
  }

  const wasmSrc = path.join(ctx.repoRoot, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const wasmDst = path.join(ctx.outDir, "sql-wasm.wasm");
  fs.copyFileSync(wasmSrc, wasmDst);
  ctx.log(`sql-wasm.wasm copied (${Math.round(fs.statSync(wasmDst).size / 1024)} KB)`);
}
