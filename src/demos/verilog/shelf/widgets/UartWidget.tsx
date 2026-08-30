"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayback, useTicker } from "../hooks";
import { Bit, BitRow, PlayControls, bin, hex } from "../ui";
import {
  uartRxReset,
  uartRxStep,
  uartTxReset,
  uartTxStep,
  type TxState,
  type UartRxState,
  type UartTxState,
} from "../models/uart";

const SCOPE_SAMPLES = 360;

interface Sample {
  level: 0 | 1;
  state: TxState;
  /** rx sampled a data bit on this clock */
  rxSample: boolean;
  /** rx accepted the start bit on this clock */
  rxStart: boolean;
}

interface Sim {
  tx: UartTxState;
  rx: UartRxState;
  pending: boolean;
  samples: Sample[];
  received: number[];
  clock: number;
}

function freshSim(): Sim {
  return {
    tx: uartTxStep(uartTxReset(), 0, false, 16), // one idle clock so tx = 1
    rx: uartRxReset(),
    pending: false,
    samples: [],
    received: [],
    clock: 0,
  };
}

const STATE_COLOR: Record<TxState, string> = {
  IDLE: "#9aa0a6",
  START: "#0EA5E9",
  DATA: "#202124",
  STOP: "#188038",
  CLEANUP: "#9aa0a6",
};

