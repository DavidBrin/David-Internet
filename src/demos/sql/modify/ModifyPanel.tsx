"use client";

/**
 * #modify - "Changing data without breaking it".
 *
 * Replays the bike-shop project's INSERT / UPDATE / DELETE script one step at
 * a time against a single persistent sql.js session, diffing every table the
 * step touches. A foreign-key switch controls whether the session's SQLite
 * copy enforces FK references (off by default, matching the course's MariaDB
 * files); the last step deletes a part a repair job still references, which
 * either fails loudly (FK on) or succeeds and orphans a row (FK off). A
 * second, independent mini-demo below installs the Bus Service week-13 guard
 * trigger and trips it.
 *
 * Prefix qM (see ./modify.css). Shared classes come from ../sql.css.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Database } from "sql.js";
import { openDb, runSql, tableRows } from "../core/engine";
import {
  describeFkError,
  diffTable,
  extractTables,
  isFkError,
  type DiffRow,
  type TableSnapshot,
} from "./diff";
import "./modify.css";

interface ModifyStep {
  id: string;
  label: string;
  sql: string;
  original?: string;
  note?: string;
}

interface PresetsFile {
  order: string[];
  presets: Record<string, ModifyStep[]>;
}

interface StepResult {
  stepId: string;
  status: "success" | "error";
  errorMessage?: string;
  tables: string[];
  diffs: Record<string, DiffRow[]>;
  columns: Record<string, string[]>;
  /** Current Parts.part_id values, for flagging orphaned Parts_Used rows. */
  orphanPartIds?: Set<string>;
}

