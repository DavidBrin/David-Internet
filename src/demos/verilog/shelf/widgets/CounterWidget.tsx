"use client";

import { useCallback, useState } from "react";
import { usePlayback, useTicker } from "../hooks";
import { counterStep } from "../models/counter";
import { Bit, BitRow, PlayControls, bin } from "../ui";

const WIDTH = 4;

export default function CounterWidget() {
  const [reg, setReg] = useState({ count: 0, clk: 0 });
  const [clear, setClear] = useState(false);
  const [speed, setSpeed] = useState(8);
  const pb = usePlayback(true);
  const { count, clk } = reg;

  // one step = one clock half-period; the counter increments on the rising edge
  const halfCycle = useCallback(
    (k: number) =>
      setReg((r) => {
        let { count: c, clk: level } = r;
        for (let i = 0; i < k; i++) {
          level ^= 1;
          if (level === 1) c = counterStep(c, WIDTH, clear);
        }
        return { count: c, clk: level };
      }),
    [clear],
  );
  useTicker(pb.running, speed, halfCycle);
  const setCount = (v: number) => setReg((r) => ({ ...r, count: v }));

  const shown = clear ? 0 : count;

  return (
    <div className="shelfWidget">
      <div className="shelfCounter">
        <div className="shelfCounterClk">
          <span className="shelfSub">clk</span>
          <span className={`shelfClkLamp ${clk ? "isOn" : ""}`} />
          <span className="demoMono shelfState">{clk ? "posedge → cnt_value + 1" : "low"}</span>
        </div>
        <div className="shelfCounterRegs">
          <span className="shelfSub">cnt_value[3:0]</span>
          <BitRow value={shown} width={WIDTH} labels prefix="q" />
          <span className="shelfCounterBig demoMono" key={shown}>
            {shown}
          </span>
          <span className="demoMono shelfState">
            {bin(shown, WIDTH)} → next {bin(counterStep(shown, WIDTH, clear), WIDTH)}
          </span>
        </div>
        <div className="shelfCounterClk">
          <span className="shelfSub">clear (async)</span>
          <Bit
            value={clear ? 1 : 0}
            onClick={() => {
              setClear((c) => !c);
              if (!clear) setCount(0);
            }}
          />
        </div>
      </div>
      <PlayControls
        running={pb.running}
        onToggle={pb.toggle}
        onStep={() => halfCycle(1)}
        onReset={() => setReg({ count: 0, clk: 0 })}
        reduced={pb.reduced}
        speed={speed}
        onSpeed={setSpeed}
        speedLabel="edges/s"
        min={1}
        max={40}
      />
      <p className="demoNote">
        always_ff @(posedge clk, posedge clear): clear forces 0 immediately (asynchronous); otherwise the register wraps
        15 → 0.
      </p>
    </div>
  );
}