export default function UartWidget() {
  const [text, setText] = useState("K");
  const [clksPerBit, setClksPerBit] = useState(16);
  const [speed, setSpeed] = useState(160);
  const [repeat, setRepeat] = useState(true);
  const pb = usePlayback(true);
  const sim = useRef<Sim>(freshSim());
  const [, setVersion] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const byte = text.length ? text.charCodeAt(0) & 0xff : 0;

  const clock = useCallback(
    (n: number) => {
      const s = sim.current;
      for (let i = 0; i < n; i++) {
        if (s.tx.state === "IDLE" && !s.pending && repeat) s.pending = true;
        const start = s.pending && s.tx.state === "IDLE";
        if (start) s.pending = false;
        const wire = s.tx.tx;
        const before = s.tx.state;
        const rxBefore = s.rx;
        s.tx = uartTxStep(s.tx, byte, start, clksPerBit);
        s.rx = uartRxStep(rxBefore, wire, clksPerBit);
        const rxSample = rxBefore.state === "DATA" && rxBefore.count === clksPerBit - 1;
        const rxStart = rxBefore.state === "START" && s.rx.state === "DATA";
        s.samples.push({ level: wire, state: before, rxSample, rxStart });
        if (s.samples.length > SCOPE_SAMPLES) s.samples.splice(0, s.samples.length - SCOPE_SAMPLES);
        if (s.rx.done) {
          s.received.push(s.rx.dout);
          if (s.received.length > 12) s.received.shift();
        }
        s.clock++;
      }
      setVersion((v) => v + 1);
    },
    [byte, clksPerBit, repeat],
  );

  useTicker(pb.running, speed, clock);

  const reset = () => {
    sim.current = freshSim();
    setVersion((v) => v + 1);
  };

  // scope
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 480;
    const cssH = 96;
    if (canvas.width !== Math.round(cssW * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const yHi = 22;
    const yLo = 62;
    const px = cssW / SCOPE_SAMPLES;
    const samples = sim.current.samples;
    const x0 = cssW - samples.length * px;
    // baud grid
    ctx.strokeStyle = "#f1f3f4";
    ctx.lineWidth = 1;
    for (let i = 0; i < samples.length; i += clksPerBit) {
      const x = x0 + i * px;
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, 74);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const x = x0 + i * px;
      const y = s.level ? yHi : yLo;
      ctx.strokeStyle = STATE_COLOR[s.state];
      ctx.beginPath();
      if (i > 0 && samples[i - 1].level !== s.level) {
        ctx.moveTo(x, samples[i - 1].level ? yHi : yLo);
        ctx.lineTo(x, y);
      } else ctx.moveTo(x, y);
      ctx.lineTo(x + px, y);
      ctx.stroke();
      if (s.rxSample || s.rxStart) {
        ctx.fillStyle = s.rxStart ? "#0EA5E9" : "#d93025";
        ctx.beginPath();
        ctx.arc(x + px / 2, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#5f6368";
    ctx.font = "11px Arial";
    ctx.fillText("tx", 4, yHi - 6);
    ctx.fillText("1", 4, yHi + 4);
    ctx.fillText("0", 4, yLo + 4);
    ctx.fillText(`clock ${sim.current.clock}`, cssW - 80, 88);
  });

  const s = sim.current;
  const rxBitsSoFar = s.rx.state === "DATA" ? s.rx.bitIndex : s.rx.state === "STOP" ? 8 : 0;

  return (
    <div className="shelfWidget">
      <div className="demoControls">
        <label>
          char
          <input
            className="shelfCharInput demoMono"
            value={text}
            maxLength={1}
            onChange={(e) => setText(e.target.value.slice(-1))}
          />
          <span className="demoMono">{hex(byte, 8)}</span>
        </label>
        <label>
          clocks / bit
          <input type="range" min={4} max={32} value={clksPerBit} onChange={(e) => setClksPerBit(Number(e.target.value))} />
          <span className="demoMono shelfSpeed">{clksPerBit}</span>
        </label>
        <label>
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /> keep sending
        </label>
        <button
          type="button"
          className="demoBtn"
          onClick={() => {
            sim.current.pending = true;
            clock(1);
          }}
        >
          Send once
        </button>
      </div>
      <canvas ref={canvasRef} className="shelfScope" height={96} aria-label="UART tx line on a scope" />
      <div className="shelfLegend">
        <span style={{ color: STATE_COLOR.START }}>■ start</span>
        <span style={{ color: STATE_COLOR.DATA }}>■ data d0..d7</span>
        <span style={{ color: STATE_COLOR.STOP }}>■ stop</span>
        <span style={{ color: STATE_COLOR.IDLE }}>■ idle</span>
        <span style={{ color: "#0EA5E9" }}>● rx start check</span>
        <span style={{ color: "#d93025" }}>● rx sample</span>
      </div>
      <div className="shelfRowFlex">
        <div>
          <div className="shelfSub">uart_tx</div>
          <div className="demoMono shelfState">
            {s.tx.state} · count {s.tx.count} · bit {s.tx.bitIndex} · tx={s.tx.tx}
          </div>
          <BitRow value={byte} width={8} labels prefix="d" size="sm" />
        </div>
        <div>
          <div className="shelfSub">uart_rx</div>
          <div className="demoMono shelfState">
            {s.rx.state} · count {s.rx.count} · done={s.rx.done ? 1 : 0}
          </div>
          <span className="shelfBitRow">
            {Array.from({ length: 8 }, (_, k) => 7 - k).map((i) => (
              <Bit
                key={i}
                value={(s.rx.dout >>> i) & 1}
                label={`d${i}`}
                size="sm"
                title={i < rxBitsSoFar ? "sampled" : "not yet sampled"}
              />
            ))}
          </span>
          <div className="demoMono shelfState">
            dout {bin(s.rx.dout, 8)} · received:{" "}
            {s.received.length ? s.received.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : hex(b, 8))).join(" ") : "—"}
          </div>
        </div>
      </div>
      <PlayControls
        running={pb.running}
        onToggle={pb.toggle}
        onStep={() => clock(clksPerBit)}
        onReset={reset}
        reduced={pb.reduced}
        speed={speed}
        onSpeed={setSpeed}
        speedLabel="clocks/s"
        min={20}
        max={600}
      />
      <p className="demoNote">
        Step = one bit period. NUM_CLKS_PER_BIT = f_clk / baud (16 in the testbench; 434 for 50 MHz at 115200). The
        receiver confirms the start bit at its midpoint, then samples once per bit period.
      </p>
    </div>
  );
}
