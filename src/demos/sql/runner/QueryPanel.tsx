"use client";

/**
 * #queries — the query runner. Prefix qQ.
 *
 * Picks a course database, runs a preset (or free-typed SQL) against a
 * per-db session copy of the sql.js database, and shows the result plus
 * the tables the query touched. The session persists across runs so a
 * trigger installed by one preset (bus7) is still there for the next one
 * (bus8) - "reset session" reopens a fresh copy.
 */
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import type { Database } from "sql.js";
import "./runner.css";
import { openDb, runSql } from "../core/engine";
import type { RunResult } from "../core/engine";

interface PresetItem {
  id: string;
  label: string;
  sql: string;
  original?: string;
  note?: string;
  expectError?: boolean;
}

interface PresetsFile {
  order: string[];
  presets: Record<string, PresetItem[]>;
}

interface TableSchema {
  pk: string[];
  cols: string[];
}

interface DbSchema {
  title: string;
  origin: string;
  tables: Record<string, TableSchema>;
}

interface SchemasFile {
  order: string[];
  schemas: Record<string, DbSchema>;
}

// The exact text of bus7's RAISE(ABORT, ...) message - bus8 is supposed to
// trip it, so that specific error is the success case for that preset.
const TRIGGER_TEXT = "fromStation and toStation must be different";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderCell(cell: unknown): ReactNode {
  if (cell === null || cell === undefined) {
    return <span className="qQNull">NULL</span>;
  }
  if (cell instanceof Uint8Array) {
    return `<blob ${cell.length}b>`;
  }
  return String(cell);
}

