/**
 * sync-demos.ts — builds the small, purpose-made assets each demo page ships.
 *
 * Run with:  pnpm sync-demos [slug ...]
 *
 * Mirrors sync-content.ts: every demo has a prep module in scripts/demos/<slug>.ts that
 * turns files under demos/<...>_raw/ (the archive, never modified) into whatever the page
 * needs under public/demos/<slug>/ — downsampled recordings, simplified geometry,
 * pre-rendered simulation results, compressed images. Outputs are committed, so a build
 * on a machine without the local toolchains (Icarus Verilog, KiCad, scipy, …) still works.
 *
 * Each prep module exports `default async function run(ctx: PrepContext): Promise<void>`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface PrepContext {
  repoRoot: string;
  /** demos/ — the raw archive root. */
  rawRoot: string;
  /** public/demos/<slug>/ — created before run(). */
  outDir: string;
  log: (msg: string) => void;
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREP_DIR = path.join(REPO_ROOT, "scripts", "demos");

async function main() {
  const requested = process.argv.slice(2);
  const available = fs
    .readdirSync(PREP_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => f.replace(/\.ts$/, ""));
  const slugs = requested.length ? requested : available;

  for (const slug of slugs) {
    if (!available.includes(slug)) {
      console.error(`No prep module for "${slug}" (scripts/demos/${slug}.ts)`);
      process.exitCode = 1;
      continue;
    }
    const outDir = path.join(REPO_ROOT, "public", "demos", slug);
    fs.mkdirSync(outDir, { recursive: true });
    const ctx: PrepContext = {
      repoRoot: REPO_ROOT,
      rawRoot: path.join(REPO_ROOT, "demos"),
      outDir,
      log: (msg) => console.log(`[${slug}] ${msg}`),
    };
    const mod = await import(pathToFileURL(path.join(PREP_DIR, `${slug}.ts`)).href);
    ctx.log("start");
    await mod.default(ctx);
    ctx.log("done");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
