"use client";

import { useState } from "react";
import { usePlayback, useTicker } from "../hooks";
import { binaryToGray, grayChain, grayToBinary } from "../models/gray";
import { Bit, PlayControls, bin } from "../ui";

const N = 4;
const SECTORS = 1 << N;
const CX = 120;
const CY = 120;

function arc(r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => `${(CX + r * Math.cos(a)).toFixed(1)},${(CY + r * Math.sin(a)).toFixed(1)}`;
  return `M${p(r0, a0)} L${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)} Z`;
}

export default function GrayWidget() {
  const [pos, setPos] = useState(5);
  const [speed, setSpeed] = useState(2);
  const pb = usePlayback(true);
  useTicker(pb.running, speed, (k) => setPos((p) => (p + k) % SECTORS));

  const gray = binaryToGray(pos);
  const chain = grayChain(gray, N);
  const binary = grayToBinary(gray, N);
  const angle = (pos * 360) / SECTORS;

  return (
    <div className="shelfWidget">
      <div className="shelfRowFlex">
        <svg className="shelfSvg shelfWheel" viewBox="0 0 240 240" role="img" aria-label="Gray code wheel">
          {Array.from({ length: SECTORS }, (_, k) => {
            const a0 = -Math.PI / 2 + (2 * Math.PI * k) / SECTORS - Math.PI / SECTORS;
            const a1 = a0 + (2 * Math.PI) / SECTORS;
            const g = binaryToGray(k);
            const mid = (a0 + a1) / 2;
            return (
              <g key={k} className={`shelfSector ${k === pos ? "isCurrent" : ""}`} onClick={() => setPos(k)}>
                <path d={arc(62, 108, a0, a1)} className="shelfSectorPath" />
                <text
                  x={CX + 92 * Math.cos(mid)}
                  y={CY + 92 * Math.sin(mid) + 3}
                  textAnchor="middle"
                  className="shelfSvgMono shelfSectorGray"
                >
                  {bin(g, N)}
                </text>
                <text
                  x={CX + 74 * Math.cos(mid)}
                  y={CY + 74 * Math.sin(mid) + 3}
                  textAnchor="middle"
                  className="shelfSvgSub"
                >
                  {k}
                </text>
              </g>
            );
          })}
          <g className="shelfPointer" style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
            <line x1={CX} y1={CY} x2={CX} y2={CY - 56} className="shelfPointerLine" />
            <circle cx={CX} cy={CY - 56} r={4} className="shelfPointerTip" />
          </g>
          <circle cx={CX} cy={CY} r={5} className="shelfPointerHub" />
        </svg>
        <div className="shelfLfsrRegs">
          <div className="shelfSub">gray_value (input register)</div>
          <span className="shelfBitRow">
            {chain.map((c) => (
              <Bit key={c.i} value={c.g} label={`g${c.i}`} />
            ))}
          </span>
          <div className="shelfChain demoMono">
            {chain.map((c, k) => (
              <div key={c.i} className="shelfChainRow">
                b{c.i} = {k === 0 ? `g${c.i}` : `b${c.i + 1} ⊕ g${c.i}`} = {c.b}
              </div>
            ))}
          </div>
          <div className="shelfSub">binary_value (output register)</div>
          <span className="shelfBitRow">
            {chain.map((c) => (
              <Bit key={c.i} value={c.b} label={`b${c.i}`} />
            ))}
          </span>
          <div className="demoMono shelfState">
            gray {bin(gray, N)} → binary {bin(binary, N)} = {binary}
          </div>
        </div>
      </div>
      <PlayControls
        running={pb.running}
        onToggle={pb.toggle}
        onStep={() => setPos((p) => (p + 1) % SECTORS)}
        reduced={pb.reduced}
        speed={speed}
        onSpeed={setSpeed}
        speedLabel="steps/s"
        min={1}
        max={12}
      />
      <p className="demoNote">
        Adjacent positions differ in one Gray bit, so a mechanical encoder never reads a half-changed word. The RTL
        registers both ends: binary_value appears two clocks after gray_value.
      </p>
    </div>
  );
}
