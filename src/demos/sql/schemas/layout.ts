/**
 * Pure layout math for the schema graph. No DOM, no React — computes a
 * layered (DAG-style) grid of table boxes plus FK edge paths that connect
 * the exact column rows. Kept separate from SchemaPanel.tsx so the panel
 * component stays focused on data fetching + rendering.
 */

export interface SchemaTable {
  pk: string[];
  cols: string[];
}

export interface SchemaDb {
  title: string;
  origin: string;
  tables: Record<string, SchemaTable>;
  fks: [string, string][];
}

export interface SchemasData {
  order: string[];
  schemas: Record<string, SchemaDb>;
}

export interface RowLayout {
  col: string;
  isPk: boolean;
  isFk: boolean;
  /** Absolute y (svg units) of this row's vertical center. */
  y: number;
}

export interface BoxLayout {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rows: RowLayout[];
}

export interface EdgeLayout {
  key: string;
  fromTable: string;
  fromCol: string;
  toTable: string;
  toCol: string;
  path: string;
  /** Endpoint coordinates, for drawing highlighted column markers. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GraphLayout {
  boxes: BoxLayout[];
  edges: EdgeLayout[];
  width: number;
  height: number;
}

export const ROW_H = 20;
export const HEADER_H = 28;
export const BOX_W = 200;
const PAD = 24;
const GAP_X = 64;
const GAP_Y = 14;

function splitRef(ref: string): { table: string; col: string } {
  const i = ref.indexOf(".");
  if (i === -1) return { table: ref, col: "" };
  return { table: ref.slice(0, i), col: ref.slice(i + 1) };
}

/** depth(table) = 1 + max(depth(referenced tables)); 0 for tables with no outgoing FKs. */
function computeDepths(db: SchemaDb): Map<string, number> {
  const names = Object.keys(db.tables);
  const dependsOn = new Map<string, Set<string>>();
  for (const name of names) dependsOn.set(name, new Set());
  for (const [from, to] of db.fks) {
    const fromTable = splitRef(from).table;
    const toTable = splitRef(to).table;
    if (fromTable === toTable) continue;
    dependsOn.get(fromTable)?.add(toTable);
  }

  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  function d(name: string): number {
    const cached = depth.get(name);
    if (cached !== undefined) return cached;
    if (visiting.has(name)) return 0; // cycle guard
    visiting.add(name);
    let m = 0;
    for (const dep of dependsOn.get(name) ?? []) {
      m = Math.max(m, d(dep) + 1);
    }
    visiting.delete(name);
    depth.set(name, m);
    return m;
  }

  for (const name of names) d(name);
  return depth;
}

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, Math.abs(x1 - x2) / 2);
  const c1x = x1 <= x2 ? x1 + dx : x1 - dx;
  const c2x = x1 <= x2 ? x2 - dx : x2 + dx;
  return `M${x1},${y1} C${c1x},${y1} ${c2x},${y2} ${x2},${y2}`;
}

export function computeLayout(db: SchemaDb): GraphLayout {
  const names = Object.keys(db.tables);
  const depths = computeDepths(db);

  const layers = new Map<number, string[]>();
  for (const name of names) {
    const depth = depths.get(name) ?? 0;
    const bucket = layers.get(depth);
    if (bucket) bucket.push(name);
    else layers.set(depth, [name]);
  }
  const layerKeys = Array.from(layers.keys()).sort((a, b) => a - b);
  for (const k of layerKeys) layers.get(k)?.sort();

  // Per-layer FK-source-column set, for row markers.
  const fkCols = new Set<string>();
  for (const [from] of db.fks) fkCols.add(from);

  const boxes = new Map<string, BoxLayout>();
  let maxLayerHeight = 0;
  const layerHeights = new Map<number, number>();
  for (const k of layerKeys) {
    const tables = layers.get(k) ?? [];
    let total = 0;
    for (const name of tables) {
      const t = db.tables[name];
      const h = HEADER_H + t.cols.length * ROW_H;
      total += h;
    }
    total += Math.max(0, tables.length - 1) * GAP_Y;
    layerHeights.set(k, total);
    maxLayerHeight = Math.max(maxLayerHeight, total);
  }

  for (const k of layerKeys) {
    const tables = layers.get(k) ?? [];
    const x = PAD + k * (BOX_W + GAP_X);
    let y = PAD + (maxLayerHeight - (layerHeights.get(k) ?? 0)) / 2;
    for (const name of tables) {
      const t = db.tables[name];
      const height = HEADER_H + t.cols.length * ROW_H;
      const rows: RowLayout[] = t.cols.map((col, i) => ({
        col,
        isPk: t.pk.includes(col),
        isFk: fkCols.has(`${name}.${col}`),
        y: y + HEADER_H + i * ROW_H + ROW_H / 2,
      }));
      boxes.set(name, { name, x, y, width: BOX_W, height, rows });
      y += height + GAP_Y;
    }
  }

  const edges: EdgeLayout[] = [];
  for (const [from, to] of db.fks) {
    const fromRef = splitRef(from);
    const toRef = splitRef(to);
    const fromBox = boxes.get(fromRef.table);
    const toBox = boxes.get(toRef.table);
    if (!fromBox || !toBox) continue;
    const fromRow = fromBox.rows.find((r) => r.col === fromRef.col);
    const toRow = toBox.rows.find((r) => r.col === toRef.col);
    const fy = fromRow ? fromRow.y : fromBox.y + fromBox.height / 2;
    const ty = toRow ? toRow.y : toBox.y + toBox.height / 2;

    // Connect the two nearest edges: the leftward box exits via its right
    // side, the rightward box is entered via its left side. Same-column
    // (cycle-guard) fallback bulges out to the right of both.
    let x1: number;
    let x2: number;
    if (fromBox.x < toBox.x) {
      x1 = fromBox.x + fromBox.width;
      x2 = toBox.x;
    } else if (fromBox.x > toBox.x) {
      x1 = fromBox.x;
      x2 = toBox.x + toBox.width;
    } else {
      x1 = fromBox.x + fromBox.width;
      x2 = toBox.x + toBox.width;
    }

    edges.push({
      key: `${from}->${to}`,
      fromTable: fromRef.table,
      fromCol: fromRef.col,
      toTable: toRef.table,
      toCol: toRef.col,
      path: edgePath(x1, fy, x2, ty),
      x1,
      y1: fy,
      x2,
      y2: ty,
    });
  }

  const layerCount = Math.max(1, layerKeys.length);
  const width = PAD * 2 + layerCount * BOX_W + Math.max(0, layerCount - 1) * GAP_X;
  const height = PAD * 2 + maxLayerHeight;

  return { boxes: Array.from(boxes.values()), edges, width, height };
}
