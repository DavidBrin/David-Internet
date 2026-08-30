/**
 * Verilog demo prep — simulates the RTL with Icarus Verilog at build time.
 *
 *   pnpm sync-demos verilog
 *
 * 1. Viterbi: compiles demos/verilog_src/viterbi/ (the working copy of the raw project) with
 *    the course testbench, once per channel preset (2.a.1 … 2.a.8, clean, random), parses
 *    the scoreboard, and turns the VCD into a compact per-cycle JSON for the logic-analyzer
 *    panel → public/demos/verilog/viterbi.json
 * 2. Module shelf: runs every bench in demos/verilog_src/lib/benches.json and writes
 *    pass/fail → public/demos/verilog/benches.json; copies the .sv sources to
 *    public/demos/verilog/lib-src/ for the RTL panes.
 *
 * Needs iverilog/vvp on PATH or IVERILOG_BIN pointing at their directory. Outputs are
 * committed so builds elsewhere don't need the toolchain.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

const DEFAULT_IVERILOG_BIN = "C:\\Users\\david\\iverilog-env\\Library\\bin";

interface Preset {
  id: string;
  label: string;
  PERIOD: number;
  BURST: number;
  ERR_BIT0: 0 | 1;
  ERR_BIT1: 0 | 1;
  USE_RAND: 0 | 1;
  ENABLE_ERR: 0 | 1;
}

/** The testbench's commented-out configurations, verbatim, plus clean + random. */
const PRESETS: Preset[] = [
  { id: "clean", label: "No channel errors", PERIOD: 16, BURST: 1, ERR_BIT0: 0, ERR_BIT1: 0, USE_RAND: 0, ENABLE_ERR: 0 },
  { id: "2a1", label: "2.a.1 — bit[0], once every 8", PERIOD: 8, BURST: 1, ERR_BIT0: 1, ERR_BIT1: 0, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a2", label: "2.a.2 — bit[1], once every 8", PERIOD: 8, BURST: 1, ERR_BIT0: 0, ERR_BIT1: 1, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a3", label: "2.a.3 — both bits, once every 16", PERIOD: 16, BURST: 1, ERR_BIT0: 1, ERR_BIT1: 1, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a4", label: "2.a.4 — bit[0], 2 in a row every 16", PERIOD: 16, BURST: 2, ERR_BIT0: 1, ERR_BIT1: 0, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a5", label: "2.a.5 — bit[1], 2 in a row every 16", PERIOD: 16, BURST: 2, ERR_BIT0: 0, ERR_BIT1: 1, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a6", label: "2.a.6 — bit[0], 4 in a row every 32", PERIOD: 32, BURST: 4, ERR_BIT0: 1, ERR_BIT1: 0, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a7", label: "2.a.7 — bit[1], 4 in a row every 32", PERIOD: 32, BURST: 4, ERR_BIT0: 0, ERR_BIT1: 1, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "2a8", label: "2.a.8 — both bits, 2 in a row every 32", PERIOD: 32, BURST: 2, ERR_BIT0: 1, ERR_BIT1: 1, USE_RAND: 0, ENABLE_ERR: 1 },
  { id: "rand", label: "2.b — random, both bits, ~2/32", PERIOD: 32, BURST: 2, ERR_BIT0: 1, ERR_BIT1: 1, USE_RAND: 1, ENABLE_ERR: 1 },
  // 2.c–2.e: "keep doubling until boo! appears" — the burst sweep.
  ...[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map<Preset>((burst) => ({
    id: `sweep0-${burst}`,
    label: `2.c — bit[0] burst of ${burst} every 256`,
    PERIOD: 256,
    BURST: burst,
    ERR_BIT0: 1,
    ERR_BIT1: 0,
    USE_RAND: 0,
    ENABLE_ERR: 1,
  })),
  ...[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map<Preset>((burst) => ({
    id: `sweep1-${burst}`,
    label: `2.d — bit[1] burst of ${burst} every 256`,
    PERIOD: 256,
    BURST: burst,
    ERR_BIT0: 0,
    ERR_BIT1: 1,
    USE_RAND: 0,
    ENABLE_ERR: 1,
  })),
  ...[1, 2, 3, 4, 5, 6, 8].map<Preset>((burst) => ({
    id: `sweep2-${burst}`,
    label: `2.e — both bits burst of ${burst} every 256`,
    PERIOD: 256,
    BURST: burst,
    ERR_BIT0: 1,
    ERR_BIT1: 1,
    USE_RAND: 0,
    ENABLE_ERR: 1,
  })),
];

/** Signals captured per clock cycle for the waveform panel (hierarchical VCD names). */
const WAVE_SIGNALS: { name: string; vcd: string }[] = [
  { name: "rst", vcd: "viterbi_tx_rx_tb.rst" },
  { name: "encoder_i", vcd: "viterbi_tx_rx_tb.encoder_i" },
  { name: "enable_encoder_i", vcd: "viterbi_tx_rx_tb.enable_encoder_i" },
  { name: "encoder_o", vcd: "viterbi_tx_rx_tb.vtr.encoder_o" },
  { name: "err_inj", vcd: "viterbi_tx_rx_tb.vtr.err_inj" },
  { name: "encoder_o_reg", vcd: "viterbi_tx_rx_tb.vtr.encoder_o_reg" },
  { name: "enable_decoder_in", vcd: "viterbi_tx_rx_tb.vtr.enable_decoder_in" },
  { name: "validity", vcd: "viterbi_tx_rx_tb.vtr.decoder1.validity" },
  { name: "selection", vcd: "viterbi_tx_rx_tb.vtr.decoder1.selection" },
  { name: "path_cost", vcd: "viterbi_tx_rx_tb.vtr.decoder1.path_cost_flat" },
  { name: "best_state", vcd: "viterbi_tx_rx_tb.vtr.decoder1.best_state" },
  { name: "best_metric", vcd: "viterbi_tx_rx_tb.vtr.decoder1.best_metric" },
  { name: "d_out_raw", vcd: "viterbi_tx_rx_tb.vtr.decoder1.d_out_raw" },
  { name: "decoder_o", vcd: "viterbi_tx_rx_tb.decoder_o" },
];

/** Cycle windows kept from each run (the message goes in early; comes out ~4105 cycles later). */
const WINDOWS: { id: string; from: number; to: number }[] = [
  { id: "in", from: 0, to: 300 },
  { id: "out", from: 4095, to: 4395 },
];

const CLK_NS = 100;

// ---------------------------------------------------------------------------------------------
// Toolchain helpers

function toolEnv() {
  const bin = process.env.IVERILOG_BIN ?? DEFAULT_IVERILOG_BIN;
  return { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}` };
}

function run(cmd: string, args: string[], cwd: string, timeoutMs = 300_000) {
  const r = spawnSync(cmd, args, { cwd, env: toolEnv(), encoding: "utf8", timeout: timeoutMs, maxBuffer: 1 << 28 });
  if (r.error) throw r.error;
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function toolVersion(): string {
  const r = spawnSync("iverilog", ["-V"], { env: toolEnv(), encoding: "utf8" });
  const line = (r.stdout ?? "").split(/\r?\n/)[0] ?? "";
  return line.trim() || "Icarus Verilog (version unknown)";
}

function withTimescale(src: string): string {
  return src.includes("`timescale") ? src : "`timescale 1ns/1ps\n" + src;
}

// ---------------------------------------------------------------------------------------------
// VCD → per-cycle samples

interface VcdVar {
  id: string;
  width: number;
  fullName: string;
}

/** Sample the listed signals at every rising edge of `clk` (value just before the edge's NBA). */
function sampleVcd(vcdText: string, clkName: string, wanted: string[]): { cycles: number; samples: Map<string, string[]>; edgeTimes: number[] } {
  const lines = vcdText.split(/\r?\n/);
  const scope: string[] = [];
  const vars = new Map<string, VcdVar[]>(); // id → vars (aliases share ids)
  let i = 0;
  // Header
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith("$scope")) {
      scope.push(l.split(/\s+/)[2]);
    } else if (l.startsWith("$upscope")) {
      scope.pop();
    } else if (l.startsWith("$var")) {
      const p = l.split(/\s+/);
      const width = Number(p[2]);
      const id = p[3];
      const name = p[4];
      const fullName = [...scope, name].join(".");
      const arr = vars.get(id) ?? [];
      arr.push({ id, width, fullName });
      vars.set(id, arr);
    } else if (l.startsWith("$enddefinitions")) {
      i++;
      break;
    }
  }
  const nameToId = new Map<string, string>();
  for (const [id, list] of vars) for (const v of list) nameToId.set(v.fullName, id);
  const clkId = nameToId.get(clkName);
  if (!clkId) throw new Error(`clk ${clkName} not in VCD`);
  const wantedIds = new Map<string, string>();
  for (const w of wanted) {
    const id = nameToId.get(w);
    if (!id) throw new Error(`signal ${w} not in VCD`);
    wantedIds.set(w, id);
  }

  const current = new Map<string, string>();
  for (const id of vars.keys()) current.set(id, "x");
  const samples = new Map<string, string[]>();
  for (const w of wanted) samples.set(w, []);
  const edgeTimes: number[] = [];
  let clkPrev = "0";
  let cycles = 0;

  // Icarus writes every change of a time step under one "#t" line, with registers updated
  // by that edge's non-blocking assignments listed BEFORE the clock's own 0→1 line. The
  // testbench samples pre-edge values (its own always @(posedge clk) reads happen before
  // the NBA region), so we snapshot the wanted signals at the start of each time step and
  // record that snapshot when the step contains a rising clock edge.
  const wantedList = [...wantedIds.entries()];
  let snapshot: string[] = wantedList.map(() => "x");
  const takeSnapshot = () => {
    snapshot = wantedList.map(([, sid]) => current.get(sid) ?? "x");
  };

  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const c = l[0];
    if (c === "#") {
      takeSnapshot();
    } else if (c === "b" || c === "B") {
      const sp = l.indexOf(" ");
      const val = l.slice(1, sp);
      const id = l.slice(sp + 1);
      current.set(id, val);
    } else if (c === "0" || c === "1" || c === "x" || c === "z" || c === "X" || c === "Z") {
      const id = l.slice(1);
      const val = c.toLowerCase();
      if (id === clkId) {
        if (clkPrev === "0" && val === "1") {
          wantedList.forEach(([w], k) => samples.get(w)!.push(snapshot[k]));
          edgeTimes.push(cycles);
          cycles++;
        }
        clkPrev = val;
      }
      current.set(id, val);
    }
  }
  return { cycles, samples, edgeTimes };
}

function binToInt(b: string): number | null {
  if (/[xz]/i.test(b)) return null;
  return parseInt(b, 2);
}

function splitFlat(b: string, width: number, count: number): (number | null)[] {
  const padded = b.padStart(width * count, b[0] === "1" ? "0" : b[0] === "x" ? "x" : "0");
  const out: (number | null)[] = [];
  for (let k = 0; k < count; k++) {
    const slice = padded.slice(padded.length - (k + 1) * width, padded.length - k * width);
    out.push(binToInt(slice));
  }
  return out; // index 0 = least significant field (path_cost[0])
}

// ---------------------------------------------------------------------------------------------
// Viterbi

interface PresetResult {
  id: string;
  label: string;
  params: Omit<Preset, "id" | "label">;
  status: "pass" | "fail" | "error";
  good: number;
  bad: number;
  corrupted: number;
  badIndices: number[];
  wallMs: number;
  /** Per-cycle samples in the kept windows. */
  windows: {
    id: string;
    from: number;
    signals: Record<string, (number | null)[]>;
    pathCost: (number | null)[][];
  }[];
  /** The scored message: input bit j vs decoded bit j (tb indices 0..255). */
  inputBits: number[];
  decodedBits: number[];
  /** Channel symbol seen by the decoder at input cycle j (post error injection), and whether an error hit it. */
  rxSymbols: number[];
  errHits: number[];
}

function runViterbi(ctx: PrepContext, workDir: string, preset: Preset): PresetResult {
  const src = path.join(ctx.rawRoot, "verilog_src", "viterbi");
  const runDir = path.join(workDir, `viterbi_${preset.id}`);
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.mkdirSync(runDir, { recursive: true });

  const rtl = ["viterbi_tx_rx_2a1.sv", "encoder.sv", "decoder.sv", "ACS.sv", "bmc0.sv"];
  for (const f of rtl) fs.copyFileSync(path.join(src, f), path.join(runDir, f));

  let tb = fs.readFileSync(path.join(src, "viterbi_tx_rx_tb.sv"), "utf8");
  const inst = `viterbi_tx_rx #(.PERIOD(${preset.PERIOD}), .BURST(${preset.BURST}), .ERR_BIT0(1'b${preset.ERR_BIT0}), .ERR_BIT1(1'b${preset.ERR_BIT1}), .USE_RAND(1'b${preset.USE_RAND}), .ENABLE_ERR(1'b${preset.ENABLE_ERR})) vtr(`;
  if (!/^\s*viterbi_tx_rx vtr\(/m.test(tb)) throw new Error("testbench instantiation line not found");
  tb = tb.replace(/^\s*viterbi_tx_rx vtr\(/m, "  " + inst);
  tb = tb.replace(/\$stop;/g, "$finish;");
  const dumpList = ["viterbi_tx_rx_tb.clk", ...WAVE_SIGNALS.map((s) => s.vcd)].join(", ");
  tb = tb.replace(/\$dumpfile\("dump.vcd"\);\s*\$dumpvars;/, `$dumpfile("dump.vcd"); $dumpvars(0, ${dumpList});`);
  fs.writeFileSync(path.join(runDir, "tb.sv"), withTimescale(tb));

  const t0 = Date.now();
  const comp = run("iverilog", ["-g2012", "-o", "sim.vvp", "tb.sv", ...rtl], runDir);
  if (comp.code !== 0) {
    ctx.log(`iverilog failed for ${preset.id}:\n${comp.stderr}`);
    return errorResult(preset, `compile failed: ${comp.stderr.split("\n")[0]}`);
  }
  const sim = run("vvp", ["-n", "sim.vvp"], runDir);
  const wallMs = Date.now() - t0;
  const out = sim.stdout;
  const m = out.match(/corrupted_bits\s*=\s*(\d+),\s*OUT:\s*good\s*=\s*(\d+),\s*bad\s*=\s*(\d+)/);
  if (!m) {
    ctx.log(`no scoreboard for ${preset.id}: ${sim.stderr}`);
    return errorResult(preset, "no scoreboard in output");
  }
  const badIndices = [...out.matchAll(/boo! in = [01], out = [01], w_ct =\s*(\d+)/g)].map((x) => Number(x[1]));

  const vcd = fs.readFileSync(path.join(runDir, "dump.vcd"), "utf8");
  const { samples } = sampleVcd(vcd, "viterbi_tx_rx_tb.clk", WAVE_SIGNALS.map((s) => s.vcd));
  const byName = (n: string) => samples.get(WAVE_SIGNALS.find((s) => s.name === n)!.vcd)!;

  const windows = WINDOWS.map((w) => {
    const signals: Record<string, (number | null)[]> = {};
    for (const s of WAVE_SIGNALS) {
      if (s.name === "path_cost") continue;
      signals[s.name] = byName(s.name).slice(w.from, w.to).map(binToInt);
    }
    const pathCost = byName("path_cost")
      .slice(w.from, w.to)
      .map((b) => splitFlat(b, 8, 8));
    return { id: w.id, from: w.from, signals, pathCost };
  });

  // Scored message: tb records enc_i_hist[j] at posedge j and dec_o_hist[j] at posedge 4105+j.
  const enc = byName("encoder_i");
  const dec = byName("decoder_o");
  const OUT_OFFSET = 4105;
  const inputBits: number[] = [];
  const decodedBits: number[] = [];
  for (let j = 0; j < 256; j++) {
    inputBits.push(binToInt(enc[j]) ?? 0);
    decodedBits.push(binToInt(dec[OUT_OFFSET + j]) ?? 0);
  }
  // Symbol for input bit j is produced combinationally in cycle j (encoder_o), registered
  // through the channel into encoder_o_reg at cycle j+1 along with err_inj.
  const rxReg = byName("encoder_o_reg");
  const err = byName("err_inj");
  const rxSymbols: number[] = [];
  const errHits: number[] = [];
  for (let j = 0; j < 300; j++) {
    rxSymbols.push(binToInt(rxReg[j + 1] ?? "0") ?? 0);
    errHits.push(binToInt(err[j + 1] ?? "0") ?? 0);
  }

  const good = Number(m[2]);
  const bad = Number(m[3]);
  return {
    id: preset.id,
    label: preset.label,
    params: stripPreset(preset),
    status: bad === 0 ? "pass" : "fail",
    good,
    bad,
    corrupted: Number(m[1]),
    badIndices,
    wallMs,
    windows,
    inputBits,
    decodedBits,
    rxSymbols,
    errHits,
  };
}

function stripPreset(p: Preset): Omit<Preset, "id" | "label"> {
  const { id: _id, label: _label, ...rest } = p;
  return rest;
}

function errorResult(preset: Preset, why: string): PresetResult {
  return {
    id: preset.id,
    label: `${preset.label} (${why})`,
    params: stripPreset(preset),
    status: "error",
    good: 0,
    bad: 0,
    corrupted: 0,
    badIndices: [],
    wallMs: 0,
    windows: [],
    inputBits: [],
    decodedBits: [],
    rxSymbols: [],
    errHits: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Module shelf benches

interface BenchSpec {
  id: string;
  title: string;
  hw: string;
  files: string[];
  top?: string;
  check?: { mustMatch?: string; mustNotMatch?: string; expectFile?: string };
}

interface BenchResult {
  id: string;
  title: string;
  hw: string;
  status: "pass" | "fail" | "error";
  summary: string;
  wallMs: number;
}

function normalizeWs(s: string): string {
  return s
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function runBench(ctx: PrepContext, workDir: string, libDir: string, b: BenchSpec): BenchResult {
  const runDir = path.join(workDir, `lib_${b.id}`);
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.mkdirSync(runDir, { recursive: true });
  const local: string[] = [];
  for (const f of b.files) {
    const src = path.join(libDir, f);
    let text = fs.readFileSync(src, "utf8").replace(/\$stop\b/g, "$finish");
    text = withTimescale(text);
    const name = f.replace(/[\\/]/g, "__");
    fs.writeFileSync(path.join(runDir, name), text);
    local.push(name);
  }
  const t0 = Date.now();
  const args = ["-g2012", "-o", "sim.vvp"];
  if (b.top) args.push("-s", b.top);
  const comp = run("iverilog", [...args, ...local], runDir);
  if (comp.code !== 0) {
    return { id: b.id, title: b.title, hw: b.hw, status: "error", summary: `compile: ${comp.stderr.trim().split("\n")[0]}`, wallMs: Date.now() - t0 };
  }
  const sim = run("vvp", ["-n", "sim.vvp"], runDir, 60_000);
  const wallMs = Date.now() - t0;
  let text = sim.stdout + "\n" + sim.stderr;
  const written = fs.readdirSync(runDir).filter((f) => f.endsWith(".txt"));
  for (const f of written) text += "\n" + fs.readFileSync(path.join(runDir, f), "utf8");
  if (sim.code !== 0 && !/\$finish/.test(text)) {
    return { id: b.id, title: b.title, hw: b.hw, status: "error", summary: `vvp exit ${sim.code}`, wallMs };
  }

  const reasons: string[] = [];
  const c = b.check ?? {};
  if (c.mustMatch && !new RegExp(c.mustMatch, "m").test(text)) reasons.push(`expected /${c.mustMatch}/`);
  if (c.mustNotMatch && new RegExp(c.mustNotMatch, "m").test(text)) reasons.push(`found /${c.mustNotMatch}/`);
  if (c.expectFile) {
    const expected = normalizeWs(fs.readFileSync(path.join(libDir, c.expectFile), "utf8"));
    const produced = written.map((f) => normalizeWs(fs.readFileSync(path.join(runDir, f), "utf8")));
    const stdoutNorm = normalizeWs(sim.stdout);
    if (!produced.some((p) => p === expected) && stdoutNorm !== expected && !stdoutNorm.includes(expected)) {
      reasons.push(`output differs from ${c.expectFile}`);
    }
  }
  const status = reasons.length ? "fail" : "pass";
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("VCD info")).length;
  return {
    id: b.id,
    title: b.title,
    hw: b.hw,
    status,
    summary: status === "pass" ? `passed (${lines} lines of output, ${wallMs} ms)` : reasons.join("; "),
    wallMs,
  };
}

function copyLibSources(libDir: string, outDir: string) {
  const dest = path.join(outDir, "lib-src");
  fs.rmSync(dest, { recursive: true, force: true });
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(sv|v)$/i.test(e.name)) {
        const rel = path.relative(libDir, p);
        const target = path.join(dest, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(p, target);
      }
    }
  };
  if (fs.existsSync(libDir)) walk(libDir);
}

// ---------------------------------------------------------------------------------------------

export default async function runPrep(ctx: PrepContext): Promise<void> {
  const workDir = path.join(os.tmpdir(), "davids-internet-verilog-sim");
  fs.mkdirSync(workDir, { recursive: true });
  const tool = toolVersion();
  ctx.log(`toolchain: ${tool}`);

  // 1. Viterbi
  const only = process.env.VERILOG_PRESETS?.split(",").filter(Boolean);
  const results: PresetResult[] = [];
  for (const p of PRESETS) {
    if (only && !only.includes(p.id)) continue;
    const r = runViterbi(ctx, workDir, p);
    if (p.id.startsWith("sweep")) {
      // The sweep only feeds the pass/fail table — drop the per-cycle payload to keep the JSON small.
      r.windows = [];
      r.inputBits = [];
      r.decodedBits = [];
      r.rxSymbols = [];
      r.errHits = [];
    }
    ctx.log(`${p.id.padEnd(10)} ${r.status.padEnd(5)} good=${r.good} bad=${r.bad} corrupted=${r.corrupted} (${r.wallMs} ms)`);
    results.push(r);
  }
  const viterbiOut = {
    generatedAt: new Date().toISOString(),
    tool,
    clockNs: CLK_NS,
    outputOffsetCycles: 4105,
    windows: WINDOWS,
    presets: results,
  };
  fs.writeFileSync(path.join(ctx.outDir, "viterbi.json"), JSON.stringify(viterbiOut));
  // The working-copy RTL, served as plain text for the "RTL beside the animation" pane.
  const vsrcOut = path.join(ctx.outDir, "viterbi-src");
  fs.mkdirSync(vsrcOut, { recursive: true });
  for (const f of fs.readdirSync(path.join(ctx.rawRoot, "verilog_src", "viterbi"))) {
    if (f.endsWith(".sv")) fs.copyFileSync(path.join(ctx.rawRoot, "verilog_src", "viterbi", f), path.join(vsrcOut, f));
  }
  const kb = Math.round(fs.statSync(path.join(ctx.outDir, "viterbi.json")).size / 1024);
  ctx.log(`viterbi.json: ${results.length} presets, ${kb} KB`);

  // 2. Module shelf
  const libDir = path.join(ctx.rawRoot, "verilog_src", "lib");
  const benchFile = path.join(libDir, "benches.json");
  if (process.env.VERILOG_SKIP_BENCHES) {
    ctx.log("VERILOG_SKIP_BENCHES set — skipping module benches");
    return;
  }
  if (!fs.existsSync(benchFile)) {
    ctx.log("no demos/verilog_src/lib/benches.json yet — skipping module benches");
    return;
  }
  const specs = JSON.parse(fs.readFileSync(benchFile, "utf8")) as BenchSpec[];
  const benches: BenchResult[] = [];
  for (const b of specs) {
    const r = runBench(ctx, workDir, libDir, b);
    ctx.log(`${b.id.padEnd(12)} ${r.status.padEnd(5)} ${r.summary}`);
    benches.push(r);
  }
  fs.writeFileSync(
    path.join(ctx.outDir, "benches.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), tool, benches }, null, 1),
  );
  copyLibSources(libDir, ctx.outDir);
  ctx.log(`benches.json: ${benches.filter((b) => b.status === "pass").length}/${benches.length} pass`);
}
