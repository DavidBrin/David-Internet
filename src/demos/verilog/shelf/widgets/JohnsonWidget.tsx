"use client";

import { useState } from "react";
import { usePlayback, useTicker } from "../hooks";
import { johnsonSequence, johnsonStep } from "../models/johnson";
import { BitRow, PlayControls, bin } from "../ui";

const N = 4;
const CX = 110;
const CY = 100;
const R = 62;

export default function JohnsonWidget() {
  const [count, setCount] = useState(0);
  const [loadCnt, setLoadCnt] = useState(0b1000);
  const [speed, setSpeed] = useState(3);
  const pb = usePlayback(true);
  useTicker(pb.running, speed, (k) =>
    setCount((c) => {
      let v = c;
      for (let i = 0; i < k; i++) v = johnsonStep(v, N);
      return v;
    }),
  );

  const seq = johnsonSequence(count, N);
  const canonical = johnsonSequence(0, N);
  const onCanonical = canonical.includes(count);

  // flip-flops around a ring: Q3 at the top, then clockwise Q2, Q1, Q0
  const pos = (i: number) => {
    const a = -Math.PI / 2 + ((N - 1 - i) * 2 * Math.PI) / N;
    return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
  };

  return (
    <div className="shelfWidget">
      <div className="shelfRowFlex">
        <svg className="shelfSvg shelfJohnson" viewBox="0 0 220 200" role="img" aria-label="Johnson counter ring">
          {Array.from({ length: N }, (_, i) => {
            const from = pos(i);
            const to = pos(i - 1 < 0 ? N - 1 : i - 1);
            const isFeedback = i === 0;
            const mx = (from.x + to.x) / 2 + (isFeedback ? 0 : 0);
            const my = (from.y + to.y) / 2;
            return (
              <g key={i}>
                <path
                  d={`M${from.x},${from.y} Q${mx + (CX - mx) * -0.6},${my + (CY - my) * -0.6} ${to.x},${to.y}`}
                  className={`shelfWire ${(count >>> i) & 1 ? "isActive" : ""}`}
                  markerEnd="url(#shelfArrow)"
                />
                {isFeedback && (
                  <g>
                    <circle cx={mx + (CX - mx) * -0.62} cy={my + (CY - my) * -0.62} r={4.5} className="shelfInvert" />
                    <text x={mx + (CX - mx) * -0.62 + 8} y={my + (CY - my) * -0.62 - 6} className="shelfSvgSub">
                      ~Q0
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          <defs>
            <marker id="shelfArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#5f6368" />
            </marker>
          </defs>
          {Array.from({ length: N }, (_, i) => {
            const p = pos(i);
            const on = (count >>> i) & 1;
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={18} className={`shelfFf ${on ? "isOn" : ""}`} />
                <text x={p.x} y={p.y + 4} textAnchor="middle" className="shelfSvgBitText">
                  {on}
                </text>
                <text x={p.x} y={p.y + 32} textAnchor="middle" className="shelfSvgSub">
                  Q{i}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="shelfLfsrRegs">
          <div className="shelfSub">count[3:0]</div>
          <BitRow value={count} width={N} labels />
          <div className="demoMono shelfState">next = {`{~count[0], count[3:1]}`} = {bin(johnsonStep(count, N), N)}</div>
          <div className="shelfSub">load_cnt (loaded while preset is low)</div>
          <BitRow value={loadCnt} width={N} labels onToggle={(i) => setLoadCnt((v) => v ^ (1 << i))} />
          <div className="demoControls">
            <button type="button" className="demoBtn" onClick={() => setCount(loadCnt)}>
              preset ↓
            </button>
            <button type="button" className="demoBtn" onClick={() => setCount(0)}>
              clear ↓ (async)
            </button>
          </div>
          <div className="shelfSeq">
            {seq.map((s, k) => (
              <span key={k} className={`shelfSeqItem demoMono ${k === 0 ? "isCurrent" : ""}`}>
                {bin(s, N)}
              </span>
            ))}
          </div>
          <div className={`shelfVerdict ${onCanonical ? "isGood" : "isWarn"}`}>
            {onCanonical ? "on the 8-state Johnson cycle" : "loaded off-cycle: the other 8-state orbit"}
          </div>
        </div>
      </div>
      <PlayControls
        running={pb.running}
        onToggle={pb.toggle}
        onStep={() => setCount((c) => johnsonStep(c, N))}
        onReset={() => setCount(0)}
        reduced={pb.reduced}
        speed={speed}
        onSpeed={setSpeed}
        speedLabel="clocks/s"
        min={1}
        max={20}
      />
      <p className="demoNote">
        A twisted ring: the inverted last stage feeds the first, so n flip-flops give 2n states with one bit changing
        per clock. The testbench loads 1000 through preset and checks 49 values against right.txt.
      </p>
    </div>
  );
}
