/**
 * sync-content.ts — vendors the source projects' docs + screenshots into this repo.
 *
 * Run with:  pnpm sync-content
 *
 * For every project in SOURCES it copies:
 *   <sourceDir>/README.md      → content/<slug>/README.md
 *   <sourceDir>/SPEC.md        → content/<slug>/SPEC.md
 *   <sourceDir>/DECISIONS.md   → content/<slug>/DECISIONS.md
 *   <sourceDir>/docs/screenshots/*.png → public/content/<slug>/screenshots/*.png
 *
 * Idempotent: re-running overwrites with the current source bytes and skips
 * anything the source project doesn't have. Never deletes hand-written files
 * (content/<slug>/site.ts is authored here and is left alone).
 *
 * To add a project: add a slug → absolute sourceDir entry to SOURCES, run the
 * script, then write content/<slug>/site.ts and register it in src/lib/manifests.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Root of the source checkouts. Defaults to a "Replicates" directory sitting
 * next to this repo; point REPLICATES_ROOT elsewhere on machines with a
 * different layout.
 */
const REPLICATES_ROOT =
  process.env.REPLICATES_ROOT ?? path.resolve(REPO_ROOT, "..", "Replicates");

/** slug → source project directory under REPLICATES_ROOT. */
const SOURCES: Record<string, string> = {
  linear: path.join(REPLICATES_ROOT, "Linear"),
  youtube: path.join(REPLICATES_ROOT, "youtube"),
  "super-smash": path.join(REPLICATES_ROOT, "super-smash"),
  "fake-phone": path.join(REPLICATES_ROOT, "fake-phone"),
  bet: path.join(REPLICATES_ROOT, "bet"),
  "dollar-pixels": path.join(REPLICATES_ROOT, "dollar-pixels"),
  notion: path.join(REPLICATES_ROOT, "Notion"),
  "fl-studio": path.join(REPLICATES_ROOT, "fl-studio"),
};

const PERSONAL_PROJECTS_ROOT = path.resolve(REPO_ROOT, "..");
const EXTRA_SOURCES: Record<string, string> = {
  "art-wall": path.join(PERSONAL_PROJECTS_ROOT, "ArtWall"),
};

if (!fs.existsSync(REPLICATES_ROOT)) {
  console.error(
    `Source root not found: ${REPLICATES_ROOT}\n` +
      "Set REPLICATES_ROOT=/path/to/Replicates and re-run pnpm sync-content.",
  );
  process.exit(1);
}

const DOC_FILES = ["README.md", "SPEC.md", "DECISIONS.md"] as const;

function copyFileIfPresent(src: string, dest: string): boolean {
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function syncProject(slug: string, sourceDir: string) {
  console.log(`\n${slug}`);
  if (!fs.existsSync(sourceDir)) {
    console.log(`  ! source dir missing, skipping: ${sourceDir}`);
    return;
  }

  const contentDir = path.join(REPO_ROOT, "content", slug);
  fs.mkdirSync(contentDir, { recursive: true });

  const copiedDocs: string[] = [];
  const missingDocs: string[] = [];
  for (const file of DOC_FILES) {
    let ok = copyFileIfPresent(path.join(sourceDir, file), path.join(contentDir, file));
    // FL Studio (and any later replica) logs decisions as design-decisions.md.
    if (!ok && file === "DECISIONS.md") {
      ok = copyFileIfPresent(
        path.join(sourceDir, "design-decisions.md"),
        path.join(contentDir, file),
      );
    }
    (ok ? copiedDocs : missingDocs).push(file);
  }
  console.log(`  docs: ${copiedDocs.length ? copiedDocs.join(", ") : "(none)"}`);
  if (missingDocs.length) console.log(`  docs skipped (absent at source): ${missingDocs.join(", ")}`);

  const shotsSrc = path.join(sourceDir, "docs", "screenshots");
  const shotsDest = path.join(REPO_ROOT, "public", "content", slug, "screenshots");
  if (!fs.existsSync(shotsSrc)) {
    console.log("  screenshots: (no docs/screenshots dir at source)");
    return;
  }
  const pngs = fs
    .readdirSync(shotsSrc)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort();
  if (pngs.length === 0) {
    console.log("  screenshots: (none)");
    return;
  }
  fs.mkdirSync(shotsDest, { recursive: true });
  for (const png of pngs) {
    fs.copyFileSync(path.join(shotsSrc, png), path.join(shotsDest, png));
  }
  console.log(`  screenshots: ${pngs.length} → public/content/${slug}/screenshots/`);
  console.log(`    ${pngs.join(", ")}`);
}

function main() {
  console.log(`Vendoring content into ${REPO_ROOT}`);
  for (const [slug, sourceDir] of Object.entries({ ...SOURCES, ...EXTRA_SOURCES })) {
    syncProject(slug, sourceDir);
  }
  console.log("\nDone.");
}

main();
