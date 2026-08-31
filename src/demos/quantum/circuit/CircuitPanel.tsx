"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GATE_NAMES,
  NUM_COLS,
  PRESET_BELL,
  PRESET_GHZ,
  basisLabel,
  circuitUnitary,
  evalColumns,
  matchKnownGate,
  measureShots,
  phaseDeg,
  wernerFidelity,
  wireRoles,
  type Circuit,
  type GateName,
  type PlacedGate,
} from "./model";
import "./circuit.css";

const STEP_MS = 400;

function fmtComplex(re: number, im: number): string {
  const r = Math.abs(re) < 5e-4 ? 0 : re;
  const i = Math.abs(im) < 5e-4 ? 0 : im;
  return `${r.toFixed(3)}${i < 0 ? "-" : "+"}${Math.abs(i).toFixed(3)}i`;
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

export default function CircuitPanel() {
  const [n, setN] = useState<2 | 3>(2);
  const [circuit, setCircuit] = useState<Circuit>(PRESET_BELL);
  const [armed, setArmed] = useState<GateName | null>(null);
  const [phi, setPhi] = useState(-Math.PI);
  const [pending, setPending] = useState<{ col: number; wires: number[] } | null>(null);
  const [stepIndex, setStepIndex] = useState(NUM_COLS);
  const [running, setRunning] = useState(false);
  const [shots, setShots] = useState<number[] | null>(null);
  const [wernerP, setWernerP] = useState(0.5);
  const idRef = useRef(0);
  const reduced = useReducedMotion();

  const states = useMemo(() => evalColumns(n, circuit), [n, circuit]);

  // Reset playback/measurement whenever the circuit or wire count changes.
  useEffect(() => {
    setStepIndex(states.length - 1);
    setShots(null);
    setRunning(false);
  }, [states]);

  useEffect(() => {
    if (!running) return;
    if (stepIndex >= states.length - 1) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => setStepIndex((v) => v + 1), reduced ? 60 : STEP_MS);
    return () => clearTimeout(t);
  }, [running, stepIndex, states.length, reduced]);

  function resetInteraction() {
    setArmed(null);
    setPending(null);
  }

  function loadCircuit(nextN: 2 | 3, next: Circuit) {
    setN(nextN);
    setCircuit(next);
    resetInteraction();
  }

  function changeN(nextN: 2 | 3) {
    if (nextN === n) return;
    loadCircuit(nextN, []);
  }

  function addGate(name: GateName, col: number, targets: number[], controls: number[]) {
    idRef.current += 1;
    const wires = new Set([...targets, ...controls]);
    const g: PlacedGate = {
      id: `g${idRef.current}`,
      col,
      name,
      targets,
      controls,
      ...(name === "CRZ" ? { arg: phi } : {}),
    };
    setCircuit((c) => [
      ...c.filter((e) => !(e.col === col && [...e.targets, ...e.controls].some((w) => wires.has(w)))),
      g,
    ]);
  }

  function removeGate(id: string) {
    setCircuit((c) => c.filter((g) => g.id !== id));
  }

  function armGate(name: GateName) {
    setPending(null);
    setArmed((cur) => (cur === name ? null : name));
  }

  function onCellClick(col: number, wire: number) {
    if (!armed) return;
    const roles = wireRoles(armed);
    const need = roles.targets + roles.controls;
    if (need === 1) {
      addGate(armed, col, [wire], []);
      setArmed(null);
      return;
    }
    if (!pending || pending.col !== col) {
      setPending({ col, wires: [wire] });
      return;
    }
    if (pending.wires.includes(wire)) return;
    const wires = [...pending.wires, wire];
    if (wires.length < need) {
      setPending({ col, wires });
      return;
    }
    addGate(armed, col, wires.slice(0, roles.targets), wires.slice(roles.targets));
    setPending(null);
    setArmed(null);
  }

  function runAnimation() {
    setShots(null);
    setStepIndex(0);
    setRunning(true);
  }

  function onMeasure() {
    setRunning(false);
    const counts = measureShots(n, circuit, 1000, Math.random);
    setShots(counts);
  }

  // ---- geometry
  const dims = useMemo(() => {
    const leftGutter = 40;
    const colW = 50;
    const rightPad = 14;
    const topPad = 22;
    const rowH = 42;
    return {
      leftGutter,
      colW,
      rightPad,
      topPad,
      rowH,
      width: leftGutter + NUM_COLS * colW + rightPad,
      height: topPad * 2 + (n - 1) * rowH,
    };
  }, [n]);
  const colX = (col: number) => dims.leftGutter + col * dims.colW + dims.colW / 2;
  const rowY = (wire: number) => dims.topPad + wire * dims.rowH;
  const playheadX = dims.leftGutter + Math.min(stepIndex, NUM_COLS) * dims.colW;

  const dim = 1 << n;
  const shown = states[Math.min(stepIndex, states.length - 1)];

  const unitary = useMemo(() => circuitUnitary(n, circuit), [n, circuit]);
  const knownLabel = n === 2 ? matchKnownGate(unitary) : null;

  const maxShotCount = shots ? Math.max(1, ...shots) : 1;

  const wernerCurve = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const p = i / 40;
      const f = wernerFidelity(p);
      pts.push(`${(5 + p * 150).toFixed(1)},${(65 - (f - 0.5) * 120).toFixed(1)}`);
    }
    return pts.join(" ");
  }, []);
  const curF = wernerFidelity(wernerP);
  const curX = 5 + wernerP * 150;
  const curY = 65 - (curF - 0.5) * 120;

  const paletteNames = GATE_NAMES.filter((g) => g !== "TOFFOLI" || n === 3);

  return (
    <div className="qCkWrap">
      <div className="qRow">
        <span>wires</span>
        {[2, 3].map((v) => (
          <button
            key={v}
            type="button"
            className={`qBtn ${n === v ? "qBtnOn" : ""}`}
            onClick={() => changeN(v as 2 | 3)}
          >
            N={v}
          </button>
        ))}
        <span style={{ marginLeft: 8 }}>presets</span>
        <button type="button" className="qBtn" onClick={() => loadCircuit(2, PRESET_BELL)}>
          Bell (intro notebook)
        </button>
        <button type="button" className="qBtn" onClick={() => loadCircuit(3, PRESET_GHZ)}>
          GHZ
        </button>
        <button type="button" className="qBtn" onClick={() => loadCircuit(n, [])}>
          Clear
        </button>
      </div>

      <div className="qCkPalette">
        {paletteNames.map((g) => (
          <button
            key={g}
            type="button"
            className={`qBtn qCkPaletteGate ${armed === g ? "qBtnOn" : ""}`}
            onClick={() => armGate(g)}
            title={`place ${g}`}
          >
            {g}
          </button>
        ))}
        <label className="qCkPhiField">
          &phi;
          <input
            type="number"
            step="0.1"
            value={phi}
            onChange={(e) => setPhi(Number(e.target.value))}
            aria-label="CRZ phase argument (radians)"
          />
          rad
        </label>
      </div>
      <div className="qCkHint">
        {armed
          ? wireRoles(armed).targets + wireRoles(armed).controls === 1
            ? `click a wire to place ${armed}`
            : pending
              ? `click ${wireRoles(armed).targets + wireRoles(armed).controls - pending.wires.length} more wire(s) in that column (target first, then control${
                  wireRoles(armed).controls > 1 ? "s" : ""
                })`
              : `click the target wire for ${armed}, then its control${wireRoles(armed).controls > 1 ? "s" : ""}`
          : "click a gate above, then click a wire; click a placed gate to delete it"}
      </div>

      <div className="qCanvasWrap">
        <svg
          className="qCkGridSvg"
          viewBox={`0 0 ${dims.width} ${dims.height}`}
          role="img"
          aria-label="Quantum circuit wire diagram"
        >
          {Array.from({ length: n }, (_, w) => (
            <g key={`wire${w}`}>
              <line
                x1={dims.leftGutter}
                x2={dims.width - dims.rightPad}
                y1={rowY(w)}
                y2={rowY(w)}
                stroke="var(--demo-line)"
              />
              <text x={4} y={rowY(w) + 4} fontSize={11} fill="var(--demo-muted)">
                q{w}
              </text>
            </g>
          ))}

          {pending ? (
            <rect
              x={colX(pending.col) - dims.colW / 2}
              y={dims.topPad - dims.rowH / 2}
              width={dims.colW}
              height={(n - 1) * dims.rowH + dims.rowH}
              fill="rgba(124,58,237,0.08)"
            />
          ) : null}

          {Array.from({ length: NUM_COLS }, (_, col) =>
            Array.from({ length: n }, (_, w) => (
              <rect
                key={`cell${col}-${w}`}
                className="qCkCell"
                x={colX(col) - dims.colW / 2 + 1}
                y={rowY(w) - dims.rowH / 2 + 1}
                width={dims.colW - 2}
                height={dims.rowH - 2}
                fill="transparent"
                onClick={() => onCellClick(col, w)}
              />
            )),
          )}

          {pending
            ? Array.from({ length: n }, (_, w) => w)
                .filter((w) => !pending.wires.includes(w))
                .map((w) => (
                  <circle
                    key={`pend${w}`}
                    cx={colX(pending.col)}
                    cy={rowY(w)}
                    r={5}
                    fill="none"
                    stroke="var(--demo-accent)"
                    strokeWidth={1.5}
                    pointerEvents="none"
                  />
                ))
            : null}

          <line
            x1={playheadX}
            x2={playheadX}
            y1={dims.topPad - 10}
            y2={dims.height - dims.topPad + 10}
            stroke="var(--demo-accent)"
            strokeWidth={1.5}
            opacity={0.55}
          />

          {circuit.map((g) => {
            const x = colX(g.col);
            const allWires = [...g.controls, ...g.targets];
            const ys = allWires.map(rowY);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const targetW = g.targets[0];
            return (
              <g key={g.id} className="qCkGate" onClick={() => removeGate(g.id)}>
                <rect
                  x={x - 16}
                  y={minY - 16}
                  width={32}
                  height={maxY - minY + 32}
                  fill="transparent"
                />
                {allWires.length > 1 ? (
                  <line x1={x} x2={x} y1={minY} y2={maxY} stroke="var(--demo-accent)" strokeWidth={1.5} />
                ) : null}
                {g.controls.map((w) => (
                  <circle key={`c${w}`} cx={x} cy={rowY(w)} r={5} fill="var(--demo-accent)" />
                ))}
                {g.name === "SWAP" ? (
                  g.targets.map((w) => (
                    <g key={`s${w}`} stroke="var(--demo-accent)" strokeWidth={2}>
                      <line x1={x - 7} x2={x + 7} y1={rowY(w) - 7} y2={rowY(w) + 7} />
                      <line x1={x - 7} x2={x + 7} y1={rowY(w) + 7} y2={rowY(w) - 7} />
                    </g>
                  ))
                ) : g.name === "CZ" ? (
                  <circle cx={x} cy={rowY(targetW)} r={5} fill="var(--demo-accent)" />
                ) : g.name === "CNOT" || g.name === "TOFFOLI" ? (
                  <g>
                    <circle
                      className="qCkGateBody"
                      cx={x}
                      cy={rowY(targetW)}
                      r={11}
                      fill="#fff"
                      stroke="var(--demo-accent)"
                      strokeWidth={1.5}
                    />
                    <line x1={x - 7} x2={x + 7} y1={rowY(targetW)} y2={rowY(targetW)} stroke="var(--demo-accent)" strokeWidth={1.5} />
                    <line x1={x} x2={x} y1={rowY(targetW) - 7} y2={rowY(targetW) + 7} stroke="var(--demo-accent)" strokeWidth={1.5} />
                  </g>
                ) : (
                  <g>
                    <rect
                      className="qCkGateBody"
                      x={x - (g.name === "CRZ" ? 17 : 13)}
                      y={rowY(targetW) - 13}
                      width={g.name === "CRZ" ? 34 : 26}
                      height={26}
                      rx={4}
                      fill="#fff"
                      stroke="var(--demo-accent)"
                      strokeWidth={1.5}
                    />
                    <text x={x} y={rowY(targetW) + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--demo-ink)">
                      {g.name === "CRZ" ? `RZ` : g.name}
                    </text>
                    {g.name === "CRZ" ? (
                      <title>{`RZ(${(g.arg ?? -Math.PI).toFixed(3)})`}</title>
                    ) : null}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="qRow">
        <button type="button" className="qBtn qBtnOn" onClick={runAnimation}>
          run
        </button>
        <button type="button" className="qBtn" onClick={onMeasure}>
          measure (1000 shots)
        </button>
        <span className="qNote" style={{ margin: 0 }}>
          {running ? `column ${Math.min(stepIndex, NUM_COLS - 1) + 1}/${NUM_COLS}` : "amplitudes below reflect the state after the playhead's column"}
        </span>
      </div>

      <p className="qCkSectionTitle">amplitudes {`|${"0".repeat(n)}⟩`}…{basisLabel(n, dim - 1)}</p>
      <div className={`qCkBars ${reduced ? "qCkNoAnim" : ""}`}>
        {Array.from({ length: dim }, (_, i) => {
          const re = shown.re[i];
          const im = shown.im[i];
          const mag = Math.hypot(re, im);
          const color = mag < 1e-9 ? "#c9c9d1" : `hsl(${phaseDeg(re, im).toFixed(0)}, 72%, 52%)`;
          return (
            <div key={i} className="qCkBarCol">
              <div className="qCkBarTrack">
                <div
                  className="qCkBar"
                  style={{ height: `${Math.min(100, mag * 100)}%`, background: color }}
                  title={`${basisLabel(n, i)}: ${fmtComplex(re, im)}  |amp|=${mag.toFixed(3)}`}
                />
              </div>
              <span className="qCkBarLabel">{basisLabel(n, i)}</span>
            </div>
          );
        })}
      </div>

      {shots ? (
        <>
          <p className="qCkSectionTitle">measured counts (1000 shots)</p>
          <div className={`qCkHist ${reduced ? "qCkNoAnim" : ""}`}>
            {shots.map((count, i) => (
              <div key={i} className="qCkBarCol">
                <span className="qCkHistCount">{count}</span>
                <div className="qCkBarTrack">
                  <div className="qCkHistBar" style={{ height: `${(count / maxShotCount) * 100}%` }} />
                </div>
                <span className="qCkBarLabel">{basisLabel(n, i)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <p className="qCkSectionTitle">
        circuit unitary{knownLabel ? ` — = ${knownLabel} (up to global phase)` : ""}
      </p>
      <div className="qCkUnitaryWrap">
        <div className="qCkUnitaryGrid" style={{ gridTemplateColumns: `repeat(${dim}, minmax(78px, auto))` }}>
          {Array.from({ length: dim }, (_, r) =>
            Array.from({ length: dim }, (_, c) => (
              <div key={`${r}-${c}`} className="qCkUnitaryCell">
                {fmtComplex(unitary.re[r * dim + c], unitary.im[r * dim + c])}
              </div>
            )),
          )}
        </div>
      </div>

      <div className="qCkWernerCard">
        <div className="qCkWernerControls">
          <span className="qCkSectionTitle" style={{ margin: 0 }}>
            Werner state W(p), fidelity to |&Psi;&#8315;&#10217;
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={wernerP}
            onChange={(e) => setWernerP(Number(e.target.value))}
            aria-label="Werner state mixing parameter p"
          />
          <span className="qCkWernerVal">
            p = {wernerP.toFixed(2)}, F = {curF.toFixed(4)}
          </span>
        </div>
        <svg className="qCkWernerCurve" viewBox="0 0 160 70" width={160} height={70} role="img" aria-label="Werner fidelity curve">
          <polyline points={wernerCurve} fill="none" stroke="var(--demo-accent)" strokeWidth={1.5} />
          <circle cx={curX} cy={curY} r={3.5} fill="var(--demo-accent)" />
        </svg>
      </div>
    </div>
  );
}