interface TripResult {
  kind: "blocked" | "inserted" | "error";
  message: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function currentPartIds(db: Database): Set<string> {
  const snap = tableRows(db, "Parts");
  return new Set(snap.rows.map((r) => String(r[0])));
}

function runOneStep(db: Database, step: ModifyStep): StepResult {
  let tables = extractTables(step.sql);
  const before: Record<string, TableSnapshot> = {};
  for (const t of tables) before[t] = tableRows(db, t);

  const result = runSql(db, step.sql);

  if (result.error) {
    return {
      stepId: step.id,
      status: "error",
      errorMessage: result.error,
      tables,
      diffs: {},
      columns: {},
    };
  }

  // A part deleted here can orphan Parts_Used rows even though that table
  // was not itself touched by this step - show its current state too.
  if (tables.includes("Parts") && !tables.includes("Parts_Used")) {
    tables = [...tables, "Parts_Used"];
    before["Parts_Used"] = tableRows(db, "Parts_Used");
  }

  const diffs: Record<string, DiffRow[]> = {};
  const columns: Record<string, string[]> = {};
  for (const t of tables) {
    const after = tableRows(db, t);
    diffs[t] = diffTable(t, before[t], after);
    columns[t] = after.columns.length ? after.columns : before[t].columns;
  }

  return {
    stepId: step.id,
    status: "success",
    tables,
    diffs,
    columns,
    orphanPartIds: currentPartIds(db),
  };
}

function stepState(index: number, pointer: number): "done" | "next" | "pending" {
  if (index < pointer) return "done";
  if (index === pointer) return "next";
  return "pending";
}

function rowClassName(state: DiffRow["state"]): string {
  if (state === "inserted") return "qMRow qMRowIns";
  if (state === "deleted") return "qMRow qMRowDel";
  if (state === "updated") return "qMRow qMRowUpd";
  return "qMRow";
}

function DiffTable({
  table,
  columns,
  rows,
  orphanPartIds,
}: {
  table: string;
  columns: string[];
  rows: DiffRow[];
  orphanPartIds?: Set<string>;
}) {
  if (!rows.length) {
    return <p className="sqNote">(no rows)</p>;
  }
  return (
    <table className="qMTable">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const orphan =
            table === "Parts_Used" && orphanPartIds !== undefined && !orphanPartIds.has(String(row.cells[1]));
          return (
            <tr className={rowClassName(row.state)} key={row.key}>
              {row.cells.map((cell, i) => (
                <td key={i} className={row.changedCols.has(i) ? "qMCellChanged" : undefined}>
                  {String(cell)}
                  {orphan && i === row.cells.length - 1 && (
                    <span className="qMBadge">references a part that no longer exists</span>
                  )}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function StepResultView({ step, result }: { step: ModifyStep; result: StepResult }) {
  if (result.status === "error") {
    const message = result.errorMessage ?? "unknown error";
    const friendly = isFkError(message) ? describeFkError(step.id, message) : `SQLite refuses: ${message}.`;
    return (
      <div className="qMCallout qMCalloutError">
        <p className="qMCalloutTitle">{step.label} did not run</p>
        <p>{friendly}</p>
        <p className="qMCalloutMsg">{message}</p>
      </div>
    );
  }
  return (
    <>
      {step.note && <p className="qMStepNote">{step.note}</p>}
      {result.tables.map((table) => (
        <div className="qMTableBlock" key={table}>
          <div className="qMTableBlockHead">
            <span className="qMTableName">{table}</span>
          </div>
          <div className="sqTableWrap">
            <DiffTable
              table={table}
              columns={result.columns[table] ?? []}
              rows={result.diffs[table] ?? []}
              orphanPartIds={result.orphanPartIds}
            />
          </div>
        </div>
      ))}
    </>
  );
}

export default function ModifyPanel() {
  // ---------------------------------------------------------------- presets
  const [bikeSteps, setBikeSteps] = useState<ModifyStep[] | null>(null);
  const [busSteps, setBusSteps] = useState<ModifyStep[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/demos/sql/presets.json")
      .then((r) => {
        if (!r.ok) throw new Error(`presets.json ${r.status}`);
        return r.json() as Promise<PresetsFile>;
      })
      .then((data) => {
        if (cancelled) return;
        setBikeSteps(data.presets.bikeshop ?? []);
        setBusSteps(data.presets.busservice ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "failed to load presets.json");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------- FK switch
  const [fkOn, setFkOn] = useState(false);
  const fkOnRef = useRef(false);
  useEffect(() => {
    fkOnRef.current = fkOn;
  }, [fkOn]);

  // -------------------------------------------------------- bikeshop session
  const bikeDbRef = useRef<Database | null>(null);
  const [bikeReady, setBikeReady] = useState(false);
  const [bikeReseedGen, setBikeReseedGen] = useState(0);

  const [pointer, setPointer] = useState(0);
  const [results, setResults] = useState<Record<string, StepResult>>({});
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let opened: Database | null = null;
    setBikeReady(false);
    openDb("bikeshop")
      .then((db) => {
        if (cancelled) {
          db.close();
          return;
        }
        db.run(`PRAGMA foreign_keys = ${fkOnRef.current ? "ON" : "OFF"};`);
        opened = db;
        bikeDbRef.current = db;
        setBikeReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "failed to open bikeshop.sqlite");
      });
    return () => {
      cancelled = true;
      if (opened) {
        opened.close();
        bikeDbRef.current = null;
      }
    };
  }, [bikeReseedGen]);

  const runStepAt = useCallback(
    (index: number): StepResult | null => {
      const db = bikeDbRef.current;
      if (!db || !bikeSteps || index < 0 || index >= bikeSteps.length) return null;
      const step = bikeSteps[index];
      const result = runOneStep(db, step);
      setResults((prev) => ({ ...prev, [step.id]: result }));
      setActiveStepId(step.id);
      if (result.status === "success") setPointer(index + 1);
      return result;
    },
    [bikeSteps]
  );

  const handleRunStep = useCallback(() => {
    if (!bikeReady || !bikeSteps || running || pointer >= bikeSteps.length) return;
    runStepAt(pointer);
  }, [bikeReady, bikeSteps, running, pointer, runStepAt]);

  const handleRunAll = useCallback(async () => {
    if (!bikeReady || !bikeSteps || running) return;
    setRunning(true);
    let i = pointer;
    while (i < bikeSteps.length) {
      const result = runStepAt(i);
      if (!result || result.status === "error") break;
      i += 1;
      if (i < bikeSteps.length) await sleep(280);
    }
    setRunning(false);
  }, [bikeReady, bikeSteps, running, pointer, runStepAt]);

  const handleUndo = useCallback(() => {
    setPointer(0);
    setResults({});
    setActiveStepId(null);
    setBikeReseedGen((g) => g + 1);
  }, []);

  const handleToggleFk = useCallback(() => {
    setFkOn((prev) => {
      const next = !prev;
      const db = bikeDbRef.current;
      if (db) db.run(`PRAGMA foreign_keys = ${next ? "ON" : "OFF"};`);
      return next;
    });
  }, []);

  const toggleOriginal = useCallback((id: string) => {
    setShowOriginal((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const activeStep = useMemo(
    () => (activeStepId ? bikeSteps?.find((s) => s.id === activeStepId) ?? null : null),
    [activeStepId, bikeSteps]
  );
  const activeResult = activeStepId ? results[activeStepId] : undefined;

  // ------------------------------------------------------- bus service demo
  const busDbRef = useRef<Database | null>(null);
  const [busReady, setBusReady] = useState(false);
  const [busReseedGen, setBusReseedGen] = useState(0);
  const [busError, setBusError] = useState<string | null>(null);
  const [triggerInstalled, setTriggerInstalled] = useState(false);
  const [tripResult, setTripResult] = useState<TripResult | null>(null);
  const [showBusOriginal, setShowBusOriginal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let opened: Database | null = null;
    setBusReady(false);
    openDb("busservice")
      .then((db) => {
        if (cancelled) {
          db.close();
          return;
        }
        opened = db;
        busDbRef.current = db;
        setBusReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setBusError(err instanceof Error ? err.message : "failed to open busservice.sqlite");
      });
    return () => {
      cancelled = true;
      if (opened) {
        opened.close();
        busDbRef.current = null;
      }
    };
  }, [busReseedGen]);

  const bus7 = useMemo(() => busSteps?.find((s) => s.id === "bus7") ?? null, [busSteps]);
  const bus8 = useMemo(() => busSteps?.find((s) => s.id === "bus8") ?? null, [busSteps]);

  const handleInstallTrigger = useCallback(() => {
    const db = busDbRef.current;
    if (!db || !bus7) return;
    const result = runSql(db, bus7.sql);
    if (result.error) {
      setBusError(result.error);
      return;
    }
    setBusError(null);
    setTriggerInstalled(true);
    setTripResult(null);
  }, [bus7]);

  const handleTryInsert = useCallback(() => {
    const db = busDbRef.current;
    if (!db || !bus8) return;
    const result = runSql(db, bus8.sql);
    if (result.error) {
      setTripResult(
        triggerInstalled ? { kind: "blocked", message: result.error } : { kind: "error", message: result.error }
      );
    } else {
      setTripResult({ kind: "inserted", message: "Row inserted; nothing stopped it." });
    }
  }, [bus8, triggerInstalled]);

  const handleResetBus = useCallback(() => {
    setTriggerInstalled(false);
    setTripResult(null);
    setBusError(null);
    setBusReseedGen((g) => g + 1);
  }, []);

  // -------------------------------------------------------------- render
  return (
    <div className="sqPanel">
      <h2 className="sqH2">Changing data without breaking it</h2>
      <p className="sqIntro">
        The bike-shop project&apos;s INSERT / UPDATE / DELETE script, replayed one step at a time against
        a single SQLite copy. Each step diffs the table(s) it touched; the last step deletes a part a
        repair job still relies on, and the switch below decides whether SQLite catches it.
      </p>

      <div className="qMTop">
        <label className="qMFkLabel">
          <button
            type="button"
            className="qMSwitch"
            data-on={fkOn}
            role="switch"
            aria-checked={fkOn}
            aria-label="Enforce foreign keys"
            onClick={handleToggleFk}
          />
          Enforce foreign keys
          <span className="sqChip">{fkOn ? "ON" : "OFF"}</span>
        </label>
        <p className="qMFkNote">
          Off by default, matching SQLite&apos;s own default and MariaDB&apos;s posture in the course files. On,
          every insert, update and delete below is checked against the schema&apos;s FK references
          immediately.
        </p>
      </div>

      {loadError && (
        <div className="qMCallout qMCalloutError">
          <p className="qMCalloutTitle">Could not load the bike-shop demo</p>
          <p className="qMCalloutMsg">{loadError}</p>
        </div>
      )}

      {!loadError && (!bikeSteps || !bikeReady) && <p className="sqNote">Loading the bike-shop database...</p>}

      {bikeSteps && bikeReady && (
        <div className="qMGrid">
          <div>
            <div className="qMStepperHead">
              <p className="qMStepperTitle">
                Step {Math.min(pointer + 1, bikeSteps.length)} of {bikeSteps.length}
              </p>
            </div>
            <div className="sqRow" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className="sqBtn sqBtnPrimary"
                disabled={running || pointer >= bikeSteps.length}
                onClick={handleRunStep}
              >
                Run step
              </button>
              <button
                type="button"
                className="sqBtn"
                disabled={running || pointer >= bikeSteps.length}
                onClick={() => {
                  void handleRunAll();
                }}
              >
                Run all remaining
              </button>
              <button type="button" className="sqBtn" disabled={running} onClick={handleUndo}>
                Undo / re-seed
              </button>
            </div>

            <div className="qMStepper">
              {bikeSteps.map((step, index) => {
                const state = stepState(index, pointer);
                const hasResult = Boolean(results[step.id]);
                return (
                  <div
                    key={step.id}
                    className="qMStep"
                    data-state={state}
                    data-active={activeStepId === step.id}
                    role={hasResult ? "button" : undefined}
                    tabIndex={hasResult ? 0 : undefined}
                    onClick={hasResult ? () => setActiveStepId(step.id) : undefined}
                  >
                    <div className="qMStepHead">
                      <span className="qMStepIdx">{index + 1}</span>
                      {state === "done" && <span className="qMStepCheck">done</span>}
                      <span className="qMStepLabel">{step.label}</span>
                    </div>
                    {state === "next" && (
                      <div className="qMStepBody">
                        <pre className="qMSql sqMono">{step.sql}</pre>
                        {step.note && <p className="qMStepNote">{step.note}</p>}
                        <div className="qMStepActions">
                          <button
                            type="button"
                            className="qMBtnSm"
                            disabled={running}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRunStep();
                            }}
                          >
                            Run this step
                          </button>
                          {step.original && (
                            <button
                              type="button"
                              className="qMBtnSm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleOriginal(step.id);
                              }}
                            >
                              {showOriginal[step.id] ? "hide original" : "show original (MariaDB)"}
                            </button>
                          )}
                        </div>
                        {step.original && showOriginal[step.id] && (
                          <div className="qMOriginal">
                            <strong>Original</strong>
                            <pre className="sqMono">{step.original}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="qMCenter">
            {activeStep && activeResult ? (
              <StepResultView step={activeStep} result={activeResult} />
            ) : (
              <div className="qMCenterEmpty">Run a step to see its before/after diff here.</div>
            )}
          </div>
        </div>
      )}

      <div className="qMTrigger">
        <h3 className="qMTriggerHead">Bus Service: the week-13 guard trigger</h3>
        <p className="sqNote">
          A BEFORE INSERT trigger that refuses a trip whose departure and arrival station are the same.
          Its own session database, separate from the bike-shop steps above.
        </p>

        {busError && (
          <div className="qMCallout qMCalloutError">
            <p className="qMCalloutTitle">Bus service error</p>
            <p className="qMCalloutMsg">{busError}</p>
          </div>
        )}

        {!busSteps || !busReady ? (
          <p className="sqNote">Loading the bus-service database...</p>
        ) : (
          <>
            <div className="qMTriggerRow">
              <button
                type="button"
                className="sqBtn"
                data-active={triggerInstalled}
                onClick={handleInstallTrigger}
              >
                {triggerInstalled ? "Trigger installed" : "Install the trigger"}
              </button>
              <button type="button" className="sqBtn" onClick={handleTryInsert}>
                Try the same-station insert
              </button>
              <button type="button" className="sqBtn" onClick={handleResetBus}>
                Reset
              </button>
              {bus7?.original && (
                <button type="button" className="qMBtnSm" onClick={() => setShowBusOriginal((v) => !v)}>
                  {showBusOriginal ? "hide original" : "show original (MariaDB SIGNAL)"}
                </button>
              )}
            </div>

            {bus7?.original && showBusOriginal && (
              <div className="qMOriginal">
                <strong>Original</strong>
                <pre className="sqMono">{bus7.original}</pre>
              </div>
            )}

            {tripResult && (
              <div
                className={
                  "qMCallout " +
                  (tripResult.kind === "blocked"
                    ? "qMCalloutOk"
                    : tripResult.kind === "error"
                      ? "qMCalloutError"
                      : "qMCalloutInfo")
                }
              >
                <p className="qMCalloutTitle">
                  {tripResult.kind === "blocked" && "The trigger did its job"}
                  {tripResult.kind === "inserted" && "Inserted without incident"}
                  {tripResult.kind === "error" && "Something else went wrong"}
                </p>
                {tripResult.kind === "inserted" && (
                  <p>No trigger is installed, so the same-station trip went in unblocked. Install it, then try again.</p>
                )}
                {tripResult.kind === "blocked" && <p>SQLite raised the trigger&apos;s RAISE(ABORT) and stopped the insert.</p>}
                <p className="qMCalloutMsg">{tripResult.message}</p>
              </div>
            )}
          </>
        )}
      </div>

      <p className="sqNote">
        The bike-shop schema itself is reconstructed; its DDL was never archived, only the data sheet
        and this modification script survive, so the tables and seed rows here were rebuilt for this
        page. The schema browser above says more about what was invented.
      </p>
    </div>
  );
}
