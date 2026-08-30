"use client";

import { useCallback, useState } from "react";
import { usePlayback, useTicker } from "../hooks";
import { convEncOutputs, convEncStep, type ConvEncState } from "../models/convenc";
import { Bit, BitRow, PlayControls, bin } from "../ui";

const N = 4;
// input pattern from conv_enc_tb.sv ("sequence from thesis"), replayed when running
const PATTERN = [1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 0];
const CELL = 34;
const PITCH = 46;
const LEFT = 60;

interface Sim {
  s: ConvEncState;
  pos: number;
  emitted: [number, number][];
  lastIn: number | null;
}

export default function ConvEncWidget() {
  const [mask0, setMask0] = useState(0o17);
  const [mask1, setMask1] = useState(0o13);
  const [sim, setSim] = useState<Sim>({ s: { history: 0, out: [0, 0] }, pos: 0, emitted: [], lastIn: null });
  const [speed, setSpeed] = useState(2);
  const pb = usePlayback(false);

  const shiftIn = useCallback(
    (bit: number) =>
      setSim((p) => {
        const s = convEncStep(p.s, bit, mask0, mask1, N);
        const emitted = [...p.emitted, s.out].slice(-16);
        return { s, pos: p.pos, emitted, lastIn: bit };
      }),
    [mask0, mask1],
  );
  const patternStep = useCallback(
    (k: number) =>
      setSim((p) => {
        let { s, pos, emitted, lastIn } = p;
        for (let i = 0; i < k; i++) {
          const bit = PATTERN[pos % PATTERN.length];
          s = convEncStep(s, bit, mask0, mask1, N);
          emitted = [...emitted, s.out].slice(-16);
          pos += 1;
          lastIn = bit;
        }
        return { s, pos, emitted, lastIn };
      }),
    [mask0, mask1],
  );
  useTicker(pb.running, speed, patternStep);

  const out = convEncOutputs(sim.s.history, mask0, mask1);
  const xOf = (i: number) => LEFT + (N - 1 - i) * PITCH;
  const yReg = 34;
  const yXor = 128;
  const xorX = [LEFT + N * PITCH + 30, LEFT + N * PITCH + 90];

  return (
    <div className="shelfWidget">
      <div className="demoControls">
        <span className="shelfSub">data_in</span>
        <button type="button" className="demoBtn" onClick={() => shiftIn(0)}>
          shift in 0
        </button>
        <button type="button" className="demoBtn" onClick={() => shiftIn(1)}>
          shift in 1
        </button>
        <span className="demoMono shelfState">last in: {sim.lastIn ?? "—"}</span>
      </div>
      <svg className="shelfSvg shelfConv" viewBox={`0 0 ${LEFT + N * PITCH + 130} 170`} role="img" aria-label="Convolutional encoder">
        <text x={4} y={yReg + CELL / 2 + 4} className="shelfSvgLabel">
          history
        </text>
        <path d={`M${xOf(N - 1) - 26},${yReg + CELL / 2} L${xOf(N - 1)},${yReg + CELL / 2}`} className="shelfWire isActive" />
        <text x={xOf(N - 1) - 28} y={yReg - 4} className="shelfSvgSub">
          data_in ↓ MSB
        </text>
        {Array.from({ length: N }, (_, k) => N - 1 - k).map((i) => {
          const b = (sim.s.history >>> i) & 1;
          return (
            <g key={i}>
              <rect x={xOf(i)} y={yReg} width={CELL} height={CELL} rx={4} className={`shelfSvgBit ${b ? "isOn" : ""}`} />
              <text x={xOf(i) + CELL / 2} y={yReg + CELL / 2 + 5} textAnchor="middle" className="shelfSvgBitText">
                {b}
              </text>
              <text x={xOf(i) + CELL / 2} y={yReg + CELL + 14} textAnchor="middle" className="shelfSvgSub">
                h{i}
              </text>
              {i > 0 && (
                <path d={`M${xOf(i) + CELL},${yReg + CELL / 2} L${xOf(i - 1)},${yReg + CELL / 2}`} className="shelfWire isPass" />
              )}
              {[mask0, mask1].map((m, k) =>
                (m >>> i) & 1 ? (
                  <path
                    key={k}
                    d={`M${xOf(i) + CELL / 2},${yReg + CELL} C${xOf(i) + CELL / 2},${yXor - 20} ${xorX[k]},${yXor - 40} ${xorX[k]},${yXor - 12}`}
                    className={`shelfWire ${b ? "isActive" : ""}`}
                  />
                ) : null,
              )}
            </g>
          );
        })}
        {xorX.map((x, k) => (
          <g key={k}>
            <circle cx={x} cy={yXor} r={12} className="shelfXor" />
            <text x={x} y={yXor + 4} textAnchor="middle" className="shelfSvgSub">
              ⊕
            </text>
            <rect x={x - 12} y={yXor + 20} width={24} height={20} rx={3} className={`shelfSvgBit ${out[k] ? "isOn" : ""}`} />
            <text x={x} y={yXor + 34} textAnchor="middle" className="shelfSvgBitText">
              {out[k]}
            </text>
            <text x={x} y={yXor + 54} textAnchor="middle" className="shelfSvgSub">
              data_out[{k}]
            </text>
          </g>
        ))}
      </svg>
      <div className="shelfRowFlex">
        <div>
          <div className="shelfSub">mask0 (load_mask = 01)</div>
          <BitRow value={mask0} width={N} labels onToggle={(i) => setMask0((m) => m ^ (1 << i))} />
          <div className="shelfSub">mask1 (load_mask = 10)</div>
          <BitRow value={mask1} width={N} labels onToggle={(i) => setMask1((m) => m ^ (1 << i))} />
        </div>
        <div>
          <div className="shelfSub">symbols emitted (data_out[1] data_out[0])</div>
          <div className="shelfSeq">
            {sim.emitted.length ? (
              sim.emitted.map((p, k) => (
                <span key={k} className={`shelfSeqItem demoMono ${k === sim.emitted.length - 1 ? "isCurrent" : ""}`}>
                  {p[1]}
                  {p[0]}
                </span>
              ))
            ) : (
              <span className="demoNote">nothing shifted in yet</span>
            )}
          </div>
          <div className="demoMono shelfState">
            data_out[0] = ^(mask0 &amp; history) = ^({bin(mask0 & sim.s.history, N)}) = {out[0]} · data_out[1] = ^(
            {bin(mask1 & sim.s.history, N)}) = {out[1]}
          </div>
          <span className="shelfBitRow">
            <Bit value={out[1]} label="out1" />
            <Bit value={out[0]} label="out0" />
          </span>
        </div>
      </div>
      <PlayControls
        running={pb.running}
        onToggle={pb.toggle}
        onStep={() => patternStep(1)}
        onReset={() => setSim({ s: { history: 0, out: [0, 0] }, pos: 0, emitted: [], lastIn: null })}
        reduced={pb.reduced}
        speed={speed}
        onSpeed={setSpeed}
        speedLabel="bits/s"
        min={1}
        max={10}
      />
      <p className="demoNote">
        Rate 1/2: every input bit produces two output bits, each the parity of the history under one mask (octal 17 and
        13 in the testbench). This is the encoder the Viterbi decoder above undoes.
      </p>
    </div>
  );
}
