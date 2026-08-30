"use client";

import { useCallback, useRef, useState } from "react";
import { usePlayback, useTicker } from "../hooks";
import { clkDivReset, clkDivStep, type ClkDivState } from "../models/clkdiv";
import { PlayControls } from "../ui";

const EDGES = 48;
const W = 480;
const PX = W / EDGES;

interface Edge {
  clkin: number;
  clkout: number;
  count: number;
}

function trace(points: number[], yHi: number, yLo: number): string {
  let d = "";
  for (let i = 0; i < points.length; i++) {
    const x = i * PX;
    const y = points[i] ? yHi : yLo;
    if (i === 0) d += `M${x},${y}`;
    else {
      const prevY = points[i - 1] ? yHi : yLo;
      if (prevY !== y) d += ` L${x},${prevY} L${x},${y}`;
    }
    d += ` L${x + PX},${y}`;
  }
  return d;
}

export default function ClkDivWidget() {
  const [n, setN] = useState(4);
  const [speed, setSpeed] = useState(12);
  const pb = usePlayback(true);
  const state = useRef<{ s: ClkDivState; edges: Edge[]; clkin: number }>({ s: clkDivReset(4), edges: [], clkin: 0 });
  const [, setVersion] = useState(0);

  const step = useCallback(
    (k: number) => {
      const st = state.current;
      for (let i = 0; i < k; i++) {
        st.clkin ^= 1;
        st.s = clkDivStep(st.s, n);
        st.edges.push({ clkin: st.clkin, clkout: st.s.clkout, count: st.s.count });
        if (st.edges.length > EDGES) st.edges.shift();
      }
      setVersion((v) => v + 1);
    },
    [n],
  );
  useTicker(pb.running, speed, step);

  const changeN = (v: number) => {
    setN(v);
    state.current = { s: clkDivReset(v), edges: [], clkin: 0 };
    setVersion((x) => x + 1);
  };

  const edges = state.current.edges;
  const pad = EDGES - edges.length;
  const clkinPts = [...Array<number>(pad).fill(0), ...edges.map((e) => e.clkin)];
  const clkoutPts = [...Array<number>(pad).fill(0), ...edges.map((e) => e.clkout)];

  return (
    <div className="shelfWidget">
      <div className="demoControls">
        <label>
          N
          <input type="range" min={2} max={8} value={n} onChange={(e) => changeN(Number(e.target.value))} />
          <span className="demoMono shelfSpeed">{n}</span>
        </label>
        <span className="demoMono shelfState">
          count = {state.current.s.count} (wraps at 2N−1 = {2 * n - 1}) · clkout = {state.current.s.clkout}
        </span>
      </div>
      <svg className="shelfSvg shelfScopeSvg" viewBox={`0 0 ${W} 110`} role="img" aria-label="Clock divider scope">
        <text x={2} y={14} className="shelfSvgLabel">
          clkin
        </text>
        <text x={2} y={58} className="shelfSvgLabel">
          clkout
        </text>
        <path d={trace(clkinPts, 18, 38)} className="shelfTrace" />
        <path d={trace(clkoutPts, 62, 82)} className="shelfTrace isAccent" />
        {edges.map((e, i) => (
          <text key={i} x={(pad + i) * PX + PX / 2} y={100} textAnchor="middle" className="shelfSvgTiny">
            {e.count}
          </text>
        ))}
      </svg>
      <PlayControls
        running={pb.running}
        onToggle={pb.toggle}
        onStep={() => step(1)}
        onReset={() => changeN(n)}
        reduced={pb.reduced}
        speed={speed}
        onSpeed={setSpeed}
        speedLabel="edges/s"
        min={2}
        max={60}
      />
      <p className="demoNote">
        The counter advances on both clkin edges (0…2N−1) and clkout = (count &gt; N−2) &amp;&amp; (count &lt; 2N−1), so
        the output is high for N half-periods: clkin/N at a 50/50 duty cycle even for odd N.
      </p>
    </div>
  );
}
