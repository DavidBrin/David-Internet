"use client";

import { useCallback, useEffect } from "react";
import type { DriveEngine } from "./useDriveSim";
import { useSizedCanvas } from "./useSizedCanvas";

interface Props {
  engine: DriveEngine;
}

const WINDOW = 20;
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

type Row = { t: number; error: number | null; steering: number; throttle: number; cte: number };

interface Lane {
  key: string;
  label: string;
  color: string;
  lo: number;
  hi: number;
  value: (r: Row) => number | null;
  fmt: (v: number) => string;
  step?: boolean;
  ticks: number[];
}

export default function StripCharts({ engine }: Props) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      const sim = engine.simRef.current;
      const g = engine.gainsRef.current;
      const thrHi = Math.max(0.25, Math.ceil((g.max_throttle * 1.15) / 0.05) * 0.05);
      const lanes: Lane[] = [
        {
          key: "e",
          label: "e  /centroid",
          color: "#a16207",
          lo: -1,
          hi: 1,
          value: (r) => r.error,
          fmt: (v) => (v >= 0 ? "+" : "") + v.toFixed(3),
          ticks: [-1, 0, 1],
        },
        {
          key: "s",
          label: "angular.z  steering",
          color: "#2563eb",
          lo: -1,
          hi: 1,
          value: (r) => r.steering,
          fmt: (v) => (v >= 0 ? "+" : "") + v.toFixed(3),
          step: true,
          ticks: [-1, 0, 1],
        },
        {
          key: "th",
          label: "linear.x  throttle",
          color: "#16a34a",
          lo: 0,
          hi: thrHi,
          value: (r) => r.throttle,
          fmt: (v) => v.toFixed(3),
          step: true,
          ticks: [0, g.min_throttle, g.max_throttle].filter((v, i, a) => a.indexOf(v) === i),
        },
        {
          key: "cte",
          label: "cross-track error, cm (+ left)",
          color: "#dc2626",
          lo: -30,
          hi: 30,
          value: (r) => (Number.isFinite(r.cte) ? r.cte * 100 : null),
          fmt: (v) => (v >= 0 ? "+" : "") + v.toFixed(1),
          ticks: [-28, 0, 28],
        },
      ];

      const padL = 34,
        padR = 8,
        padT = 4,
        axisH = 18,
        gap = 6;
      const laneH = (h - padT - axisH - gap * (lanes.length - 1)) / lanes.length;
      const pw = w - padL - padR;
      const tEnd = Math.max(WINDOW, sim ? sim.t : 0);
      const t0 = tEnd - WINDOW;
      const X = (t: number) => padL + ((t - t0) / WINDOW) * pw;
      const hist: Row[] = sim ? sim.history : [];
      let first = 0;
      while (first < hist.length - 1 && hist[first + 1].t < t0) first++;

      ctx.font = `10.5px ${MONO}`;
      lanes.forEach((ln, li) => {
        const top = padT + li * (laneH + gap);
        const Y = (v: number) => top + (1 - (Math.max(ln.lo, Math.min(ln.hi, v)) - ln.lo) / (ln.hi - ln.lo)) * laneH;
        ctx.fillStyle = "#f7f6f2";
        ctx.fillRect(padL, top, pw, laneH);

        // lane-specific guides
        if (ln.key === "e") {
          const b = g.error_threshold;
          ctx.fillStyle = "rgba(234,179,8,0.22)";
          ctx.fillRect(padL, Y(b), pw, Y(-b) - Y(b));
          ctx.strokeStyle = "rgba(161,98,7,0.55)";
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(padL, Y(b));
          ctx.lineTo(padL + pw, Y(b));
          ctx.moveTo(padL, Y(-b));
          ctx.lineTo(padL + pw, Y(-b));
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (ln.key === "cte") {
          ctx.strokeStyle = "rgba(220,38,38,0.5)";
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(padL, Y(28));
          ctx.lineTo(padL + pw, Y(28));
          ctx.moveTo(padL, Y(-28));
          ctx.lineTo(padL + pw, Y(-28));
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // zero line + tick labels
        ctx.strokeStyle = "#d9d8d2";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const z = ln.lo < 0 ? 0 : ln.lo;
        ctx.moveTo(padL, Math.round(Y(z)) + 0.5);
        ctx.lineTo(padL + pw, Math.round(Y(z)) + 0.5);
        ctx.stroke();
        ctx.fillStyle = "#7a7f86";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (const tv of ln.ticks) {
          const txt = ln.key === "th" ? tv.toFixed(2) : String(tv);
          ctx.fillText(txt, padL - 4, Math.min(top + laneH - 5, Math.max(top + 5, Y(tv))));
        }

        // gaps: frames where /centroid carried nothing
        if (ln.key === "e") {
          ctx.fillStyle = "rgba(220,38,38,0.8)";
          for (let i = first; i < hist.length; i++) {
            if (hist[i].error === null && hist[i].t >= t0) ctx.fillRect(X(hist[i].t) - 1, top + laneH - 6, 2, 6);
          }
        }

        // trace
        ctx.strokeStyle = ln.color;
        ctx.lineWidth = 1.6;
        ctx.lineJoin = "round";
        ctx.beginPath();
        let pen = false;
        let prevY = 0;
        for (let i = first; i < hist.length; i++) {
          const v = ln.value(hist[i]);
          if (v === null) {
            pen = false;
            continue;
          }
          const x = Math.max(padL, X(hist[i].t)),
            y = Y(v);
          if (!pen) ctx.moveTo(x, y);
          else if (ln.step) {
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, y);
          } else ctx.lineTo(x, y);
          pen = true;
          prevY = y;
        }
        ctx.stroke();

        // label + latest value
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        const lastRow = hist[hist.length - 1];
        const lv = lastRow ? ln.value(lastRow) : null;
        const label = ln.label;
        ctx.font = `600 10.5px ${MONO}`;
        const lw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(247,246,242,0.85)";
        ctx.fillRect(padL + 3, top + 2, lw + 6, 14);
        ctx.fillStyle = ln.color;
        ctx.fillText(label, padL + 6, top + 3);
        ctx.font = `10.5px ${MONO}`;
        const vt = lv === null ? (ln.key === "e" ? "no message" : "") : ln.fmt(lv);
        if (vt) {
          ctx.textAlign = "right";
          const vw = ctx.measureText(vt).width;
          ctx.fillStyle = "rgba(247,246,242,0.85)";
          ctx.fillRect(padL + pw - vw - 8, top + 2, vw + 6, 14);
          ctx.fillStyle = lv === null ? "#dc2626" : "#1f2328";
          ctx.fillText(vt, padL + pw - 5, top + 3);
        }
      });

      // time axis
      const axisY = h - axisH + 4;
      ctx.fillStyle = "#7a7f86";
      ctx.textBaseline = "top";
      ctx.font = `10.5px ${MONO}`;
      for (let s = 0; s <= WINDOW; s += 5) {
        const t = t0 + s;
        ctx.textAlign = s === 0 ? "left" : s === WINDOW ? "right" : "center";
        ctx.fillText(`${t.toFixed(0)} s`, X(t), axisY);
      }
    },
    [engine],
  );

  const { canvasRef, wrapRef, redraw } = useSizedCanvas(draw, (w) => (w < 520 ? 320 : 300));

  useEffect(() => {
    const bus = engine.bus.current;
    let last = 0;
    const tick = () => {
      // 30 Hz is plenty for a 20 s window
      const now = performance.now();
      if (now - last < 33) return;
      last = now;
      redraw();
    };
    bus.add(tick);
    return () => {
      bus.delete(tick);
    };
  }, [engine.bus, redraw]);

  return (
    <div ref={wrapRef} className="acDrCharts">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Strip charts of the last 20 seconds: steering error, angular.z, linear.x and cross-track error"
      />
    </div>
  );
}