function ResultTable({ result }: { result: RunResult }): ReactNode {
  return (
    <div className="sqTableWrap">
      <table className="qQTable">
        <thead>
          <tr>
            {result.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i} className="qQRowIn" style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
              {row.map((cell, j) => (
                <td key={j}>{renderCell(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function QueryPanel() {
  const [presetsData, setPresetsData] = useState<PresetsFile | null>(null);
  const [schemasData, setSchemasData] = useState<SchemasFile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState(false);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [sqlText, setSqlText] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);

  const [result, setResult] = useState<RunResult | null>(null);
  const [runMs, setRunMs] = useState<number | null>(null);
  const [runVersion, setRunVersion] = useState(0);
  const [touchedTables, setTouchedTables] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [previews, setPreviews] = useState<Record<string, RunResult>>({});

  const sessionRef = useRef<Database | null>(null);
  const autoDbPickedRef = useRef(false);
  const autoRanQueryRef = useRef(false);

  // Fetch the preset + schema fixtures once, then auto-pick the first db.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/demos/sql/presets.json").then((r) => {
        if (!r.ok) throw new Error(`presets.json ${r.status}`);
        return r.json() as Promise<PresetsFile>;
      }),
      fetch("/demos/sql/schemas.json").then((r) => {
        if (!r.ok) throw new Error(`schemas.json ${r.status}`);
        return r.json() as Promise<SchemasFile>;
      }),
    ])
      .then(([pdata, sdata]) => {
        if (cancelled) return;
        setPresetsData(pdata);
        setSchemasData(sdata);
        if (!autoDbPickedRef.current && pdata.order.length > 0) {
          autoDbPickedRef.current = true;
          setSelectedDb(pdata.order[0]);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Own one session db for the selected course; reopens on db switch or
  // an explicit "reset session" (sessionEpoch bump). Closes the previous
  // session synchronously before opening the next one.
  useEffect(() => {
    if (!selectedDb) return;
    let cancelled = false;
    setDbReady(false);
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    openDb(selectedDb)
      .then((db) => {
        if (cancelled) {
          db.close();
          return;
        }
        sessionRef.current = db;
        setDbReady(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDb, sessionEpoch]);

  // Close whatever session is open when the panel unmounts.
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
    };
  }, []);

  // One-time auto-run: once the first db's session is ready, load and run
  // its first preset so the panel opens alive.
  useEffect(() => {
    if (autoRanQueryRef.current) return;
    if (!dbReady || !presetsData || !schemasData || !selectedDb) return;
    const list = presetsData.presets[selectedDb];
    if (!list || list.length === 0) return;
    autoRanQueryRef.current = true;
    const preset = list[0];
    setSelectedPresetId(preset.id);
    setSqlText(preset.sql);
    runSqlNow(preset.sql);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbReady, presetsData, schemasData, selectedDb]);

  function runSqlNow(text: string) {
    const db = sessionRef.current;
    if (!db || !selectedDb || !schemasData) return;
    const start = performance.now();
    const res = runSql(db, text);
    const ms = performance.now() - start;
    setResult(res);
    setRunMs(ms);
    setRunVersion((v) => v + 1);

    const dbTables = schemasData.schemas[selectedDb]?.tables ?? {};
    const tables = Object.keys(dbTables).filter((t) => new RegExp(`\\b${escapeRegExp(t)}\\b`, "i").test(text));
    setTouchedTables(tables);

    if (expanded.size > 0) {
      setPreviews((prev) => {
        const next = { ...prev };
        for (const t of expanded) {
          const safe = t.replace(/"/g, '""');
          next[t] = runSql(db, `SELECT * FROM "${safe}" LIMIT 8;`);
        }
        return next;
      });
    }
  }

  function loadPreview(table: string) {
    const db = sessionRef.current;
    if (!db) return;
    const safe = table.replace(/"/g, '""');
    const res = runSql(db, `SELECT * FROM "${safe}" LIMIT 8;`);
    setPreviews((prev) => ({ ...prev, [table]: res }));
  }

  function toggleExpand(table: string) {
    const isOpen = expanded.has(table);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return next;
    });
    if (!isOpen) loadPreview(table);
  }

  function handleSelectDb(name: string) {
    if (name === selectedDb) return;
    setSelectedDb(name);
    setSelectedPresetId(null);
    setSqlText("");
    setShowOriginal(false);
    setResult(null);
    setRunMs(null);
    setTouchedTables([]);
    setExpanded(new Set());
    setPreviews({});
  }

  function handleResetSession() {
    setSessionEpoch((e) => e + 1);
    setResult(null);
    setRunMs(null);
    setTouchedTables([]);
    setExpanded(new Set());
    setPreviews({});
  }

  function handlePresetClick(preset: PresetItem) {
    if (!dbReady) return;
    setSelectedPresetId(preset.id);
    setSqlText(preset.sql);
    setShowOriginal(false);
    runSqlNow(preset.sql);
  }

  function handleRunClick() {
    if (!dbReady) return;
    runSqlNow(sqlText);
  }

  function handleEditorKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleRunClick();
    }
  }

  if (loadError) {
    return (
      <div className="sqPanel">
        <h2 className="sqH2">The query runner</h2>
        <div className="qQErrorBox">Could not load the query runner data ({loadError}).</div>
      </div>
    );
  }

  if (!presetsData || !schemasData) {
    return (
      <div className="sqPanel">
        <h2 className="sqH2">The query runner</h2>
        <p className="sqNote">Loading presets...</p>
      </div>
    );
  }

  const currentDbPresets = selectedDb ? presetsData.presets[selectedDb] ?? [] : [];
  const currentPreset = currentDbPresets.find((p) => p.id === selectedPresetId) ?? null;
  const isTriggerSuccess = !!result?.error && result.error.toLowerCase().includes(TRIGGER_TEXT.toLowerCase());

  return (
    <div className="sqPanel">
      <h2 className="sqH2">The query runner</h2>
      <p className="sqIntro">
        Pick a course database, fire a weekly preset (or type your own), and watch the tables it touches light up.
      </p>
      <p className="sqNote">
        Runs entirely in your browser via sql.js (SQLite in WebAssembly); the weekly originals were MariaDB, adapted
        presets show their original.
      </p>

      <div className="sqRow" style={{ marginTop: 10 }}>
        {presetsData.order.map((name) => (
          <button
            key={name}
            type="button"
            className="sqBtn"
            data-active={name === selectedDb}
            onClick={() => handleSelectDb(name)}
          >
            {schemasData.schemas[name]?.title ?? name}
          </button>
        ))}
        <button type="button" className="sqBtn" onClick={handleResetSession} disabled={!selectedDb}>
          reset session
        </button>
        {!dbReady && selectedDb && <span className="sqNote" style={{ margin: 0 }}>loading {selectedDb}...</span>}
      </div>

      <div className="qQBody">
        <div className="qQSide">
          <div className="qQPresetList">
            {currentDbPresets.map((p) => (
              <button
                key={p.id}
                type="button"
                className="qQPresetItem"
                data-active={p.id === selectedPresetId}
                disabled={!dbReady}
                onClick={() => handlePresetClick(p)}
              >
                <span className="qQPresetLabel">{p.label}</span>
                {p.original && <span className="sqChip qQAdaptedChip">adapted</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="qQMain">
          <textarea
            className="qQTextarea sqMono"
            spellCheck={false}
            value={sqlText}
            onChange={(e) => setSqlText(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            rows={7}
            aria-label="SQL editor"
          />
          <div className="sqRow">
            <button type="button" className="sqBtn sqBtnPrimary" onClick={handleRunClick} disabled={!dbReady}>
              Run
            </button>
            <span className="sqNote" style={{ margin: 0 }}>Ctrl+Enter also runs</span>
          </div>

          {currentPreset?.original && (
            <div className="qQOriginalBox">
              <button type="button" className="sqBtn" onClick={() => setShowOriginal((s) => !s)}>
                {showOriginal ? "hide the MariaDB original" : "show the MariaDB original"}
              </button>
              {showOriginal && <pre className="qQOriginalPre sqMono">{currentPreset.original}</pre>}
            </div>
          )}
          {currentPreset?.note && <p className="sqNote">{currentPreset.note}</p>}

          {result?.error && (
            <div className="qQErrorBox" data-success={isTriggerSuccess}>
              {isTriggerSuccess ? "The abort IS the answer - " : "Error - "}
              {result.error}
            </div>
          )}

          {result && !result.error && result.columns.length > 0 && (
            <>
              <ResultTable result={result} key={runVersion} />
              <p className="qQMeta">
                {result.rows.length} row{result.rows.length === 1 ? "" : "s"} - {runMs?.toFixed(1)} ms
              </p>
            </>
          )}
          {result && !result.error && result.columns.length === 0 && (
            <p className="qQMeta">executed, no result set, {runMs?.toFixed(1)} ms</p>
          )}

          {touchedTables.length > 0 && (
            <div className="qQTablesRow" key={runVersion}>
              <span className="sqNote" style={{ margin: 0 }}>tables in play:</span>
              {touchedTables.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="qQTableChip"
                  data-pulse="true"
                  data-open={expanded.has(t)}
                  onClick={() => toggleExpand(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {touchedTables
            .filter((t) => expanded.has(t))
            .map((t) => {
              const prev = previews[t];
              return (
                <div className="qQPreview" key={`${t}-${runVersion}`}>
                  <p className="qQPreviewTitle">{t} - first 8 rows</p>
                  {prev?.error && <p className="qQMeta">Could not preview ({prev.error}).</p>}
                  {prev && !prev.error && <ResultTable result={prev} />}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
