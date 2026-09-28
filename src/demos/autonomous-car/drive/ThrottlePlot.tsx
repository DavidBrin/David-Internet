"use client";

import { useCallback, useEffect } from "react";
import { scheduledThrottle } from "../core/control";
import { GUIDANCE_PARAMS } from "../core/params";
import type { DriveEngine, Gains } from "./useDriveSim";
import { useSizedCanvas } from "./useSizedCanvas";

interface Props {
  engine: DriveEngine;
  gains: Gains;
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** linear.x as a function of |e|: the node's gain-scheduling line, clamped to [min, max]. */
export default function ThrottlePlot({ engine, gains }: Props) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      const p = { ...GUIDANCE_PARAMS, ...gains };
      const padL = 36,
        padR = 10,
        padT = 10,
        padB = 26;
      const pw = w - padL - padR,
        ph = h - padT - padB;
      const hi = Math.max(0.25, Math.ceil((p.max_throttle * 1.15) / 0.05) * 0.05);
      const X = (e: number) => padL + e * pw;
      const Y = (v: number) => padT + (1 - v / hi) * ph;

      ctx.fillStyle = "#f7f6f2";
      ctx.fillRect(padL, padT, pw, ph);
      // flat region up to error_threshold
      ctx.fillStyle = "rgba(234,179,8,0.2)";
      ctx.fillRect(padL, padT, X(p.error_threshold) - padL, ph);
      ctx.strokeStyle = "rgba(161,98,7,0.7)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(X(p.error_threshold), padT);
      ctx.lineTo(X(p.error_threshold), padT + ph);
      ctx.stroke();
      ctx.setLineDash([]);

      // axes labels
      ctx.font = `10.5px ${MONO}`;
      ctx.fillStyle = "#7a7f86";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const yt = [p.min_throttle, p.max_throttle].filter((v, i, a) => a.findIndex((u) => Math.abs(u - v) < 0.012) === i);
      for (const v of yt) ctx.fillText(v.toFixed(2), padL - 4, Y(v));
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const e of [0, 0.5, 1]) ctx.fillText(e.toFixed(1), X(e), padT + ph + 4);
      ctx.fillStyle = "#a16207";
      ctx.fillText(`${p.error_threshold.toFixed(2)}`, X(p.error_threshold), padT + ph + 4);
      ctx.fillStyle = "#555b63";
      ctx.fillText("|e|", X(0.75), padT + ph + 4);

      // the schedule
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const e = i / 100;
        const v = scheduledThrottle(e, p);
        if (i) ctx.lineTo(X(e), Y(v));
        else ctx.moveTo(X(e), Y(v));
      }
      ctx.stroke();

      // live operating point: the node's last |e| and the throttle it published
      const sim = engine.simRef.current;
      if (sim) {
        const e = Math.min(1, Math.abs(sim.planner.ek));
        const v = sim.planner.lastThrottle;
        ctx.fillStyle = "#26282b";
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X(e), Y(v), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = `10.5px ${MONO}`;
        ctx.fillStyle = "#1f2328";
        ctx.textBaseline = "bottom";
        const txt = `|e| ${e.toFixed(2)} → ${v.toFixed(3)}`;
        const right = X(e) > padL + pw * 0.55;
        ctx.textAlign = right ? "right" : "left";
        ctx.fillText(txt, X(e) + (right ? -9 : 9), Y(v) - 4);
      }
    },
    [engine, gains],
  );

  const { canvasRef, wrapRef, redraw } = useSizedCanvas(draw, (w) => Math.max(120, Math.min(160, w * 0.42)));

  useEffect(() => {
    const bus = engine.bus.current;
    let last = 0;
    const tick = () => {
      const now = performance.now();
      if (now - last < 100) return;
      last = now;
      redraw();
    };
    bus.add(tick);
    redraw();
    return () => {
      bus.delete(tick);
    };
  }, [engine.bus, redraw]);

  useEffect(() => {
    redraw();
  }, [gains, redraw]);

  return (
    <div ref={wrapRef} className="acDrSched">
      <canvas ref={canvasRef} role="img" aria-label="Throttle schedule: linear.x against the absolute steering error, with the live operating point" />
    </div>
  );
}
