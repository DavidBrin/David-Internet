"use client";

import { useState } from "react";
import { useChangeKey } from "../hooks";
import { ALU_OPS, ALU_OP_TEXT, alu16, aluFlags, toSigned16, type AluOp } from "../models/alu";
import { Bit, BitRow, bin, hex } from "../ui";

function parseNum(s: string, fallback: number): number {
  const t = s.trim();
  if (!t) return 0;
  const v = /^-?0x/i.test(t) ? parseInt(t, 16) : Number(t);
  return Number.isFinite(v) ? Math.trunc(v) : fallback;
}

export default function AluWidget() {
  const [op, setOp] = useState<AluOp>("AADD");
  const [aText, setAText] = useState("-8");
  const [bText, setBText] = useState("2");
  const a = parseNum(aText, 0) & 0xffff;
  const b = parseNum(bText, 0) & 0xffff;
  const r = alu16(op, a, b);
  const flags = aluFlags(op, a, b, r);
  const pulse = useChangeKey(`${op}|${a}|${b}`);

  return (
    <div className="shelfWidget">
      <div className="demoControls">
        <label>
          cmd
          <select value={op} onChange={(e) => setOp(e.target.value as AluOp)}>
            {ALU_OPS.map((o, i) => (
              <option key={o} value={o}>
                {o} ({bin(i, 3)})
              </option>
            ))}
          </select>
        </label>
        <label>
          a (signed)
          <input className="shelfNumInput demoMono" value={aText} onChange={(e) => setAText(e.target.value)} />
        </label>
        <label>
          b
          <input className="shelfNumInput demoMono" value={bText} onChange={(e) => setBText(e.target.value)} />
        </label>
        <span className="demoMono shelfState">{ALU_OP_TEXT[op]}</span>
      </div>
      <svg className="shelfSvg shelfAlu" viewBox="0 0 460 150" role="img" aria-label="ALU datapath" key={pulse}>
        <rect x={10} y={20} width={120} height={30} rx={4} className="shelfSvgBox" />
        <text x={70} y={39} textAnchor="middle" className="shelfSvgMono">
          a = {hex(a, 16)}
        </text>
        <rect x={10} y={100} width={120} height={30} rx={4} className="shelfSvgBox" />
        <text x={70} y={119} textAnchor="middle" className="shelfSvgMono">
          b = {hex(b, 16)}
        </text>
        <path d="M130,35 L200,35" className="shelfWire isPulse" />
        <path d="M130,115 L200,115" className="shelfWire isPulse" />
        <path d="M200,15 L280,45 L280,105 L200,135 L200,85 L215,75 L200,65 Z" className="shelfSvgAluBody" />
        <text x={240} y={80} textAnchor="middle" className="shelfSvgLabel">
          {op}
        </text>
        <path d="M280,75 L340,75" className="shelfWire isPulse isLate" />
        <rect x={340} y={60} width={110} height={30} rx={4} className="shelfSvgBox isResult" />
        <text x={395} y={79} textAnchor="middle" className="shelfSvgMono">
          r = {hex(r, 16)}
        </text>
        <text x={240} y={20} textAnchor="middle" className="shelfSvgSub">
          cmd = {bin(ALU_OPS.indexOf(op), 3)}
        </text>
      </svg>
      <div className="shelfRowFlex">
        <div>
          <div className="shelfSub">r (16 bits)</div>
          <BitRow value={r} width={16} size="sm" />
          <div className="demoMono shelfState">
            {hex(r, 16)} · signed {toSigned16(r)} · unsigned {r}
          </div>
        </div>
        <div>
          <div className="shelfSub">flags (derived; alu_e outputs only r)</div>
          <span className="shelfBitRow">
            <Bit value={flags.zero ? 1 : 0} label="Z" />
            <Bit value={flags.negative ? 1 : 0} label="N" />
            <Bit value={flags.carry ? 1 : 0} label="C" />
            <Bit value={flags.overflow ? 1 : 0} label="V" />
          </span>
        </div>
      </div>
      <p className="demoNote">
        a is signed, so ASR (&gt;&gt;&gt;) copies the sign bit while ASRU (&gt;&gt;) shifts in zeros; try a = -8, b = 2 with
        both. Numbers accept decimal or 0x hex.
      </p>
    </div>
  );
}
