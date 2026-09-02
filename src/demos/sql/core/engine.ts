/**
 * Shared sql.js engine for the SQL Playground panels.
 *
 * sql.js (SQLite compiled to WASM) is loaded once, lazily, from
 * /demos/sql/sql-wasm.wasm; each panel opens its own in-memory copies of the
 * shipped .sqlite files so experiments never leak between panels. Running a
 * preset always executes against a FRESH copy unless the caller opts into a
 * persistent session (the modify panel does, with an explicit re-seed).
 */
import type { Database, SqlJsStatic } from "sql.js";

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

export function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = import("sql.js").then((mod) => {
      const init = (mod.default ?? mod) as unknown as (cfg: {
        locateFile: (f: string) => string;
      }) => Promise<SqlJsStatic>;
      return init({ locateFile: () => "/demos/sql/sql-wasm.wasm" });
    });
  }
  return sqlJsPromise;
}

const dbBytes = new Map<string, Promise<Uint8Array>>();

export function loadDbBytes(name: string): Promise<Uint8Array> {
  let p = dbBytes.get(name);
  if (!p) {
    p = fetch(`/demos/sql/db/${name}.sqlite`).then(async (r) => {
      if (!r.ok) throw new Error(`${name}.sqlite ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    dbBytes.set(name, p);
  }
  return p;
}

/** A fresh in-memory copy of the shipped database. Caller must .close() it. */
export async function openDb(name: string): Promise<Database> {
  const [SQL, bytes] = await Promise.all([loadSqlJs(), loadDbBytes(name)]);
  return new SQL.Database(bytes);
}

export interface RunResult {
  columns: string[];
  rows: unknown[][];
  /** Statements executed (a preset can be a small script). */
  statements: number;
  error?: string;
}

/**
 * Execute a (possibly multi-statement) SQL string; returns the LAST result
 * set, matching the fixture's semantics. Errors are returned, not thrown.
 */
export function runSql(db: Database, sql: string): RunResult {
  try {
    const results = db.exec(sql);
    const last = results.length ? results[results.length - 1] : null;
    return {
      columns: last ? last.columns : [],
      rows: last ? (last.values as unknown[][]) : [],
      statements: results.length,
    };
  } catch (e) {
    return { columns: [], rows: [], statements: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Snapshot a table's rows (for before/after diffs in the modify panel). */
export function tableRows(db: Database, table: string): { columns: string[]; rows: unknown[][] } {
  const res = db.exec(`SELECT * FROM "${table.replace(/"/g, '""')}"`);
  if (!res.length) return { columns: [], rows: [] };
  return { columns: res[0].columns, rows: res[0].values as unknown[][] };
}
