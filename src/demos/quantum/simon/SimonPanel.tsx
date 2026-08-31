"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BV_N,
  DEFAULT_BV_S,
  DEFAULT_N,
  DEFAULT_S,
  DJ_FN_ORDER,
  DJ_LABELS,
  DJ_N,
  type DJFnName,
  type MeasureState,
  SIMON_N_OPTIONS,
  type SimonN,
  clampSimonS,
  initMeasure,
  isSolved,
  measureStep,
  runBV,
  runDJ,
  runSimon,
  toBits,
} from "./model";
import "./simon.css";

// ---------------------------------------------------------------- small helpers

function delta0(n: number): number[] {
  const v = new Array(1 << n).fill(0);
  v[0] = 1;
  return v;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** The 4-stage animation: 0 idle (delta at |0>), 1 after H^n, 2 after oracle, 3 after final H^n. */
function useStageMachine(reduced: boolean, deps: unknown[]) {
  const [stage, setStage] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setStage(0);
    setAutoPlaying(false);
  }, deps);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!autoPlaying) return;
    const step = reduced ? 40 : 900;
    timerRef.current = setInterval(() => {
      setStage((s) => {
        if (s >= 3) {
          setAutoPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, step);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlaying, reduced]);

  const step = useCallback(() => {
    setAutoPlaying(false);
    setStage((s) => (s >= 3 ? 0 : s + 1));
  }, []);

  const toggleAuto = useCallback(() => {
    setStage((s) => (s >= 3 ? 0 : s));
    setAutoPlaying((a) => !a);
  }, []);

  const reset = useCallback(() => {
    setAutoPlaying(false);
    setStage(0);
  }, []);

  return { stage, step, autoPlaying, toggleAuto, reset };
}

// ---------------------------------------------------------------- bar chart

interface BarChartProps {
  n: number;
  values: number[];
  maxVal: number;
  reduced: boolean;
  pairs?: [number, number][];
  hoverPair?: number | null;
  onHoverPair?: (idx: number | null) => void;
  signs?: number[];
  highlight?: Set<number>;
}

function BarChart({ n, values, maxVal, reduced, pairs, hoverPair, onHoverPair, signs, highlight }: BarChartProps) {
  const count = 1 << n;
  const slot = count <= 8 ? 56 : 32;
  const gap = 6;
  const ARC_H = 46;
  const BAR_H = 108;
  const LABEL_H = 14;
  const width = count * slot;
  const height = ARC_H + BAR_H + LABEL_H + 10;

  const cx = (i: number) => i * slot + slot / 2;

  return (
    <svg
      className={`qSiChartSvg${reduced ? " qSiReduced" : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Input register basis-state probabilities"
    >
      {pairs?.map(([x, y], idx) => {
        const x1 = cx(x);
        const x2 = cx(y);
        const dist = Math.abs(x2 - x1);
        const arcH = Math.min(ARC_H - 4, 10 + dist * 0.28);
        const mid = (x1 + x2) / 2;
        const hovered = hoverPair === idx;
        return (
          <path
            key={`pair-${x}-${y}`}
            className={`qSiArc${hovered ? " qSiArcHover" : ""}`}
            d={`M ${x1} ${ARC_H} Q ${mid} ${ARC_H - arcH} ${x2} ${ARC_H}`}
            onMouseEnter={() => onHoverPair?.(idx)}
            onMouseLeave={() => onHoverPair?.(null)}
          />
        );
      })}
      {values.map((v, i) => {
        const frac = Math.max(0, Math.min(1, v / maxVal));
        const barH = frac * BAR_H;
        const barW = slot - gap;
        const x = i * slot + gap / 2;
        const y = ARC_H + BAR_H - barH;
        const isHoverBar = pairs && hoverPair != null && (pairs[hoverPair]?.[0] === i || pairs[hoverPair]?.[1] === i);
        let cls = "qSiBar";
        if (highlight?.has(i)) cls += " qSiBarSurvivor";
        else if (signs) cls += signs[i] < 0 ? " qSiBarNeg" : " qSiBarPos";
        if (isHoverBar) cls += " qSiBarHover";
        return (
          <g key={`bar-${i}`}>
            <rect className={cls} x={x} y={y} width={barW} height={Math.max(barH, 0.5)}>
              <title>{`|${toBits(i, n)}⟩  p = ${v.toFixed(4)}`}</title>
            </rect>
            {barH > 12 && (
              <text className="qSiBarPct" x={cx(i)} y={y - 3}>
                {(v * 100).toFixed(v < 0.01 && v > 0 ? 2 : 1)}%
              </text>
            )}
            <text className="qSiBarLabel" x={cx(i)} y={ARC_H + BAR_H + 11}>
              {toBits(i, n)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------- stage controls (shared)

function StageControls({
  stage,
  labels,
  onStep,
  autoPlaying,
  onToggleAuto,
}: {
  stage: number;
  labels: [string, string, string, string];
  onStep: () => void;
  autoPlaying: boolean;
  onToggleAuto: () => void;
}) {
  const nextLabel = stage >= 3 ? "Reset animation" : labels[stage];
  return (
    <div className="qSiStageRow">
      <button type="button" className="qBtn" onClick={onStep}>
        Step: {nextLabel}
      </button>
      <button type="button" className={`qBtn ${autoPlaying ? "qBtnOn" : ""}`} onClick={onToggleAuto}>
        {autoPlaying ? "Auto-playing..." : "Auto-play"}
      </button>
      <span className="qSiStageLabel">stage {Math.min(stage, 3)} / 3</span>
    </div>
  );
}

// ---------------------------------------------------------------- Simon mode

function SimonMode({ reduced }: { reduced: boolean }) {
  const [n, setN] = useState<SimonN>(DEFAULT_N);
  const [s, setS] = useState(DEFAULT_S);
  const [hoverPair, setHoverPair] = useState<number | null>(null);
  const [measure, setMeasure] = useState<MeasureState>(() => initMeasure(DEFAULT_N));
  const [autoRunning, setAutoRunning] = useState(false);
  const autoRunTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stageMachine = useStageMachine(reduced, [n, s]);
  const { stage } = stageMachine;

  const run = useMemo(() => runSimon(n, s), [n, s]);
  const maxVal = 2 / (1 << n);

  // reset the measurement loop whenever n or s changes
  useEffect(() => {
    setMeasure(initMeasure(n));
    setAutoRunning(false);
    setHoverPair(null);
  }, [n, s]);

  const values = stage === 0 ? delta0(n) : stage === 1 ? run.uniform : stage === 2 ? run.afterOracle : run.final;
  const survivorSet = useMemo(() => new Set(run.survivors), [run.survivors]);

  const doMeasure = useCallback(() => {
    setMeasure((m) => (isSolved(m.candidates) ? m : measureStep(m, n, run.final, Math.random())));
  }, [n, run.final]);

  useEffect(() => {
    if (autoRunTimer.current) {
      clearInterval(autoRunTimer.current);
      autoRunTimer.current = null;
    }
    if (!autoRunning) return;
    autoRunTimer.current = setInterval(() => {
      setMeasure((m) => {
        if (isSolved(m.candidates)) return m;
        return measureStep(m, n, run.final, Math.random());
      });
    }, 600);
    return () => {
      if (autoRunTimer.current) clearInterval(autoRunTimer.current);
      autoRunTimer.current = null;
    };
  }, [autoRunning, n, run.final]);

  useEffect(() => {
    if (isSolved(measure.candidates)) setAutoRunning(false);
  }, [measure.candidates]);

  const solved = isSolved(measure.candidates);
  const canMeasure = stage === 3;

  const resetMeasure = () => {
    setAutoRunning(false);
    setMeasure(initMeasure(n));
  };

  return (
    <div className="qSi">
      <div className="qSiControls">
        <div className="qSiField">
          <span className="qSiFieldLabel">n (qubits)</span>
          <div className="qRow" style={{ marginTop: 0 }}>
            {SIMON_N_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`qBtn ${n === opt ? "qBtnOn" : ""}`}
                onClick={() => {
                  const clamped = clampSimonS(opt, s);
                  setN(opt);
                  setS(clamped);
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="qSiField">
          <span className="qSiFieldLabel">hidden string s (s &ne; 0)</span>
          <div className="qSiBits">
            {Array.from({ length: n }, (_, i) => {
              const shift = n - 1 - i;
              const bit = (s >> shift) & 1;
              return (
                <button
                  key={i}
                  type="button"
                  className={`qSiBit ${bit ? "qSiBitOn" : ""}`}
                  aria-label={`toggle bit ${i}`}
                  onClick={() => {
                    const candidate = s ^ (1 << shift);
                    if (candidate !== 0) setS(candidate);
                  }}
                >
                  {bit}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <StageControls
        stage={stage}
        labels={["Apply H⊗n", "Query oracle (draw pairs)", "Apply final H⊗n", "Reset animation"]}
        onStep={stageMachine.step}
        autoPlaying={stageMachine.autoPlaying}
        onToggleAuto={stageMachine.toggleAuto}
      />

      <div className="qSiMain">
        <div>
          <div className="qSiChartWrap">
            <BarChart
              n={n}
              values={values}
              maxVal={maxVal}
              reduced={reduced}
              pairs={stage === 2 ? run.pairs : undefined}
              hoverPair={hoverPair}
              onHoverPair={setHoverPair}
              highlight={stage === 3 ? survivorSet : undefined}
            />
          </div>
          <div className="qSiOracleLine">
            f(x) = min(x, x&oplus;s), &nbsp; s = {toBits(s, n)} ({s})
            {stage === 2 && " — hover an arc to see one x ↔ x⊕s pair"}
            {stage === 3 && " — only y with y·s = 0 (mod 2) survive"}
          </div>
        </div>

        <div className="qSiSide">
          <p className="qSiSideTitle">GF(2) equations</p>
          <div className="qSiEqTable">
            {measure.ys.length === 0 ? (
              <span className="qSiEqEmpty">no measurements yet</span>
            ) : (
              measure.ys.map((y) => (
                <div className="qSiEqRow" key={y}>
                  <span className="qSiEqBits">{toBits(y, n)}</span>
                  <span>&middot; s = 0</span>
                </div>
              ))
            )}
          </div>

          <p className="qSiSideTitle">Candidates ({measure.candidates.length})</p>
          <div className="qSiCandidates">
            {measure.candidates.map((c) => (
              <span key={c} className={`qSiCand ${solved && c === s ? "qSiCandTrue" : ""}`}>
                {toBits(c, n)}
              </span>
            ))}
          </div>

          {solved && (
            <p className="qSiSolved">
              Found s = {toBits(s, n)} in {measure.shots} measurement{measure.shots === 1 ? "" : "s"}
            </p>
          )}

          <div className="qRow" style={{ marginTop: 4 }}>
            <button type="button" className="qBtn" disabled={!canMeasure || solved} onClick={doMeasure}>
              Measure
            </button>
            <button
              type="button"
              className={`qBtn ${autoRunning ? "qBtnOn" : ""}`}
              disabled={!canMeasure || solved}
              onClick={() => setAutoRunning((a) => !a)}
            >
              {autoRunning ? "Auto-running..." : "Auto-run"}
            </button>
            <button type="button" className="qBtn" onClick={resetMeasure}>
              Reset
            </button>
          </div>
          {!canMeasure && <p className="qNote" style={{ marginTop: 6 }}>step through to the final H&#8855;n stage to measure</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Deutsch-Jozsa mode

function DJMode({ reduced }: { reduced: boolean }) {
  const [fnName, setFnName] = useState<DJFnName>("bit0");
  const stageMachine = useStageMachine(reduced, [fnName]);
  const { stage } = stageMachine;
  const run = useMemo(() => runDJ(fnName), [fnName]);
  const n = DJ_N;
  const maxVal = 2 / (1 << n);

  const values = stage === 0 ? delta0(n) : stage === 1 ? run.uniform : stage === 2 ? run.uniform : run.final;
  const highlight = stage === 3 ? new Set(run.final.map((p, i) => (p > 1e-9 ? i : -1)).filter((i) => i >= 0)) : undefined;

  return (
    <div className="qSi">
      <div className="qSiControls">
        <div className="qSiField">
          <span className="qSiFieldLabel">f</span>
          <div className="qRow" style={{ marginTop: 0 }}>
            {DJ_FN_ORDER.map((name) => (
              <button key={name} type="button" className={`qBtn ${fnName === name ? "qBtnOn" : ""}`} onClick={() => setFnName(name)}>
                {DJ_LABELS[name]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <StageControls
        stage={stage}
        labels={["Apply H⊗n", "Query oracle (± phase kick)", "Apply final H⊗n", "Reset animation"]}
        onStep={stageMachine.step}
        autoPlaying={stageMachine.autoPlaying}
        onToggleAuto={stageMachine.toggleAuto}
      />

      <div className="qSiMain">
        <div>
          <div className="qSiChartWrap">
            <BarChart
              n={n}
              values={values}
              maxVal={maxVal}
              reduced={reduced}
              signs={stage === 2 ? run.signs : undefined}
              highlight={highlight}
            />
          </div>
          <div className="qSiOracleLine">
            f(x) = {DJ_LABELS[fnName]}
            {stage === 2 && " — bar color shows (-1)^f(x) phase kicked back onto each x"}
          </div>
        </div>

        <div className="qSiSide">
          <p className="qSiSideTitle">Verdict</p>
          {stage < 3 ? (
            <p className="qNote" style={{ marginTop: 0 }}>step through to the final H&#8855;n stage for the verdict</p>
          ) : (
            <>
              <p className="qSiVerdict">{run.verdict === "constant" ? "constant" : "balanced"}</p>
              <p className="qSiVerdictSub">
                P(|000&#10217;) = {run.final[0].toFixed(3)} &nbsp;
                {run.verdict === "constant" ? "→ probability 1, so f is constant" : "→ probability 0, so f is balanced"}
              </p>
            </>
          )}
          <p className="qSiSideTitle">Measured distribution</p>
          <p className="qNote" style={{ marginTop: 0 }}>
            one query settles it: constant functions always return the input register to |000&#10217;, balanced ones never do.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Bernstein-Vazirani mode

function BVMode({ reduced }: { reduced: boolean }) {
  const [s, setS] = useState(DEFAULT_BV_S);
  const stageMachine = useStageMachine(reduced, [s]);
  const { stage } = stageMachine;
  const run = useMemo(() => runBV(s), [s]);
  const n = BV_N;
  const maxVal = 2 / (1 << n);

  const values = stage === 0 ? delta0(n) : stage === 1 ? run.uniform : stage === 2 ? run.uniform : run.final;
  const highlight = stage === 3 ? new Set([s]) : undefined;

  return (
    <div className="qSi">
      <div className="qSiControls">
        <div className="qSiField">
          <span className="qSiFieldLabel">hidden string s</span>
          <div className="qSiBits">
            {Array.from({ length: n }, (_, i) => {
              const shift = n - 1 - i;
              const bit = (s >> shift) & 1;
              return (
                <button
                  key={i}
                  type="button"
                  className={`qSiBit ${bit ? "qSiBitOn" : ""}`}
                  aria-label={`toggle bit ${i}`}
                  onClick={() => setS(s ^ (1 << shift))}
                >
                  {bit}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <StageControls
        stage={stage}
        labels={["Apply H⊗n", "Query oracle (s·x phase kick)", "Apply final H⊗n", "Reset animation"]}
        onStep={stageMachine.step}
        autoPlaying={stageMachine.autoPlaying}
        onToggleAuto={stageMachine.toggleAuto}
      />

      <div className="qSiMain">
        <div>
          <div className="qSiChartWrap">
            <BarChart n={n} values={values} maxVal={maxVal} reduced={reduced} highlight={highlight} />
          </div>
          <div className="qSiOracleLine">
            f(x) = s&middot;x mod 2, &nbsp; s = {toBits(s, n)} ({s})
          </div>
        </div>

        <div className="qSiSide">
          <p className="qSiSideTitle">Result</p>
          {stage < 3 ? (
            <p className="qNote" style={{ marginTop: 0 }}>step through to the final H&#8855;n stage to read s off</p>
          ) : (
            <>
              <p className="qSiSpike">spike at |{toBits(s, n)}&#10217;</p>
              <p className="qSiVerdictSub">one query, whole string: no measurement loop needed.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- panel

type Mode = "simon" | "dj" | "bv";

export default function SimonPanel() {
  const [mode, setMode] = useState<Mode>("simon");
  const reduced = useReducedMotion();

  return (
    <div>
      <div className="qSiTabs">
        <button type="button" className={`qBtn ${mode === "simon" ? "qBtnOn" : ""}`} onClick={() => setMode("simon")}>
          Simon
        </button>
        <button type="button" className={`qBtn ${mode === "dj" ? "qBtnOn" : ""}`} onClick={() => setMode("dj")}>
          Deutsch&ndash;Jozsa
        </button>
        <button type="button" className={`qBtn ${mode === "bv" ? "qBtnOn" : ""}`} onClick={() => setMode("bv")}>
          Bernstein&ndash;Vazirani
        </button>
      </div>

      {mode === "simon" && <SimonMode reduced={reduced} />}
      {mode === "dj" && <DJMode reduced={reduced} />}
      {mode === "bv" && <BVMode reduced={reduced} />}
    </div>
  );
}
