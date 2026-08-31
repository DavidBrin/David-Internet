"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createRun,
  measure,
  mean as meanOf,
  stepDiffuse,
  stepOracle,
  successProbability,
  type MeasureResult,
  type RunState,
} from "./model";
import "./grover.css";

const N_OPTIONS = [2, 3, 4, 5];
const STEP_MS = 350; // one half-step (oracle or diffuse) animation
const ITER_PACE_MS = 900; // auto-run: total time budget per full iteration
const FLASH_MS = 650;

const DEFAULT_N = 3;
const DEFAULT_MARKED = new Set([5]);

function defaultMarked(N: number): Set<number> {
  return new Set([Math.min(5, N - 1)]);
}

// ------------------------------------------------------------------ amplitude chart geometry
const AW = 640;
const AH = 240;
const A_ML = 24;
const A_MR = 12;
const A_MT = 14;
const A_MB = 20;
const A_PLOT_W = AW - A_ML - A_MR;
const A_PLOT_H = AH - A_MT - A_MB;
const A_ZERO_Y = A_MT + A_PLOT_H / 2;
const A_SCALE = A_PLOT_H / 2; // domain [-1, 1] maps to +-A_SCALE px

// ------------------------------------------------------------------ curve chart geometry
const CW = 640;
const CH = 150;
const C_ML = 30;
const C_MR = 12;
const C_MT = 12;
const C_MB = 22;
const C_PLOT_W = CW - C_ML - C_MR;
const C_PLOT_H = CH - C_MT - C_MB;

