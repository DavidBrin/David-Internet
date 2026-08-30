"use client";

import { useState } from "react";
import { useChangeKey } from "../hooks";
import { decoder2to4, fullAdder, mux2, STYLES, type Style } from "../models/threeStyles";
import { Bit, bin } from "../ui";

export type Circuit = "decoder" | "fulladder" | "mux";

const STYLE_NOTE: Record<Style, string> = {
  gate: "not / and / or / xor primitives wired by name",
  dataflow: "assign with boolean operators",
  behavioral: "always block with case / if / +",
};

interface Row {
  inputs: string;
  outputs: Record<Style, number[]>;
  outputLabels: string[];
  inputLabels: string[];
  inputBits: number[];
}

function evaluate(circuit: Circuit, v: number): Row {
  if (circuit === "decoder") {
    const sel = v & 3;
    const r = decoder2to4(sel);
    const bits = (x: number) => [3, 2, 1, 0].map((i) => (x >>> i) & 1);
    return {
      inputs: bin(sel, 2),
      inputLabels: ["sel1", "sel0"],
      inputBits: [(sel >> 1) & 1, sel & 1],
      outputLabels: ["out3", "out2", "out1", "out0"],
      outputs: { gate: bits(r.gate), dataflow: bits(r.dataflow), behavioral: bits(r.behavioral) },
    };
  }
  if (circuit === "fulladder") {
    const a = v & 1;
    const b = (v >> 1) & 1;
    const cin = (v >> 2) & 1;
    const r = fullAdder(a, b, cin);
    return {
      inputs: `${a}${b}${cin}`,
      inputLabels: ["a", "b", "cin"],
      inputBits: [a, b, cin],
      outputLabels: ["cout", "sum"],
      outputs: {
        gate: [r.gate.cout, r.gate.sum],
        dataflow: [r.dataflow.cout, r.dataflow.sum],
        behavioral: [r.behavioral.cout, r.behavioral.sum],
      },
    };
  }
  const in0 = v & 1;
  const in1 = (v >> 1) & 1;
  const sel = (v >> 2) & 1;
  const r = mux2(in0, in1, sel);
  return {
    inputs: `${sel}${in1}${in0}`,
    inputLabels: ["sel", "in1", "in0"],
    inputBits: [sel, in1, in0],
    outputLabels: ["out"],
    outputs: { gate: [r.gate], dataflow: [r.dataflow], behavioral: [r.behavioral] },
  };
}

const INPUT_COUNT: Record<Circuit, number> = { decoder: 2, fulladder: 3, mux: 3 };

export default function ThreeStylesWidget({
  circuit,
  onCircuit,
}: {
  circuit: Circuit;
  onCircuit: (c: Circuit) => void;
}) {
  const [vector, setVector] = useState(0b011);
  const nIn = INPUT_COUNT[circuit];
  const v = vector & ((1 << nIn) - 1);
  const row = evaluate(circuit, v);
  const pulse = useChangeKey(`${circuit}|${v}`);
  const agree = STYLES.every((s) => row.outputs[s].join("") === row.outputs.gate.join(""));

  // toggle the k-th input as listed in inputLabels (MSB first)
  const toggle = (k: number) => {
    const bit = nIn - 1 - k;
    setVector((x) => x ^ (1 << bit));
  };

  return (
    <div className="shelfWidget">
      <div className="demoControls">
        <label>
          circuit
          <select value={circuit} onChange={(e) => onCircuit(e.target.value as Circuit)}>
            <option value="decoder">2-to-4 decoder</option>
            <option value="fulladder">full adder</option>
            <option value="mux">2×1 mux</option>
          </select>
        </label>
        <span className="shelfSub">inputs</span>
        <span className="shelfBitRow">
          {row.inputLabels.map((l, k) => (
            <Bit key={l} value={row.inputBits[k]} label={l} onClick={() => toggle(k)} />
          ))}
        </span>
      </div>
      <div className="shelfStyles" key={pulse}>
        {STYLES.map((s) => (
          <div key={s} className="shelfStyleCol">
            <div className="shelfStyleHead">{s}</div>
            <div className="demoNote">{STYLE_NOTE[s]}</div>
            <span className="shelfBitRow shelfPulseBits">
              {row.outputs[s].map((b, k) => (
                <Bit key={k} value={b} label={row.outputLabels[k]} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className={`shelfVerdict ${agree ? "isGood" : "isWarn"}`}>
        {agree ? "all three styles light identically" : "styles disagree"}
      </div>
      <table className="shelfTruth demoMono">
        <thead>
          <tr>
            <th>{row.inputLabels.join(" ")}</th>
            {STYLES.map((s) => (
              <th key={s}>
                {s}: {row.outputLabels.join(" ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 1 << nIn }, (_, i) => evaluate(circuit, i)).map((r, i) => (
            <tr key={i} className={i === v ? "isCurrent" : ""} onClick={() => setVector(i)}>
              <td>{r.inputs}</td>
              {STYLES.map((s) => (
                <td key={s}>{r.outputs[s].join("")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
