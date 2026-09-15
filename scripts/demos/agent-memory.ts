/**
 * Agent Memory Timeline demo preparation.
 *
 * The demo ships a committed trace and source-drawer copies, so production
 * rendering has no Python runtime or dependency on the sibling checkout.
 *
 *   AGENT_MEMORY_ROOT=/absolute/path/to/Agent_Memory pnpm sync-demos agent-memory
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

export const REQUIRED_SNAPSHOT_IDS = [
  "temporal-before-correction",
  "temporal-after-correction",
  "session-boundary",
  "quarantine",
  "clearance",
  "graph-expansion",
  "after-deletion",
  "integrity-check",
] as const;

const SOURCE_FILES = ["demo.py", "trace_export.py", "write_gate.py", "retrieval.py", "graph.py", "schema.py", "textutil.py"] as const;

type TraceCandidate = {
  version?: unknown;
  snapshots?: unknown;
};

/** Validate only the preparation boundary; browser-level parsing stays separate. */
export function validateTrace(trace: unknown): asserts trace is { version: 1; snapshots: { id: string }[] } {
  if (!trace || typeof trace !== "object") throw new Error("Agent Memory trace must be a JSON object");
  const candidate = trace as TraceCandidate;
  if (candidate.version !== 1) throw new Error("Agent Memory trace must use version 1");
  if (!Array.isArray(candidate.snapshots)) throw new Error("Agent Memory trace must contain a snapshots array");

  const ids = new Set<string>();
  for (const snapshot of candidate.snapshots) {
    if (!snapshot || typeof snapshot !== "object" || typeof (snapshot as { id?: unknown }).id !== "string") {
      throw new Error("Every Agent Memory trace snapshot must have an id");
    }
    ids.add((snapshot as { id: string }).id);
  }
  for (const id of REQUIRED_SNAPSHOT_IDS) {
    if (!ids.has(id)) throw new Error(`Agent Memory trace is missing required snapshot: ${id}`);
  }
}

function agentMemoryRoot(): string {
  const root = process.env.AGENT_MEMORY_ROOT;
  if (!root) throw new Error("AGENT_MEMORY_ROOT must name an absolute Agent_Memory checkout");
  if (!path.isAbsolute(root)) throw new Error(`AGENT_MEMORY_ROOT must be absolute: ${root}`);
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`AGENT_MEMORY_ROOT does not name a directory: ${root}`);
  }
  return root;
}

function runExporter(root: string, tracePath: string, log: (message: string) => void): void {
  const experimentRoot = path.join(root, "experiments", "memory_os_v0");
  const exporter = path.join(experimentRoot, "memory_os", "trace_export.py");
  if (!fs.existsSync(exporter)) {
    throw new Error(`Agent Memory trace exporter not found at ${exporter} (AGENT_MEMORY_ROOT=${root})`);
  }

  const result = spawnSync("python3", ["-m", "memory_os.trace_export", "--out", tracePath], {
    cwd: root,
    env: { ...process.env, PYTHONPATH: experimentRoot },
    encoding: "utf8",
  });
  if (result.error) throw new Error(`Agent Memory exporter failed to start from ${root}: ${result.error.message}`);
  if (result.stdout) for (const line of result.stdout.split(/\r?\n/)) if (line.trim()) log(line);
  if (result.status !== 0) {
    throw new Error(`Agent Memory exporter failed for ${root} (exit ${result.status}):\n${result.stderr}`);
  }
}

function copySourceDrawerFiles(root: string, rawRoot: string): void {
  const sourceDir = path.join(root, "experiments", "memory_os_v0", "memory_os");
  const targetDir = path.join(rawRoot, "agent_memory_raw");
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of SOURCE_FILES) {
    const source = path.join(sourceDir, file);
    if (!fs.existsSync(source)) throw new Error(`Agent Memory source not found: ${source} (AGENT_MEMORY_ROOT=${root})`);
    fs.copyFileSync(source, path.join(targetDir, file));
  }
}

export default async function run(ctx: PrepContext): Promise<void> {
  const root = agentMemoryRoot();
  const tracePath = path.join(ctx.outDir, "trace.json");
  runExporter(root, tracePath, ctx.log);

  let trace: unknown;
  try {
    trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  } catch (error) {
    throw new Error(`Agent Memory exporter at ${root} did not produce valid JSON at ${tracePath}: ${String(error)}`);
  }
  validateTrace(trace);
  copySourceDrawerFiles(root, ctx.rawRoot);
  ctx.log(`trace.json and ${SOURCE_FILES.length} source-drawer files prepared from ${root}`);
}
