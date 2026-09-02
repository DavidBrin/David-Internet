"use client";

/**
 * 3.2 Automatic differentiation -- LIVE. A tiny expression graph for
 * f = w1*x1 + w2*x2 + b, loss L = (y - f)^2. Sliders drive the forward pass;
 * the closed-form chain-rule gradients are computed in TS and annotate the
 * edges into w1, w2, b, and L. "backprop" pulses the gradient flow backward
 * edge by edge; one pulse also auto-runs on mount (ref-guarded).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CardShell, LiveBadge } from "./CardShell";

const X1 = 1.5;
const X2 = -0.8;
const Y_TARGET = 1;
const STEP_MS = 260;

const BACK_ORDER = ["s-L", "b-s", "m1-s", "m2-s", "w1-m1", "w2-m2"] as const;

interface NodePos {
  id: string;
  x: number;
  y: number;
  label: string;
}

const NODES: NodePos[] = [
  { id: "x1", x: 30, y: 26, label: "x1" },
  { id: "w1", x: 30, y: 74, label: "w1" },
  { id: "x2", x: 30, y: 122, label: "x2" },
  { id: "w2", x: 30, y: 170, label: "w2" },
  { id: "b", x: 30, y: 210, label: "b" },
  { id: "m1", x: 178, y: 50, label: "w1x1" },
  { id: "m2", x: 178, y: 146, label: "w2x2" },
  { id: "s", x: 328, y: 98, label: "f" },
  { id: "y", x: 328, y: 210, label: "y" },
  { id: "L", x: 462, y: 154, label: "L" },
];

const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));

interface Grads {
  dW1: number;
  dW2: number;
  dB: number;
  dS: number;
}

interface EdgeDef {
  id: string;
  from: string;
  to: string;
  grad?: (g: Grads) => number;
}

const EDGES: EdgeDef[] = [
  { id: "x1-m1", from: "x1", to: "m1" },
  { id: "w1-m1", from: "w1", to: "m1", grad: (g) => g.dW1 },
  { id: "x2-m2", from: "x2", to: "m2" },
  { id: "w2-m2", from: "w2", to: "m2", grad: (g) => g.dW2 },
  { id: "m1-s", from: "m1", to: "s" },
  { id: "m2-s", from: "m2", to: "s" },
  { id: "b-s", from: "b", to: "s", grad: (g) => g.dB },
  { id: "s-L", from: "s", to: "L", grad: (g) => g.dS },
  { id: "y-L", from: "y", to: "L" },
];

export default function AutodiffCard() {
  const [w1, setW1] = useState(0.9);
  const [w2, setW2] = useState(-0.6);
  const [b, setB] = useState(0.2);
  const [activeStep, setActiveStep] = useState(-1);
  const timers = useRef<number[]>([]);
  const autoRan = useRef(false);

  const calc = useMemo(() => {
    const m1 = w1 * X1;
    const m2 = w2 * X2;
    const s = m1 + m2 + b;
    const diff = Y_TARGET - s;
    const L = diff * diff;
    const dS = -2 * diff;
    const dW1 = dS * X1;
    const dW2 = dS * X2;
    const dB = dS;
    return { m1, m2, s, L, dS, dW1, dW2, dB };
  }, [w1, w2, b]);

  const runPulse = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    BACK_ORDER.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setActiveStep(i), i * STEP_MS));
    });
    timers.current.push(
      window.setTimeout(() => setActiveStep(-1), BACK_ORDER.length * STEP_MS + 400),
    );
  }, []);

  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    timers.current.push(window.setTimeout(runPulse, 500));
  }, [runPulse]);

  useEffect(() => {
    return () => timers.current.forEach((t) => clearTimeout(t));
  }, []);

  const nodeValue = (id: string): string => {
    switch (id) {
      case "x1":
        return X1.toFixed(1);
      case "x2":
        return X2.toFixed(1);
      case "w1":
        return w1.toFixed(2);
      case "w2":
        return w2.toFixed(2);
      case "b":
        return b.toFixed(2);
      case "m1":
        return calc.m1.toFixed(2);
      case "m2":
        return calc.m2.toFixed(2);
      case "s":
        return calc.s.toFixed(2);
      case "y":
        return Y_TARGET.toFixed(1);
      case "L":
        return calc.L.toFixed(3);
      default:
        return "";
    }
  };

  const edgeClass = (id: string): string => {
    const idx = BACK_ORDER.indexOf(id as (typeof BACK_ORDER)[number]);
    if (idx === -1 || activeStep === -1) return "";
    if (idx < activeStep) return "ctLEdgeDone";
    if (idx === activeStep) return "ctLEdgeActive";
    return "";
  };

  return (
    <CardShell week="3.2" title="Automatic differentiation" wide>
      <LiveBadge />
      <p className="ctLBody">
        David&apos;s notebook builds a tiny expression graph by hand and walks it backward
        with the chain rule instead of calling <code className="ctMono">.backward()</code>.
        Drag w1, w2, b for f = w1&middot;x1 + w2&middot;x2 + b against loss
        L = (y &minus; f)&sup2;, then press backprop to watch each gradient flow from L back
        to the weights, edge by edge.
      </p>

      <svg
        viewBox="0 0 500 236"
        className="ctLGraph"
        role="img"
        aria-label="Expression graph for f = w1 x1 + w2 x2 + b, loss L = (y - f) squared"
      >
        <defs>
          <marker id="ctLArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" className="ctLArrowHead" />
          </marker>
        </defs>
        {EDGES.map((e) => {
          const a = NODE_BY_ID.get(e.from);
          const c = NODE_BY_ID.get(e.to);
          if (!a || !c) return null;
          const label = e.grad ? e.grad(calc).toFixed(2) : null;
          const mx = (a.x + c.x) / 2;
          const my = (a.y + c.y) / 2;
          return (
            <g key={e.id}>
              <line
                x1={a.x + 34}
                y1={a.y}
                x2={c.x - 36}
                y2={c.y}
                className={`ctLEdge ${edgeClass(e.id)}`}
                markerEnd="url(#ctLArrow)"
              />
              {label && (
                <text x={mx} y={my - 8} textAnchor="middle" className="ctLGradLabel">
                  {label}
                </text>
              )}
            </g>
          );
        })}
        {NODES.map((n) => (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}>
            <rect
              x={-34}
              y={-16}
              width={68}
              height={32}
              rx={7}
              className={n.id === "L" ? "ctLNode ctLNodeLoss" : "ctLNode"}
            />
            <text y={-2} textAnchor="middle" className="ctLNodeLabel">
              {n.label}
            </text>
            <text y={12} textAnchor="middle" className="ctLNodeValue">
              {nodeValue(n.id)}
            </text>
          </g>
        ))}
      </svg>

      <div className="ctLSliders ctRow">
        <label className="ctLSlider">
          <span>w1</span>
          <input
            type="range"
            min={-2}
            max={2}
            step={0.05}
            value={w1}
            onChange={(e) => setW1(Number(e.target.value))}
          />
          <span className="ctMono">{w1.toFixed(2)}</span>
        </label>
        <label className="ctLSlider">
          <span>w2</span>
          <input
            type="range"
            min={-2}
            max={2}
            step={0.05}
            value={w2}
            onChange={(e) => setW2(Number(e.target.value))}
          />
          <span className="ctMono">{w2.toFixed(2)}</span>
        </label>
        <label className="ctLSlider">
          <span>b</span>
          <input
            type="range"
            min={-2}
            max={2}
            step={0.05}
            value={b}
            onChange={(e) => setB(Number(e.target.value))}
          />
          <span className="ctMono">{b.toFixed(2)}</span>
        </label>
      </div>

      <div className="ctRow">
        <button type="button" className="ctBtn ctBtnPrimary" onClick={runPulse}>
          backprop
        </button>
        <span className="ctNote ctMono">
          dL/dw1 {calc.dW1.toFixed(2)} &middot; dL/dw2 {calc.dW2.toFixed(2)} &middot; dL/db{" "}
          {calc.dB.toFixed(2)}
        </span>
      </div>
    </CardShell>
  );
}
