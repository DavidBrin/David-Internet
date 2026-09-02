/**
 * Cross-Teaching Segmentation demo prep — thin wrapper around the Python half.
 *
 *   pnpm sync-demos crossteach
 *
 * scripts/demos/crossteach_prep.py (py -3.12, needs torch/timm/segmentation-models-pytorch/
 * tensorflow-datasets/Pillow/sklearn) runs the real GitHub checkpoints
 * (DavidBrin/Semi-supervised-image-model, cloned into .cache/crossteach/) over a fixed set
 * of Oxford-IIIT Pet test images, ships predictions + confidence maps + ViT attention
 * rollouts + U-Net activations, packages the real training curves, renders micro-CT slices
 * from the Group 9 repo, extracts the DTU course notebooks for the Source drawer, and
 * writes the fixtures the TS ports are tested against.
 *
 * One-time setup on a fresh machine (all cached under .cache/, gitignored):
 *   git clone https://github.com/DavidBrin/Semi-supervised-image-model .cache/crossteach/Semi-supervised-image-model
 *   git clone https://github.com/DavidBrin/Semi-supervised-Microtomography-Segmentation .cache/crossteach/Semi-supervised-Microtomography-Segmentation
 *   (checkpoints come via Git LFS; TFDS downloads oxford_iiit_pet into .cache/tfds)
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

export default async function run(ctx: PrepContext): Promise<void> {
  const script = path.join(ctx.repoRoot, "scripts", "demos", "crossteach_prep.py");
  const py = process.env.PYTHON_BIN ?? "py";
  const args = process.env.PYTHON_BIN ? [] : ["-3.12"];
  const r = spawnSync(py, [...args, script, ctx.rawRoot, ctx.outDir, ctx.repoRoot], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
    timeout: 45 * 60 * 1000,
  });
  if (r.error) throw r.error;
  if (r.stdout) for (const line of r.stdout.split(/\r?\n/)) if (line.trim()) ctx.log(line);
  if (r.status !== 0) {
    throw new Error(`crossteach_prep.py exited ${r.status}:\n${r.stderr}`);
  }
}
