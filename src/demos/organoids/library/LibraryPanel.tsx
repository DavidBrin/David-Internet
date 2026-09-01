"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EDGES,
  FUNCTIONS,
  FUNCTION_MAP,
  REPLAY_STEPS,
  STAGES,
  type FnInfo,
  type StageId,
} from "./functions";
import "./library.css";

/**
 * Chapter 5 — "the library": an animated dependency map of
 * General_LFP_analysis_functions.py, plus a step-through replay of the real call order
 * from a per-day notebook (PlateF-D30.py). Both data tables live in ./functions.ts,
 * hand-transcribed from the raw source files — nothing here is generated or synthetic.
 */

const VIEW_W = 1040;
const VIEW_H = 520;
const MARGIN_X = 90;
const CENTER_Y = 280;
const ROW_H = 58;
const NODE_H = 26;
const HEADER_Y = 30;
const STEP_MS = 650;

interface NodeLayout {
  fn: FnInfo;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface EdgeLayout {
  key: string;
  from: string;
  to: string;
  d: string;
}

function nodeWidth(id: string): number {
  return Math.min(190, Math.max(96, id.length * 6.4 + 20));
}

export default function LibraryPanel() {
  const layout = useMemo(() => {
    const colStep = (VIEW_W - MARGIN_X * 2) / (STAGES.length - 1);
    const colX = new Map<StageId, number>();
    STAGES.forEach((s, i) => colX.set(s.id, MARGIN_X + i * colStep));

    const byStage = new Map<StageId, FnInfo[]>();
    STAGES.forEach((s) => byStage.set(s.id, []));
    FUNCTIONS.forEach((fn) => byStage.get(fn.stage)?.push(fn));

    const nodes = new Map<string, NodeLayout>();
    STAGES.forEach((s) => {
      const list = byStage.get(s.id) ?? [];
      const x = colX.get(s.id) ?? MARGIN_X;
      const startY = CENTER_Y - ((list.length - 1) * ROW_H) / 2;
      list.forEach((fn, i) => {
        nodes.set(fn.id, { fn, x, y: startY + i * ROW_H, w: nodeWidth(fn.id), h: NODE_H });
      });
    });

    return { colX, nodes };
  }, []);

  const edgePaths: EdgeLayout[] = useMemo(() => {
    const paths: EdgeLayout[] = [];
    for (const [from, to] of EDGES) {
      const a = layout.nodes.get(from);
      const b = layout.nodes.get(to);
      if (!a || !b) continue;
      const x1 = a.x + a.w / 2;
      const y1 = a.y;
      const x2 = b.x - b.w / 2;
      const y2 = b.y;
      const mx = x1 + (x2 - x1) / 2;
      paths.push({ key: `${from}->${to}`, from, to, d: `M ${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}` });
    }
    return paths;
  }, [layout]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // stop any running interval on unmount
  useEffect(() => clearTimer, [clearTimer]);

  // auto-stop once the last step is reached
  useEffect(() => {
    if (playing && stepIdx >= REPLAY_STEPS.length - 1) {
      clearTimer();
      setPlaying(false);
    }
  }, [stepIdx, playing, clearTimer]);

  const advance = useCallback(() => {
    setStepIdx((prev) => Math.min(prev + 1, REPLAY_STEPS.length - 1));
  }, []);

  const handleReplay = useCallback(() => {
    clearTimer(); // cancel-safe: always clear before arming a new interval, never stack timers
    setStepIdx(-1);
    setPlaying(true);
    timerRef.current = window.setInterval(advance, STEP_MS);
  }, [advance, clearTimer]);

  const handleStep = useCallback(() => {
    clearTimer();
    setPlaying(false);
    advance();
  }, [advance, clearTimer]);

  const handlePause = useCallback(() => {
    clearTimer();
    setPlaying(false);
  }, [clearTimer]);

  const handleReset = useCallback(() => {
    clearTimer();
    setPlaying(false);
    setStepIdx(-1);
  }, [clearTimer]);

  const currentStep = stepIdx >= 0 ? REPLAY_STEPS[stepIdx] : null;

  const litNodes = useMemo(() => new Set(currentStep?.nodes ?? []), [currentStep]);

  const glowEdgeKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!currentStep) return keys;
    for (const from of currentStep.via) {
      for (const to of currentStep.nodes) keys.add(`${from}->${to}`);
    }
    return keys;
  }, [currentStep]);

  // a fading "trail" of everything already visited earlier in the run
  const visitedNodes = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < stepIdx; i++) REPLAY_STEPS[i].nodes.forEach((n) => set.add(n));
    return set;
  }, [stepIdx]);

  const visitedEdgeKeys = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < stepIdx; i++) {
      const s = REPLAY_STEPS[i];
      for (const from of s.via) for (const to of s.nodes) set.add(`${from}->${to}`);
    }
    return set;
  }, [stepIdx]);

  const logLines = useMemo(() => {
    const lines: { cell: number; text: string }[] = [];
    for (let i = 0; i <= stepIdx; i++) {
      const step = REPLAY_STEPS[i];
      for (const code of step.code) lines.push({ cell: step.cell, text: code });
    }
    return lines;
  }, [stepIdx]);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight; // container-only auto-follow — never scrollIntoView
  }, [logLines]);

  const selected = selectedId ? FUNCTION_MAP[selectedId] : null;

  return (
    <div className="ogLibRoot">
      <div className="ogRow ogLibControls">
        <button type="button" className="ogBtn" onClick={handleReplay}>
          ▶ replay PlateF-D30
        </button>
        <button
          type="button"
          className="ogBtn"
          onClick={handleStep}
          disabled={stepIdx >= REPLAY_STEPS.length - 1}
        >
          step
        </button>
        <button type="button" className="ogBtn" onClick={handlePause} disabled={!playing}>
          pause
        </button>
        <button type="button" className="ogBtn" onClick={handleReset} disabled={stepIdx < 0}>
          reset
        </button>
        <span className="ogLibStepCount ogMono">
          {stepIdx >= 0 ? `step ${stepIdx + 1} / ${REPLAY_STEPS.length}` : "idle"}
        </span>
      </div>

      <div className="ogLibGrid">
        <div className="ogCanvasWrap ogLibMap">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            role="img"
            aria-label="Dependency map of General_LFP_analysis_functions.py"
          >
            {STAGES.map((s) => (
              <text
                key={s.id}
                x={layout.colX.get(s.id) ?? 0}
                y={HEADER_Y}
                textAnchor="middle"
                className="ogLibColHead"
              >
                {s.label}
              </text>
            ))}

            <g className="ogLibEdges">
              {edgePaths.map((e) => {
                const cls = glowEdgeKeys.has(e.key)
                  ? "ogLibEdge ogLibEdgeGlow"
                  : visitedEdgeKeys.has(e.key)
                    ? "ogLibEdge ogLibEdgeVisited"
                    : "ogLibEdge";
                return <path key={e.key} d={e.d} className={cls} />;
              })}
            </g>

            <g className="ogLibNodes">
              {Array.from(layout.nodes.values()).map((n) => {
                const isLit = litNodes.has(n.fn.id);
                const isVisited = !isLit && visitedNodes.has(n.fn.id);
                const isSelected = selectedId === n.fn.id;
                const cls = [
                  "ogLibNode",
                  isLit ? "ogLibNodeLit" : "",
                  isVisited ? "ogLibNodeVisited" : "",
                  isSelected ? "ogLibNodeSelected" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <g
                    key={n.fn.id}
                    className={cls}
                    data-stage={n.fn.stage}
                    transform={`translate(${n.x - n.w / 2}, ${n.y - n.h / 2})`}
                    onClick={() => setSelectedId(n.fn.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") setSelectedId(n.fn.id);
                    }}
                  >
                    <title>{n.fn.signature}</title>
                    <rect width={n.w} height={n.h} rx={n.h / 2} />
                    <text x={n.w / 2} y={n.h / 2} textLength={n.w - 16} lengthAdjust="spacingAndGlyphs">
                      {n.fn.id}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="ogLibSide">
          <div className="ogLibDetail">
            {selected ? (
              <>
                <div className="ogLibDetailHead">
                  <span className="ogMono ogLibDetailName">{selected.id}</span>
                  <button
                    type="button"
                    className="ogLibDetailClose"
                    onClick={() => setSelectedId(null)}
                    aria-label="Close detail"
                  >
                    ×
                  </button>
                </div>
                <div className="ogMono ogLibSig">{selected.signature}</div>
                <p className="ogLibSummary">{selected.summary}</p>
                {selected.mirror && (
                  <a className="ogMirror" href={selected.mirror.href}>
                    mirrors → {selected.mirror.label}
                  </a>
                )}
              </>
            ) : (
              <p className="ogNote">
                click a node for its signature, docstring summary, and which chapter panel mirrors it
              </p>
            )}
          </div>

          <div className="ogLibLog ogMono" ref={logRef}>
            {logLines.length === 0 ? (
              <div className="ogLibLogEmpty">▶ replay to walk PlateF-D30, cell by cell</div>
            ) : (
              logLines.map((l, i) => (
                <div key={i} className="ogLibLogLine">
                  cell {l.cell} · {l.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="ogNote ogLibFooter">
        consolidated from A_LFP_analysis_functions.py (Plate A era) in June 2025; next steps the author noted:
        batching, caching, a CLI.
      </p>
    </div>
  );
}
