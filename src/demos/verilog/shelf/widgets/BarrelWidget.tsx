"use client";

import { useState } from "react";
import { barrelShift, type ShiftDir } from "../models/barrel";
import { bin, hex } from "../ui";

const N = 8;
const CELL = 30;
const PITCH = 40;
const LEFT = 118;
const ROW = 66;

function xOf(i: number): number {
  return LEFT + (N - 1 - i) * PITCH;
}

export default function BarrelWidget() {
  const [din, setDin] = useState(0b10110110);
  const [amount, setAmount] = useState(3);
  const [dir, setDir] = useState<ShiftDir>("right");
  const [rotate, setRotate] = useState(false);
  const r = barrelShift(N, din, amount, dir, rotate);
  const rows = [r.input, ...r.stages.map((s) => s.bits)];
  const height = ROW * rows.length + 20;
  const width = LEFT + N * PITCH + 10;

  return (
    <div className="shelfWidget">
      <div className="demoControls">
        <label>
          shift_value
          <input type="range" min={0} max={N - 1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <span className="demoMono shelfSpeed">
            {amount} = {bin(amount, 3)}
          </span>
        </label>
        <label>
          direction
          <select value={dir} onChange={(e) => setDir(e.target.value as ShiftDir)}>
            <option value="right">right (0)</option>
            <option value="left">left (1)</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} /> select = rotate
        </label>
        <span className="demoNote">click the din bits to edit</span>
      </div>
      <svg className="shelfSvg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Barrel shifter mux stages">
        {rows.map((bits, row) => {
          const y = 14 + row * ROW;
          const stage = row > 0 ? r.stages[row - 1] : null;
          const label =
            row === 0
              ? "din"
              : `${row === rows.length - 1 ? "dout ← " : ""}stage ${row - 1}: ${dir === "right" ? ">>" : "<<"} ${stage!.distance}`;
          return (
            <g key={row}>
              <text x={6} y={y + CELL / 2 + 4} className="shelfSvgLabel">
                {label}
              </text>
              {stage && (
                <text x={6} y={y + CELL / 2 + 18} className="shelfSvgSub">
                  sel = shift_value[{row - 1}] = {stage.active ? 1 : 0}
                </text>
              )}
              {row === rows.length - 1 && (
                <text x={6} y={y + CELL + 16} className="shelfSvgSub">
                  dout = {bin(r.out, N)}
                </text>
              )}
              {stage &&
                stage.source.map((src, i) => {
                  const from = stage.active ? src : i;
                  const active = stage.active && from !== i;
                  const x2 = xOf(i) + CELL / 2;
                  const y2 = y;
                  const y1 = y - ROW + CELL;
                  if (from < 0) {
                    return (
                      <g key={i}>
                        <line x1={x2} y1={y1 + 10} x2={x2} y2={y2} className="shelfWire isZero" />
                        <text x={x2} y={y1 + 9} className="shelfSvgZero" textAnchor="middle">
                          0
                        </text>
                      </g>
                    );
                  }
                  const x1 = xOf(from) + CELL / 2;
                  return (
                    <path
                      key={i}
                      d={`M${x1},${y1} C${x1},${y1 + 18} ${x2},${y2 - 18} ${x2},${y2}`}
                      className={`shelfWire ${active ? "isActive" : ""} ${stage.active ? "" : "isPass"}`}
                    />
                  );
                })}
              {bits.map((b, i) => (
                <g
                  key={i}
                  className={row === 0 ? "shelfSvgClickable" : undefined}
                  onClick={row === 0 ? () => setDin((d) => d ^ (1 << i)) : undefined}
                >
                  <rect x={xOf(i)} y={y} width={CELL} height={CELL} rx={4} className={`shelfSvgBit ${b ? "isOn" : ""}`} />
                  <text x={xOf(i) + CELL / 2} y={y + CELL / 2 + 5} textAnchor="middle" className="shelfSvgBitText">
                    {b}
                  </text>
                  {row === 0 && (
                    <text x={xOf(i) + CELL / 2} y={y - 4} textAnchor="middle" className="shelfSvgSub">
                      {i}
                    </text>
                  )}
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <p className="demoNote demoMono">
        din {hex(din, 8)} → dout {hex(r.out, 8)} · each stage is a row of 2×1 muxes: bit i takes din[i] or the bit 2^k
        away, selected by shift_value[k]; three stages cover 0..7.
      </p>
    </div>
  );
}
