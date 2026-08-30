"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimJson, SimPreset, SimWindow } from "./simTypes";

interface Props {
  sim: SimJson | null;
  /** Cycle the trellis panel is currently on (input window); the viewer follows it when "follow" is on. */
  followCycle: number;
}

interface Lane {
  key: string;
  label: string;
  kind: "bit" | "bus";
  bits: number;
  values: (number | null)[];
  color?: string;
  /** For bus lanes: highlight nonzero values (error injector). */
  hot?: boolean;
}

const LANE_H = 22;
const LABEL_W = 118;
const INK = "#202124";
const MUTED = "#5f6368";
const LINE = "#dadce0";
const ACCENT = "#0EA5E9";
const ERR = "#d93025";

function lanesFor(win: SimWindow): Lane[] {
  const s = win.signals;
  const n = win.pathCost.length;
  const lanes: Lane[] = [
    { key: "clk", label: "clk", kind: "bit", bits: 1, values: Array.from({ length: n }, () => 1), color: MUTED },
    { key: "rst", label: "rst", kind: "bit", bits: 1, values: s.rst },
    { key: "enable_encoder_i", label: "enable_encoder_i", kind: "bit", bits: 1, values: s.enable_encoder_i },
    { key: "encoder_i", label: "encoder_i", kind: "bit", bits: 1, values: s.encoder_i, color: "#1a73e8" },
    { key: "encoder_o", label: "encoder_o[1:0]", kind: "bus", bits: 2, values: s.encoder_o },
    { key: "err_inj", label: "err_inj[1:0]", kind: "bus", bits: 2, values: s.err_inj, hot: true },
    { key: "encoder_o_reg", label: "encoder_o_reg[1:0]", kind: "bus", bits: 2, values: s.encoder_o_reg },
    { key: "enable_decoder_in", label: "enable_decoder_in", kind: "bit", bits: 1, values: s.enable_decoder_in },
    { key: "validity", label: "validity[7:0]", kind: "bus", bits: 8, values: s.validity },
  ];
  for (let i = 0; i < 8; i++) {
    lanes.push({ key: `pc${i}`, label: `path_cost[${i}]`, kind: "bus", bits: 8, values: win.pathCost.map((c) => c[i]) });
  }
  lanes.push(
    { key: "best_state", label: "best_state[2:0]", kind: "bus", bits: 3, values: s.best_state },
    { key: "best_metric", label: "best_metric[7:0]", kind: "bus", bits: 8, values: s.best_metric },
    { key: "d_out_raw", label: "d_out_raw", kind: "bit", bits: 1, values: s.d_out_raw },
    { key: "decoder_o", label: "decoder_o", kind: "bit", bits: 1, values: s.decoder_o, color: "#188038" },
  );
  return lanes;
}

function fmt(v: number | null, bits: number): string {
  if (v === null) return "x";
  if (bits <= 3) return v.toString(2).padStart(bits, "0");
  return v.toString();
}