export default function GroverPanel() {
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const [n, setN] = useState(DEFAULT_N);
  const [marked, setMarked] = useState<Set<number>>(DEFAULT_MARKED);
  const [run, setRun] = useState<RunState>(() => createRun(DEFAULT_N, DEFAULT_MARKED));
  const [autoRunning, setAutoRunning] = useState(false);
  const [meanHighlight, setMeanHighlight] = useState(false);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const [measureResult, setMeasureResult] = useState<MeasureResult | null>(null);

  const runRef = useRef(run);
  const autoRef = useRef(false);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(
    () => () => {
      autoRef.current = false;
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    },
    [],
  );

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        if (reduced || ms <= 0) {
          resolve();
          return;
        }
        const id = window.setTimeout(resolve, ms);
        timeoutsRef.current.push(id);
      }),
    [reduced],
  );

  const commit = useCallback((next: RunState) => {
    runRef.current = next;
    setRun(next);
  }, []);

  const stopAuto = useCallback(() => {
    autoRef.current = false;
    setAutoRunning(false);
  }, []);

  const resetRun = useCallback((nextN: number, nextMarked: Set<number>) => {
    autoRef.current = false;
    setAutoRunning(false);
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
    setMeasureResult(null);
    setFlashIndex(null);
    setMeanHighlight(false);
    const next = createRun(nextN, nextMarked);
    runRef.current = next;
    setRun(next);
  }, []);

  const handleSetN = (nextN: number) => {
    if (nextN === n || autoRunning) return;
    const N = 1 << nextN;
    const kept = new Set([...marked].filter((m) => m < N));
    const nextMarked = kept.size > 0 ? kept : defaultMarked(N);
    setN(nextN);
    setMarked(nextMarked);
    resetRun(nextN, nextMarked);
  };

  const toggleMarked = (idx: number) => {
    if (autoRunning) return;
    const next = new Set(marked);
    if (next.has(idx)) {
      if (next.size === 1) return; // must keep at least one marked
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setMarked(next);
    resetRun(n, next);
  };

  const handleReset = () => resetRun(n, marked);

  const doOracleStep = () => {
    if (runRef.current.oraclePending) return;
    commit(stepOracle(runRef.current));
  };

  const doDiffuseStep = () => {
    if (!runRef.current.oraclePending) return;
    setMeanHighlight(true);
    commit(stepDiffuse(runRef.current));
  };

  const handleOracle = () => {
    if (autoRunning) return;
    doOracleStep();
  };

  const handleDiffuse = async () => {
    if (autoRunning) return;
    doDiffuseStep();
    await wait(STEP_MS);
    setMeanHighlight(false);
  };

  const handleIterate = async () => {
    if (autoRunning) return;
    if (!runRef.current.oraclePending) {
      doOracleStep();
      await wait(STEP_MS);
    }
    doDiffuseStep();
    await wait(STEP_MS);
    setMeanHighlight(false);
  };

  const runAutoLoop = async () => {
    while (autoRef.current) {
      const cur = runRef.current;
      if (!cur.oraclePending && cur.iteration >= 2 * cur.optimal) break;
      if (!cur.oraclePending) {
        doOracleStep();
        await wait(STEP_MS);
        if (!autoRef.current) break;
      }
      doDiffuseStep();
      await wait(Math.max(ITER_PACE_MS - STEP_MS, STEP_MS));
      setMeanHighlight(false);
      if (!autoRef.current) break;
    }
    autoRef.current = false;
    setAutoRunning(false);
  };

  const toggleAutoRun = () => {
    if (autoRef.current) {
      stopAuto();
      return;
    }
    const cur = runRef.current;
    if (!cur.oraclePending && cur.iteration >= 2 * cur.optimal) return; // nothing left to do
    autoRef.current = true;
    setAutoRunning(true);
    runAutoLoop();
  };

  const handleMeasure = () => {
    if (autoRunning) return;
    const result = measure(runRef.current, Math.random());
    setMeasureResult(result);
    setFlashIndex(result.index);
    const id = window.setTimeout(() => setFlashIndex(null), FLASH_MS);
    timeoutsRef.current.push(id);
  };

  const N = run.N;
  const currentP = successProbability(run.amps, run.marked);
  const meanVal = meanOf(run.amps);
  const overRotated = run.iteration > run.optimal;
  const autoDone = !run.oraclePending && run.iteration >= 2 * run.optimal;

  // ---------------------------------------------------------------- amplitude bars
  const barSlot = A_PLOT_W / N;
  const barW = Math.max(barSlot * 0.7, 1);
  const showLabels = N <= 16;

  const bars = [];
  for (let i = 0; i < N; i++) {
    const amp = run.amps[i];
    const isMarked = run.marked.has(i);
    const y = amp >= 0 ? A_ZERO_Y - amp * A_SCALE : A_ZERO_Y;
    const h = Math.max(Math.abs(amp) * A_SCALE, 0.5);
    const x = A_ML + i * barSlot + (barSlot - barW) / 2;
    const isFlash = flashIndex === i;
    const cls = `qGrBar ${isMarked ? "qGrMarked" : "qGrPlain"}${isFlash ? " qGrFlash" : ""}`;
    bars.push(
      <g
        key={i}
        className={cls}
        role="button"
        tabIndex={0}
        aria-pressed={isMarked}
        aria-label={`item ${i}${isMarked ? " (marked)" : ""}`}
        onClick={() => toggleMarked(i)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleMarked(i);
          }
        }}
      >
        <rect x={x} y={y} width={barW} height={h} rx={1.5} />
        {showLabels && (
          <text className="qGrBarLabel" x={x + barW / 2} y={AH - 6}>
            {i}
          </text>
        )}
        <title>{`item ${i}: amplitude ${amp.toFixed(3)}`}</title>
      </g>,
    );
  }
  const meanY = A_ZERO_Y - meanVal * A_SCALE;

  // ---------------------------------------------------------------- success curve
  const xDomain = Math.max(2 * run.optimal, run.history.length - 1, 1);
  const cx = (k: number) => C_ML + (k / xDomain) * C_PLOT_W;
  const cy = (p: number) => C_MT + (1 - Math.min(p, 1)) * C_PLOT_H;
  const curvePoints = run.history.map((p, k) => [cx(k), cy(p)] as const);
  const linePath = curvePoints.map(([x, y], idx) => `${idx === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const optimalX = cx(run.optimal);
  const maxP = Math.max(...run.history);
  const maxIdx = run.history.indexOf(maxP);

  return (
    <div className="qGrLayout">
      <div className="qGrControls">
        <span className="qGrHint">n (qubits):</span>
        <div className="qGrNSelect">
          {N_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`qBtn${opt === n ? " qBtnOn" : ""}`}
              disabled={autoRunning}
              onClick={() => handleSetN(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <span className="qGrHint">click bars below to choose marked items</span>
        <button type="button" className="qBtn" onClick={handleReset}>
          Reset
        </button>
      </div>

      <div className="qCanvasWrap qGrChart">
        <svg viewBox={`0 0 ${AW} ${AH}`} role="img" aria-label="Amplitude bar chart">
          <line className="qGrAxisLine" x1={A_ML} x2={AW - A_MR} y1={A_ZERO_Y} y2={A_ZERO_Y} />
          <rect
            className={`qGrMeanLine${meanHighlight ? " qGrMeanLineActive" : ""}`}
            x={A_ML}
            y={meanY - 0.75}
            width={A_PLOT_W}
            height={1.5}
          />
          {bars}
        </svg>
      </div>

      <div className="qGrButtons">
        <button type="button" className="qBtn" disabled={autoRunning || run.oraclePending} onClick={handleOracle}>
          Oracle
        </button>
        <button type="button" className="qBtn" disabled={autoRunning || !run.oraclePending} onClick={handleDiffuse}>
          Diffuse
        </button>
        <button type="button" className="qBtn" disabled={autoRunning} onClick={handleIterate}>
          Iterate
        </button>
        <button
          type="button"
          className={`qBtn${autoRunning ? " qBtnOn" : ""}`}
          disabled={!autoRunning && autoDone}
          onClick={toggleAutoRun}
        >
          {autoRunning ? "Stop" : "Auto-run"}
        </button>
        <button type="button" className="qBtn" disabled={autoRunning} onClick={handleMeasure}>
          Measure
        </button>
      </div>

      <div className="qGrReadouts">
        <span>
          N = <b>{run.N}</b>
        </span>
        <span>
          M = <b>{run.M}</b>
        </span>
        <span>
          k* = <b>{run.optimal}</b>
        </span>
        <span>
          P(marked) = <b>{(currentP * 100).toFixed(1)}%</b>
        </span>
        <span>
          iteration <b>{run.iteration}</b> / optimal <b>{run.optimal}</b>
        </span>
      </div>

      {overRotated && (
        <p className="qNote qGrOverRotated">over-rotated — the amplitude is rotating past the target</p>
      )}

      {measureResult && (
        <p className={`qNote qGrMeasureNote ${measureResult.hit ? "qGrMeasureHit" : "qGrMeasureMiss"}`}>
          Measured item {measureResult.index} — {measureResult.hit ? "hit!" : "miss."}
        </p>
      )}

      <div className="qCanvasWrap qGrCurve">
        <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="Success probability curve">
          <line className="qGrAxisLine" x1={C_ML} x2={CW - C_MR} y1={C_MT + C_PLOT_H} y2={C_MT + C_PLOT_H} />
          <line className="qGrAxisLine" x1={C_ML} x2={C_ML} y1={C_MT} y2={C_MT + C_PLOT_H} />
          <line className="qGrOptimalLine" x1={optimalX} x2={optimalX} y1={C_MT} y2={C_MT + C_PLOT_H} />
          <text className="qGrCurveAxis" x={optimalX} y={C_MT - 2} textAnchor="middle">
            k*
          </text>
          <text className="qGrCurveAxis" x={C_ML} y={C_MT + C_PLOT_H + 14} textAnchor="start">
            0
          </text>
          <text className="qGrCurveAxis" x={CW - C_MR} y={C_MT + C_PLOT_H + 14} textAnchor="end">
            {xDomain}
          </text>
          <text className="qGrCurveAxis" x={C_ML - 4} y={C_MT + 4} textAnchor="end">
            100%
          </text>
          <text className="qGrCurveAxis" x={C_ML - 4} y={C_MT + C_PLOT_H} textAnchor="end">
            0%
          </text>
          {run.history.length > 1 && <path className="qGrCurveLine" d={linePath} />}
          {curvePoints.map(([x, y], idx) => (
            <circle key={idx} className="qGrCurveDot" cx={x} cy={y} r={idx === maxIdx ? 3.5 : 2.25} />
          ))}
        </svg>
      </div>

      <p className="qNote">
        peak P(marked) so far: <b>{(maxP * 100).toFixed(1)}%</b> at iteration {maxIdx}
      </p>

      <p className="qGrFooter">
        The course covered verifying the ⌊π/4·√(N/M)⌋ iteration formula in practice.
      </p>
    </div>
  );
}
