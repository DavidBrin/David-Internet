/**
 * ESP32 Thermal TinyML demo prep — thin wrapper around the Python half.
 *
 *   pnpm sync-demos esp32
 *
 * scripts/demos/esp32_prep.py (py -3.12, needs numpy/pandas/sklearn/tensorflow/PIL)
 * builds the committed assets in public/demos/esp32/ (anonymized frame subset,
 * model weights + quant params, training curves, synthetic netmap, figures) and
 * the fixtures the TS ports are tested against. Outputs are committed, so builds
 * elsewhere don't need Python or TensorFlow.
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

export default async function run(ctx: PrepContext): Promise<void> {
  const tinyml = path.join(ctx.rawRoot, "tinyml_esp32_raw");
  const fastapi = path.join(ctx.rawRoot, "esp32_iot_fastapi_raw");
  const script = path.join(ctx.repoRoot, "scripts", "demos", "esp32_prep.py");
  const py = process.env.PYTHON_BIN ?? "py";
  const args = process.env.PYTHON_BIN ? [] : ["-3.12"];
  const r = spawnSync(py, [...args, script, tinyml, fastapi, ctx.outDir, ctx.repoRoot], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
    timeout: 1000 * 60 * 45, // the training replay is the slow part
  });
  if (r.error) throw r.error;
  if (r.stdout) for (const line of r.stdout.split(/\r?\n/)) if (line.trim()) ctx.log(line);
  if (r.status !== 0) throw new Error(`esp32_prep.py exited ${r.status}:\n${r.stderr}`);
}
