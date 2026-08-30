"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlayback, useTicker } from "../hooks";
import { defaultTap, lfsrSequence, parity } from "../models/lfsr";
import { BitRow, PlayControls, bin } from "../ui";

const R = 92;
const CX = 110;
const CY = 110;

export default function LfsrWidget() {
  const [n, setN] = useState(4);
  const [taps, setTaps] = useState(defaultTap(4));
  const [seed, setSeed] = useState(0b1111);
  const [pos, setPos] = useState({ idx: 0, laps: 0 });
  const [speed, setSpeed] = useState(6);
  const pb = usePlayback(true);

  const seq = useMemo(() => lfsrSequence(seed, taps, n), [seed, taps, n]);
  const len = seq.states.length;
  const { idx, laps } = pos;
  const state = seq.states[idx % len];
  const feedback = parity(state & taps);

  const step = useCallback(
    (k: number) => {
      setPos((p) => {
        let { idx: next, laps: l } = p;
        for (let s = 0; s < k; s++) {
          next += 1;
          if (next >= len) {
            if (seq.period === null) next = len - 1; // stuck in a short cycle: hold the last state
            else {
              next = 0;
              l += 1;
            }
          }
        }
        return { idx: next, laps: l };
      });
    },
    [len, seq.period],
  );
  useTicker(pb.running, speed, step);

  const reset = () => setPos({ idx: 0, laps: 0 });
  const changeN = (v: number) => {
    setN(v);
    setTaps(defaultTap(v));
    setSeed((1 << v) - 1);
    reset();
  };
  useEffect(() => setPos({ idx: 0, laps: 0 }), [seed, taps]);

  const done = idx === 0 && laps > 0;
  const full = (1 << n) - 1;

  const pts = seq.states.map((_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / (seq.period ?? len);
    return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
  });
  const path = pts
    .slice(0, Math.min(idx + 1, pts.length))
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className="shelfWidget">
      <div className="demoControls">
        <label>
          N
          <select value={n} onChange={(e) => changeN(Number(e.target.value))}>
            {[2, 3, 4, 5, 6, 7, 8].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="demoBtn" onClick={() => setTaps(defaultTap(n))}>
          Default taps
        </button>
        <span className="demoNote">click bits to edit the seed and tap pattern</span>
      </div>
      <div className="shelfRowFlex">
        <svg className="shelfSvg shelfRing" viewBox="0 0 220 220" role="img" aria-label="LFSR state sequence around a circle">
          <circle cx={CX} cy={CY} r={R} className="shelfRingTrack" />
          <path d={path} className="shelfRingPath" />
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={len > 100 ? 1.6 : len > 40 ? 2.4 : 3.5}
              className={`shelfRingDot ${i <= idx ? "isVisited" : ""} ${i === idx % len ? "isCurrent" : ""}`}
            />
          ))}
          <text x={CX} y={CY - 10} textAnchor="middle" className="shelfSvgMono">
            {bin(state, n)}
          </text>
          <text x={CX} y={CY + 10} textAnchor="middle" className="shelfSvgSub">
            step {idx} / {seq.period ?? "∞"}
          </text>
          <text x={CX} y={CY + 30} textAnchor="middle" className={`shelfDone ${done ? "isFlash" : ""}`} key={laps}>
            {done ? "lfsr_done = 1" : ""}
          </text>
        </svg>
        <div className="shelfLfsrRegs">
          <div className="shelfSub">lfsr_data (shift left, feedback into bit 0)</div>
          <BitRow value={state} width={n} labels />
          <div className="shelfSub">tap_ptrn (load[0])</div>
          <BitRow value={taps} width={n} labels onToggle={(i) => setTaps((t) => t ^ (1 << i))} />
          <div className="shelfSub">seed (load[1])</div>
          <BitRow value={seed} width={n} labels onToggle={(i) => setSeed((s) => s ^ (1 << i))} />
          <div className="demoMono shelfState">
            feedback = ^(lfsr_data &amp; tap_ptrn) = {feedback} → next {bin(((state << 1) & full) | feedback, n)}
          </div>
          <div className={`shelfVerdict ${seq.maximal ? "isGood" : "isWarn"}`}>
            {seq.period === null
              ? `never returns to the seed (falls into a short cycle, e.g. seed 0 sticks)`
              : `period ${seq.period} of ${full} → ${seq.maximal ? "maximal length" : "not maximal"}`}
          </div>
        </div>
      </div>
      <PlayControls
        running={pb.running}
        onToggle={pb.toggle}
        onStep={() => step(1)}
        onReset={reset}
        reduced={pb.reduced}
        speed={speed}
        onSpeed={setSpeed}
        speedLabel="clocks/s"
        min={1}
        max={40}
      />
      <p className="demoNote">
        Default taps are primitive polynomials, so every non-zero seed walks all 2^N−1 states before lfsr_done fires.
        Most other tap patterns close a shorter loop.
      </p>
    </div>
  );
}
