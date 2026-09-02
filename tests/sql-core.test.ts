/**
 * The SQL Playground's sql.js path must reproduce what Python's sqlite3
 * produced at build time (fixture from `pnpm sync-demos sql`): every preset,
 * run against the shipped .sqlite files, must return identical columns and
 * rows — and the presets that are SUPPOSED to error (the trigger demo) must
 * error in sql.js too.
 */
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import type { Database, SqlJsStatic } from "sql.js";

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public", "demos", "sql");

interface Preset {
  id: string;
  label: string;
  sql: string;
  expectError?: boolean;
}
interface FxResult {
  columns?: string[];
  rows?: unknown[][];
  rowCount?: number;
  error?: boolean;
}

const presetsJson = JSON.parse(fs.readFileSync(path.join(OUT, "presets.json"), "utf8")) as {
  order: string[];
  presets: Record<string, Preset[]>;
};
const fixture = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests", "fixtures", "sql-presets.json"), "utf8"),
) as Record<string, Record<string, FxResult>>;

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs({
    locateFile: (f: string) => path.join(ROOT, "node_modules", "sql.js", "dist", f),
  });
});

function openDb(name: string): Database {
  const bytes = fs.readFileSync(path.join(OUT, "db", `${name}.sqlite`));
  return new SQL.Database(new Uint8Array(bytes));
}

function runLast(db: Database, sql: string): { columns: string[]; rows: unknown[][] } {
  const results = db.exec(sql);
  const last = results.length ? results[results.length - 1] : null;
  return { columns: last ? last.columns : [], rows: last ? (last.values as unknown[][]) : [] };
}

function expectValue(actual: unknown, expected: unknown, where: string) {
  if (typeof actual === "number" && typeof expected === "number") {
    expect(actual, where).toBeCloseTo(expected, 9);
  } else {
    expect(actual, where).toEqual(expected);
  }
}

describe("sql.js reproduces the python sqlite3 fixture", () => {
  for (const dbName of presetsJson.order) {
    describe(dbName, () => {
      for (const preset of presetsJson.presets[dbName]) {
        it(`${preset.id}: ${preset.label}`, () => {
          const fx = fixture[dbName][preset.id];
          expect(fx, `fixture entry for ${preset.id}`).toBeDefined();
          const db = openDb(dbName);
          try {
            // replay semantics mirror the fixture: bikeshop presets build on
            // their predecessors; the trigger-tripping insert needs the trigger
            if (dbName === "bikeshop") {
              for (const prev of presetsJson.presets[dbName]) {
                if (prev.id === preset.id) break;
                db.exec(prev.sql);
              }
            }
            if (dbName === "busservice" && preset.id === "bus8") {
              db.exec(presetsJson.presets[dbName][6].sql);
            }
            if (fx.error) {
              expect(preset.expectError).toBe(true);
              expect(() => db.exec(preset.sql)).toThrow();
              return;
            }
            const { columns, rows } = runLast(db, preset.sql);
            expect(columns).toEqual(fx.columns);
            expect(rows.length).toBe(fx.rowCount);
            for (let r = 0; r < rows.length; r++) {
              for (let c = 0; c < columns.length; c++) {
                expectValue(rows[r][c], fx.rows![r][c], `${preset.id} row ${r} col ${columns[c]}`);
              }
            }
          } finally {
            db.close();
          }
        });
      }
    });
  }

  it("ships all six databases", () => {
    for (const dbName of presetsJson.order) {
      const db = openDb(dbName);
      const n = runLast(db, "select count(*) from sqlite_master where type='table'");
      expect(Number(n.rows[0][0])).toBeGreaterThan(0);
      db.close();
    }
  });
});