export default function WavePanel({ sim, followCycle }: Props) {
  const [presetId, setPresetId] = useState("2a1");
  const [winId, setWinId] = useState("in");
  const [pxPerCycle, setPxPerCycle] = useState(14);
  const [offset, setOffset] = useState(0); // first visible cycle, relative to window start
  const [follow, setFollow] = useState(true);
  const [cursor, setCursor] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; offset: number } | null>(null);

  const preset: SimPreset | undefined = sim?.presets.find((p) => p.id === presetId) ?? sim?.presets[0];
  const win = preset?.windows.find((w) => w.id === winId) ?? preset?.windows[0];
  const lanes = useMemo(() => (win ? lanesFor(win) : []), [win]);
  const n = win?.pathCost.length ?? 0;

  useEffect(() => {
    if (!follow || winId !== "in" || !win) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const visible = Math.floor((wrap.clientWidth - LABEL_W) / pxPerCycle);
    const rel = followCycle - win.from;
    setOffset(Math.max(0, Math.min(n - visible, rel - Math.floor(visible * 0.7))));
  }, [followCycle, follow, winId, win, pxPerCycle, n]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !win) return;
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth;
    const H = lanes.length * LANE_H + 26;
    if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
    ctx.textBaseline = "middle";

    const visible = Math.ceil((W - LABEL_W) / pxPerCycle) + 1;
    const x0 = LABEL_W;
    const cycleX = (c: number) => x0 + (c - offset) * pxPerCycle;

    // time ruler
    ctx.fillStyle = MUTED;
    ctx.textAlign = "left";
    const tickEvery = pxPerCycle >= 24 ? 1 : pxPerCycle >= 10 ? 5 : 10;
    for (let c = offset; c < Math.min(n, offset + visible); c++) {
      const abs = win.from + c;
      if (abs % tickEvery === 0) {
        ctx.fillStyle = LINE;
        ctx.fillRect(cycleX(c), 20, 1, H - 20);
        ctx.fillStyle = MUTED;
        ctx.fillText(String(abs), cycleX(c) + 2, 10);
      }
    }

    lanes.forEach((lane, li) => {
      const yTop = 26 + li * LANE_H;
      const yHi = yTop + 4;
      const yLo = yTop + LANE_H - 5;
      ctx.fillStyle = li % 2 ? "#fafafa" : "#fff";
      ctx.fillRect(0, yTop, W, LANE_H);
      ctx.fillStyle = INK;
      ctx.textAlign = "left";
      ctx.font = "11px Arial, Helvetica, sans-serif";
      ctx.fillText(lane.label, 8, yTop + LANE_H / 2);
      ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
      ctx.strokeStyle = lane.color ?? INK;
      ctx.lineWidth = 1.2;

      if (lane.key === "clk") {
        ctx.beginPath();
        for (let c = offset; c < Math.min(n, offset + visible); c++) {
          const xa = cycleX(c);
          const xm = xa + pxPerCycle / 2;
          const xb = xa + pxPerCycle;
          ctx.moveTo(xa, yLo);
          ctx.lineTo(xa, yHi);
          ctx.lineTo(xm, yHi);
          ctx.lineTo(xm, yLo);
          ctx.lineTo(xb, yLo);
        }
        ctx.stroke();
        return;
      }

      if (lane.kind === "bit") {
        ctx.beginPath();
        let prev: number | null = null;
        for (let c = offset; c < Math.min(n, offset + visible); c++) {
          const v = lane.values[c];
          const xa = cycleX(c);
          const y = v === null ? (yHi + yLo) / 2 : v ? yHi : yLo;
          if (prev !== null && prev !== v) {
            ctx.lineTo(xa, prev ? yHi : yLo);
            ctx.lineTo(xa, y);
          } else if (c === offset) {
            ctx.moveTo(xa, y);
          }
          ctx.lineTo(xa + pxPerCycle, y);
          prev = v;
        }
        ctx.stroke();
      } else {
        // bus: hexagon-ish segments per run of equal values
        let c = offset;
        const end = Math.min(n, offset + visible);
        while (c < end) {
          const v = lane.values[c];
          let c2 = c + 1;
          while (c2 < end && lane.values[c2] === v) c2++;
          const xa = cycleX(c);
          const xb = cycleX(c2);
          const hot = lane.hot && v;
          ctx.strokeStyle = hot ? ERR : lane.color ?? INK;
          ctx.beginPath();
          ctx.moveTo(xa, (yHi + yLo) / 2);
          ctx.lineTo(xa + 3, yHi);
          ctx.lineTo(xb - 3, yHi);
          ctx.lineTo(xb, (yHi + yLo) / 2);
          ctx.lineTo(xb - 3, yLo);
          ctx.lineTo(xa + 3, yLo);
          ctx.closePath();
          if (hot) {
            ctx.fillStyle = "#fce8e6";
            ctx.fill();
          }
          ctx.stroke();
          const label = fmt(v, lane.bits);
          if (xb - xa > label.length * 7 + 8) {
            ctx.fillStyle = hot ? ERR : INK;
            ctx.textAlign = "center";
            ctx.fillText(label, (xa + xb) / 2, (yHi + yLo) / 2);
          }
          c = c2;
        }
      }
    });

    // cursor
    if (cursor !== null && cursor >= offset && cursor < offset + visible && cursor < n) {
      ctx.fillStyle = ACCENT;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(cycleX(cursor), 20, pxPerCycle, H - 20);
      ctx.globalAlpha = 1;
      ctx.fillRect(cycleX(cursor), 0, 1, H);
    }
  }, [lanes, win, pxPerCycle, offset, cursor, n]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const onMove = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (dragRef.current) {
      const dc = Math.round((dragRef.current.x - e.clientX) / pxPerCycle);
      setFollow(false);
      setOffset(Math.max(0, Math.min(n - 5, dragRef.current.offset + dc)));
      return;
    }
    if (x < LABEL_W) {
      setCursor(null);
      return;
    }
    setCursor(offset + Math.floor((x - LABEL_W) / pxPerCycle));
  };

  if (!sim || !preset || !win) {
    return (
      <p className="demoNote">
        No simulation results found (public/demos/verilog/viterbi.json). Run <code>pnpm sync-demos verilog</code> with
        Icarus Verilog installed.
      </p>
    );
  }

  const cursorAbs = cursor !== null ? win.from + cursor : null;

  return (
    <div className="wavePanel">
      <div className="demoControls">
        <label>
          run
          <select value={preset.id} onChange={(e) => setPresetId(e.target.value)}>
            {sim.presets
              .filter((p) => !p.id.startsWith("sweep"))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.status === "pass" ? "✓" : "✗"} {p.good}/{p.good + p.bad}
                </option>
              ))}
          </select>
        </label>
        <span>
          window
          {preset.windows.map((w) => (
            <button
              key={w.id}
              type="button"
              className={`demoBtn ${w.id === winId ? "isActive" : ""}`}
              onClick={() => {
                setWinId(w.id);
                setOffset(0);
              }}
            >
              {w.id === "in" ? `message in (cycles ${w.from}–${w.from + w.pathCost.length - 1})` : `message out (cycles ${w.from}–${w.from + w.pathCost.length - 1})`}
            </button>
          ))}
        </span>
        <label>
          zoom
          <input type="range" min={4} max={40} value={pxPerCycle} onChange={(e) => setPxPerCycle(Number(e.target.value))} />
        </label>
        <label>
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> follow the trellis
        </label>
        <span className="vitStat">
          {cursorAbs !== null ? (
            <>
              cycle <b className="demoMono">{cursorAbs}</b> · t = {cursorAbs * sim.clockNs} ns
            </>
          ) : (
            "hover for values · drag to pan"
          )}
        </span>
      </div>
      <div
        ref={wrapRef}
        className="waveCanvasWrap"
        onMouseMove={onMove}
        onMouseLeave={() => {
          setCursor(null);
          dragRef.current = null;
        }}
        onMouseDown={(e) => {
          dragRef.current = { x: e.clientX, offset };
        }}
        onMouseUp={() => {
          dragRef.current = null;
        }}
      >
        <canvas ref={canvasRef} role="img" aria-label="Simulation waveforms" />
      </div>
      {cursor !== null && cursor < n ? (
        <div className="waveValues demoMono">
          {lanes
            .filter((l) => l.key !== "clk")
            .map((l) => (
              <span key={l.key}>
                {l.label.replace(/\[.*\]/, "")}=<b>{fmt(l.values[cursor], l.bits)}</b>
              </span>
            ))}
        </div>
      ) : null}
      <p className="demoNote">
        Every trace here is from Icarus Verilog running the course testbench on the RTL (
        {sim.tool.replace(/ \(\)$/, "")}, {new Date(sim.generatedAt).toISOString().slice(0, 10)}). The decoded copy of
        the message leaves the decoder {sim.outputOffsetCycles} cycles after it went in: 1 cycle in the channel
        register, 1 in the ACS/survivor registers, 64 of traceback depth, and a {sim.outputOffsetCycles - 66}-stage
        output pipe that lines the stream up with where the testbench starts scoring.
      </p>
    </div>
  );
}
