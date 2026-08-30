/**
 * Nocturnal Neuro demo prep — turns the KiCad project, the DigiKey order, the EEG recording
 * and the business canvases into the small assets the page ships.
 *
 *   pnpm sync-demos nocturnal
 *
 * 1. PCB layers: kicad-cli renders each copper/mask/silk layer of Ganglion_PCB.kicad_pcb to
 *    SVG (board-area page, no drill marks); the SVGs are simplified (invisible <text> and
 *    <desc> removed, stroke-font segments merged into polylines, 2-decimal precision, colors
 *    stripped so CSS can tint each layer) → pcb/<layer>.svg
 * 2. Footprints: a small s-expression pass over the .kicad_pcb collects every footprint's
 *    reference, value, layer, position and pad extent → pcb/footprints.json (hover hit-areas)
 * 3. Drills: the Excellon files → pcb/drills.json
 * 4. Schematics: kicad-cli sch export svg (all four sheets), simplified with colors kept
 *    → sch/<sheet>.svg + sch/sheets.json
 * 5. BOM: Ganglion_01_BOM_CSV.csv (David's substitution notes) merged with the DigiKey order
 *    → bom.json
 * 6. Everything numeric/binary (EEG re-encode, test fixture, order xlsx, PDF rasters, symbol
 *    positions) runs in scripts/demos/nocturnal_prep.py (py -3.12: numpy/scipy/pypdfium2).
 *
 * Needs kicad-cli (KICAD_CLI to override the default path) and `py -3.12`. Outputs are
 * committed so builds elsewhere need neither.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { PrepContext } from "../sync-demos";

const DEFAULT_KICAD_CLI = "C:\\Program Files\\KiCad\\8.0\\bin\\kicad-cli.exe";

const PCB_LAYERS: { id: string; kicad: string; label: string; side: "top" | "inner" | "bottom" }[] = [
  { id: "f-silk", kicad: "F.SilkS", label: "F.Silkscreen", side: "top" },
  { id: "f-mask", kicad: "F.Mask", label: "F.Mask", side: "top" },
  { id: "f-cu", kicad: "F.Cu", label: "F.Cu", side: "top" },
  { id: "in1-cu", kicad: "In1.Cu", label: "In1.Cu", side: "inner" },
  { id: "in2-cu", kicad: "In2.Cu", label: "In2.Cu", side: "inner" },
  { id: "b-cu", kicad: "B.Cu", label: "B.Cu", side: "bottom" },
  { id: "b-mask", kicad: "B.Mask", label: "B.Mask", side: "bottom" },
  { id: "b-silk", kicad: "B.SilkS", label: "B.Silkscreen", side: "bottom" },
  { id: "edge", kicad: "Edge.Cuts", label: "Edge.Cuts", side: "inner" },
];

const SCH_SHEETS: { key: string; kicadName: string; title: string; file: string }[] = [
  { key: "root", kicadName: "Ganglion_PCB", title: "Ganglion — main sheet", file: "Ganglion_PCB.kicad_sch" },
  { key: "references", kicadName: "Ganglion_PCB-INPUT_V_REF", title: "Input voltage references", file: "References.kicad_sch" },
  { key: "tvs", kicadName: "Ganglion_PCB-INPUT_PROTECTION", title: "Input protection (TVS)", file: "TVS.kicad_sch" },
  { key: "sensors", kicadName: "Ganglion_PCB-SENSORS", title: "Sensors & switches", file: "Ganglion_Sensors_01.kicad_sch" },
];

// ------------------------------------------------------------------ helpers

function exec(cmd: string, args: string[], cwd: string, log: (m: string) => void) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    log(`${path.basename(cmd)} ${args.join(" ")}\n${r.stdout}\n${r.stderr}`);
    throw new Error(`${path.basename(cmd)} failed (${r.status})`);
  }
  return r.stdout;
}

const num = (s: string) => {
  const v = Number(s);
  return Math.abs(v) < 5e-3 ? "0" : String(Math.round(v * 100) / 100);
};

/** Parse KiCad's `style="a:b; c:d"` into a map. */
function parseStyle(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of style.split(";")) {
    const i = part.indexOf(":");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/**
 * Simplify a kicad-cli SVG. keepColors=false strips fills/strokes (the page tints the
 * layer via CSS `currentColor`); fill="none" survives so stroked tracks stay strokes.
 */
function simplifySvg(svg: string, keepColors: boolean): { svg: string; viewBox: string } {
  const vb = /viewBox="([^"]+)"/.exec(svg);
  const viewBox = vb ? vb[1].split(/\s+/).map((v) => num(v)).join(" ") : "0 0 100 100";
  let body = svg.slice(svg.indexOf(">", svg.indexOf("<svg")) + 1, svg.lastIndexOf("</svg>"));
  body = body
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace(/<desc>[\s\S]*?<\/desc>/g, "")
    .replace(/<text\b[\s\S]*?<\/text>/g, "");

  // style="" → attributes
  body = body.replace(/<(g|path|circle|rect|polyline|polygon)\b([^>]*?)style="([^"]*)"([^>]*)>/g, (_m, tag, pre, style, post) => {
    const st = parseStyle(style.replace(/\s+/g, " "));
    const attrs: string[] = [];
    if (st.fill === "none") attrs.push('fill="none"');
    else if (keepColors && st.fill) attrs.push(`fill="${st.fill}"`);
    if (st.stroke === "none") attrs.push('stroke="none"');
    else if (keepColors && st.stroke) attrs.push(`stroke="${st.stroke}"`);
    if (st["stroke-width"]) attrs.push(`stroke-width="${num(st["stroke-width"])}"`);
    if (st["fill-rule"]) attrs.push(`fill-rule="${st["fill-rule"]}"`);
    if (st["fill-opacity"] && Number(st["fill-opacity"]) < 1) attrs.push(`fill-opacity="${num(st["fill-opacity"])}"`);
    if (st["stroke-opacity"] && Number(st["stroke-opacity"]) < 1) attrs.push(`stroke-opacity="${num(st["stroke-opacity"])}"`);
    return `<${tag}${pre}${attrs.length ? " " + attrs.join(" ") : ""}${post}>`;
  });
  body = body.replace(/ transform="translate\(0 0\) scale\(1 1\)"/g, "");
  body = body.replace(/ class="stroked-text"/g, "");

  // Merge chains of single segments: <path d="M a b\nL c d\n" /> <path d="M c d\nL e f\n" /> → one polyline path.
  const segRe = /<path d="M\s*([-\d.]+)[ ,]([-\d.]+)\s*L\s*([-\d.]+)[ ,]([-\d.]+)\s*"\s*\/>/g;
  const tokens: string[] = [];
  let last = 0;
  let chain: { pts: string[]; end: string } | null = null;
  const flush = () => {
    if (chain) tokens.push(`<path d="M${chain.pts.join("L")}"/>`);
    chain = null;
  };
  let m: RegExpExecArray | null;
  while ((m = segRe.exec(body))) {
    const between = body.slice(last, m.index);
    if (between.trim()) {
      flush();
      tokens.push(between);
    }
    const a = `${num(m[1])} ${num(m[2])}`;
    const b = `${num(m[3])} ${num(m[4])}`;
    if (chain && chain.end === a) {
      chain.pts.push(b);
      chain.end = b;
    } else {
      flush();
      chain = { pts: [a, b], end: b };
    }
    last = m.index + m[0].length;
  }
  flush();
  tokens.push(body.slice(last));
  body = tokens.join("");

  // Remaining numbers → 2 decimals; whitespace inside path data compacted.
  body = body.replace(/d="([^"]*)"/g, (_m, d: string) => {
    const compact = d
      .replace(/\s+/g, " ")
      .replace(/-?\d*\.?\d+(?:e-?\d+)?/g, (n) => num(n))
      .replace(/ ?([MLCQAZmlcqaz]) ?/g, "$1")
      .trim();
    return `d="${compact}"`;
  });
  body = body.replace(/(cx|cy|r|x|y|width|height|x1|y1|x2|y2)="([-\d.e]+)"/g, (_m, k, v) => `${k}="${num(v)}"`);
  body = body.replace(/transform="rotate\(([-\d.]+) ([-\d.]+) ([-\d.]+)\)"/g, (_m, a, x, y) => `transform="rotate(${num(a)} ${num(x)} ${num(y)})"`);
  // Empty groups and leftover whitespace
  for (let i = 0; i < 4; i++) body = body.replace(/<g(?: [^>]*)?>\s*<\/g>/g, "");
  body = body.replace(/\n\s*/g, "\n").replace(/\n+/g, "\n").trim();

  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n${body}\n</svg>\n`, viewBox };
}

// ------------------------------------------------------------------ .kicad_pcb

/** Yield the text of every top-level `(<head> …)` block (paren matched, string aware). */
function* sexprBlocks(text: string, head: string): Generator<string> {
  const needle = `\n\t(${head}`;
  let i = 0;
  for (;;) {
    let j = text.indexOf(needle, i);
    while (j >= 0 && !/[\s(]/.test(text[j + needle.length])) j = text.indexOf(needle, j + 1);
    if (j < 0) return;
    let k = j + 2;
    let depth = 0;
    let inStr = false;
    for (;;) {
      const c = text[k];
      if (inStr) {
        if (c === "\\") k++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) break;
      }
      k++;
    }
    yield text.slice(j + 2, k + 1);
    i = k;
  }
}

interface Footprint {
  ref: string;
  value: string;
  lib: string;
  layer: "F.Cu" | "B.Cu";
  /** centre in SVG (board-area page) mm */
  x: number;
  y: number;
  rot: number;
  /** axis-aligned pad extent in SVG mm */
  w: number;
  h: number;
  pads: number;
}

function parsePcb(pcbText: string, log: (m: string) => void) {
  // Board outline extent from Edge.Cuts graphics → the origin kicad-cli uses for page-size-mode 2.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const take = (x: number, y: number, r = 0) => {
    minX = Math.min(minX, x - r);
    minY = Math.min(minY, y - r);
    maxX = Math.max(maxX, x + r);
    maxY = Math.max(maxY, y + r);
  };
  let edgeWidth = 0.15;
  for (const head of ["gr_line", "gr_arc", "gr_circle", "gr_rect", "gr_poly"]) {
    for (const blk of sexprBlocks(pcbText, head)) {
      if (!/\(layer "Edge\.Cuts"\)/.test(blk)) continue;
      const w = /\(width ([\d.]+)\)/.exec(blk);
      if (w) edgeWidth = Number(w[1]);
      if (head === "gr_circle") {
        const c = /\(center ([-\d.]+) ([-\d.]+)\)\s*\(end ([-\d.]+) ([-\d.]+)\)/.exec(blk);
        if (c) {
          const r = Math.hypot(Number(c[3]) - Number(c[1]), Number(c[4]) - Number(c[2]));
          take(Number(c[1]), Number(c[2]), r);
        }
        continue;
      }
      for (const p of blk.matchAll(/\((?:start|end|mid|xy) ([-\d.]+) ([-\d.]+)\)/g)) take(Number(p[1]), Number(p[2]));
    }
  }
  const half = edgeWidth / 2;
  const origin = { x: minX - half, y: minY - half };
  const size = { w: maxX - minX + edgeWidth, h: maxY - minY + edgeWidth };

  const footprints: Footprint[] = [];
  for (const blk of sexprBlocks(pcbText, "footprint")) {
    const lib = /^\(footprint "([^"]+)"/.exec(blk)?.[1] ?? "";
    const layer = (/\(layer "([^"]+)"\)/.exec(blk)?.[1] ?? "F.Cu") as "F.Cu" | "B.Cu";
    const at = /\n\t\t\(at ([-\d.]+) ([-\d.]+)(?: ([-\d.]+))?\)/.exec(blk);
    const ref = /\(property "Reference" "([^"]*)"/.exec(blk)?.[1] ?? "";
    const value = /\(property "Value" "([^"]*)"/.exec(blk)?.[1] ?? "";
    if (!at || !ref || ref.startsWith("G")) continue; // G*** = logo
    const fx = Number(at[1]);
    const fy = Number(at[2]);
    const rot = Number(at[3] ?? 0);
    const rad = (rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    let px0 = Infinity;
    let py0 = Infinity;
    let px1 = -Infinity;
    let py1 = -Infinity;
    let pads = 0;
    for (const pad of blk.matchAll(/\(pad "[^"]*" \w+ \w+\s*\(at ([-\d.]+) ([-\d.]+)(?: ([-\d.]+))?\)\s*\(size ([-\d.]+) ([-\d.]+)\)/g)) {
      pads++;
      const lx = Number(pad[1]);
      const ly = Number(pad[2]);
      const sw = Number(pad[4]);
      const sh = Number(pad[5]);
      // KiCad: footprint rotation is counter-clockwise with Y down → (x cos + y sin, −x sin + y cos)
      const gx = fx + lx * cos + ly * sin;
      const gy = fy - lx * sin + ly * cos;
      const r = Math.max(sw, sh) / 2;
      px0 = Math.min(px0, gx - r);
      py0 = Math.min(py0, gy - r);
      px1 = Math.max(px1, gx + r);
      py1 = Math.max(py1, gy + r);
    }
    if (!pads) {
      px0 = fx - 1;
      py0 = fy - 1;
      px1 = fx + 1;
      py1 = fy + 1;
    }
    footprints.push({
      ref,
      value,
      lib,
      layer,
      x: Math.round(((px0 + px1) / 2 - origin.x) * 1000) / 1000,
      y: Math.round(((py0 + py1) / 2 - origin.y) * 1000) / 1000,
      rot,
      w: Math.round((px1 - px0) * 1000) / 1000,
      h: Math.round((py1 - py0) * 1000) / 1000,
      pads,
    });
  }
  const aux = /\(aux_axis_origin ([-\d.]+) ([-\d.]+)\)/.exec(pcbText);
  log(`pcb: ${footprints.length} footprints, board ${size.w.toFixed(2)} × ${size.h.toFixed(2)} mm, origin (${origin.x.toFixed(3)}, ${origin.y.toFixed(3)})`);
  return { origin, size, footprints, aux: aux ? { x: Number(aux[1]), y: Number(aux[2]) } : origin };
}

function parseDrill(text: string, aux: { x: number; y: number }, origin: { x: number; y: number }, plated: boolean) {
  const tools: Record<string, number> = {};
  const holes: { x: number; y: number; d: number; plated: boolean }[] = [];
  let tool = "";
  for (const line of text.split(/\r?\n/)) {
    const def = /^T(\d+)C([\d.]+)/.exec(line);
    if (def) {
      tools[def[1]] = Number(def[2]);
      continue;
    }
    const sel = /^T(\d+)$/.exec(line);
    if (sel) {
      tool = sel[1];
      continue;
    }
    const xy = /^X([-\d.]+)Y([-\d.]+)/.exec(line);
    if (xy && tool) {
      // Excellon with aux origin: X right, Y up, relative to aux_axis_origin.
      const x = aux.x + Number(xy[1]) - origin.x;
      const y = aux.y - Number(xy[2]) - origin.y;
      holes.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, d: tools[tool], plated });
    }
  }
  return holes;
}

// ------------------------------------------------------------------ BOM

interface BomRow {
  item: number;
  refs: string[];
  value: string;
  thing: string;
  mpn: string;
  manufacturer: string;
  footprint: string;
  qty: number;
  status: "asIs" | "substituted" | "notFound";
  substitute?: { mpn: string; manufacturer: string; reason: string; description: string };
  order?: { line: number; qty: number; digikey: string; mpn: string; description: string; unit: number; extended: number };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const normMpn = (s: string) =>
  s
    .toUpperCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^A-Z0-9]/g, "");

function buildBom(csvText: string, order: { lines: BomRow["order"][] }, log: (m: string) => void): BomRow[] {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, "")).filter((r) => /^\d+$/.test(r[0] ?? ""));
  const orderByMpn = new Map<string, NonNullable<BomRow["order"]>>();
  for (const l of order.lines) if (l) orderByMpn.set(normMpn(l.mpn), l);
  const bom: BomRow[] = [];
  for (const r of rows) {
    const [item, refs, value, thing, mpn, manufacturer, footprint, qty, flag, subMpn, subMfr1, subMfr2, reason, , desc1, desc2] = r;
    const substituteMpn = (subMpn ?? "").trim();
    const isHeaderNote = /^Replacements/i.test(substituteMpn);
    const row: BomRow = {
      item: Number(item),
      refs: refs
        .replace(/([A-Z]+\d+)(?=[A-Z])/g, "$1 ")
        .split(/\s+/)
        .filter(Boolean),
      value,
      thing,
      mpn,
      manufacturer,
      footprint,
      qty: Number(qty),
      status: "asIs",
    };
    if (/not found/i.test(flag ?? "")) row.status = "notFound";
    if (substituteMpn && !isHeaderNote) {
      row.status = "substituted";
      row.substitute = {
        mpn: substituteMpn,
        manufacturer: (subMfr1 || subMfr2 || "").trim(),
        reason: (reason ?? "").trim() || (subMfr2 ?? "").trim(),
        description: (desc1 || desc2 || "").trim(),
      };
    }
    const key = normMpn(row.substitute?.mpn ?? mpn);
    let ord = orderByMpn.get(key);
    if (!ord) {
      // prefix match (e.g. "S2B-PH-SM4-TB(LF)(SN)" ↔ "S2B-PH-SM4-TB")
      for (const [k, v] of orderByMpn) if (key.startsWith(k) || k.startsWith(key)) ord = v;
    }
    if (ord) row.order = ord;
    else if (row.status !== "notFound") log(`bom: no DigiKey line for ${row.refs[0]} ${mpn}`);
    bom.push(row);
  }
  const matched = bom.filter((b) => b.order).length;
  log(`bom: ${bom.length} rows, ${bom.filter((b) => b.status === "substituted").length} substituted, ${matched} matched to the order`);
  return bom;
}

// ------------------------------------------------------------------ main

export default async function run(ctx: PrepContext) {
  const raw = path.join(ctx.rawRoot, "nocturnal_neuro_raw");
  const kdir = path.join(raw, "kicad_ganglion_pcb");
  const kicad = process.env.KICAD_CLI || DEFAULT_KICAD_CLI;
  const skipKicad = process.env.NOCTURNAL_SKIP_KICAD === "1";
  const pcbOut = path.join(ctx.outDir, "pcb");
  const schOut = path.join(ctx.outDir, "sch");
  fs.mkdirSync(pcbOut, { recursive: true });
  fs.mkdirSync(schOut, { recursive: true });
  const tmp = path.join(ctx.outDir, ".tmp");
  fs.mkdirSync(tmp, { recursive: true });

  // 1–3. PCB
  const pcbText = fs.readFileSync(path.join(kdir, "Ganglion_PCB.kicad_pcb"), "utf8");
  const board = parsePcb(pcbText, ctx.log);
  const layersOut: { id: string; label: string; side: string; file: string; bytes: number }[] = [];
  let viewBox = "";
  if (!skipKicad) {
    for (const layer of PCB_LAYERS) {
      const rawSvg = path.join(tmp, `${layer.id}.svg`);
      exec(
        kicad,
        ["pcb", "export", "svg", "--layers", layer.kicad, "--page-size-mode", "2", "--exclude-drawing-sheet", "--drill-shape-opt", "0", "-o", rawSvg, "Ganglion_PCB.kicad_pcb"],
        kdir,
        ctx.log,
      );
      const { svg, viewBox: vb } = simplifySvg(fs.readFileSync(rawSvg, "utf8"), false);
      viewBox = vb;
      const file = path.join(pcbOut, `${layer.id}.svg`);
      fs.writeFileSync(file, svg);
      layersOut.push({ id: layer.id, label: layer.label, side: layer.side, file: `pcb/${layer.id}.svg`, bytes: Buffer.byteLength(svg) });
      ctx.log(`pcb layer ${layer.kicad}: ${fs.statSync(rawSvg).size} → ${Buffer.byteLength(svg)} B`);
    }
  } else {
    const existing = JSON.parse(fs.readFileSync(path.join(pcbOut, "footprints.json"), "utf8"));
    viewBox = existing.viewBox;
    layersOut.push(...existing.layers);
  }
  const drills = [
    ...parseDrill(fs.readFileSync(path.join(kdir, "Ganglion BOM", "Ganglion_PCB-PTH.drl"), "utf8"), board.aux, board.origin, true),
    ...parseDrill(fs.readFileSync(path.join(kdir, "Ganglion BOM", "Ganglion_PCB-NPTH.drl"), "utf8"), board.aux, board.origin, false),
  ];
  fs.writeFileSync(
    path.join(pcbOut, "footprints.json"),
    JSON.stringify(
      {
        viewBox,
        board: { w: Math.round(board.size.w * 1000) / 1000, h: Math.round(board.size.h * 1000) / 1000, layers: 4, thicknessMm: 1.6 },
        layers: layersOut,
        footprints: board.footprints,
        drills,
      },
      null,
      0,
    ),
  );
  ctx.log(`pcb: ${drills.length} drill hits`);

  // 4. Schematics
  const sheetsOut: { key: string; title: string; file: string; viewBox: string; source: string; bytes: number }[] = [];
  if (!skipKicad) {
    exec(kicad, ["sch", "export", "svg", "-e", "-n", "-o", tmp, "Ganglion_PCB.kicad_sch"], kdir, ctx.log);
    for (const sheet of SCH_SHEETS) {
      const rawSvg = path.join(tmp, `${sheet.kicadName}.svg`);
      const { svg, viewBox: vb } = simplifySvg(fs.readFileSync(rawSvg, "utf8"), true);
      fs.writeFileSync(path.join(schOut, `${sheet.key}.svg`), svg);
      sheetsOut.push({ key: sheet.key, title: sheet.title, file: `sch/${sheet.key}.svg`, viewBox: vb, source: sheet.file, bytes: Buffer.byteLength(svg) });
      ctx.log(`sch ${sheet.key}: ${fs.statSync(rawSvg).size} → ${Buffer.byteLength(svg)} B`);
    }
    fs.writeFileSync(path.join(schOut, "sheets.json"), JSON.stringify(sheetsOut, null, 1));
  }

  // 6. Python half (EEG, fixture, order, canvases, symbols) — before the BOM merge needs order.json
  const py = spawnSync("py", ["-3.12", path.join(ctx.repoRoot, "scripts", "demos", "nocturnal_prep.py"), raw, ctx.outDir, ctx.repoRoot], {
    cwd: ctx.repoRoot,
    encoding: "utf8",
  });
  if (py.stdout) ctx.log(py.stdout.trim());
  if (py.status !== 0) {
    ctx.log(py.stderr);
    throw new Error("nocturnal_prep.py failed");
  }

  // 5. BOM
  const order = JSON.parse(fs.readFileSync(path.join(ctx.outDir, "order.json"), "utf8"));
  const bom = buildBom(fs.readFileSync(path.join(kdir, "Ganglion_01_BOM_CSV.csv"), "utf8"), order, ctx.log);
  fs.writeFileSync(path.join(ctx.outDir, "bom.json"), JSON.stringify({ rows: bom, orderTotal: order.total, currency: order.currency }, null, 0));

  fs.rmSync(tmp, { recursive: true, force: true });
  const total = walkSize(ctx.outDir);
  ctx.log(`total shipped: ${(total / 1024).toFixed(0)} KB`);
}

function walkSize(dir: string): number {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    n += e.isDirectory() ? walkSize(p) : fs.statSync(p).size;
  }
  return n;
}
