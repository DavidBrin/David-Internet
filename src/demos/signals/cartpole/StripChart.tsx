"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { fitCanvas } from "./canvasUtil";
import { peakAbsDeg, radToDeg, settlingTimeS } from "./model";
import type { GustState, HistorySample, SinceGust } from "./useCartpoleSim";

interface Props {
  historyRef: MutableRefObject<HistorySample[]>;
  simTimeRef: MutableRefObject<number>;
  gustRef: MutableRefObject<GustState | null>;
  sinceGustRef: MutableRefObject<SinceGust>;
}

const WINDOW_S = 8;
const MARGIN = { l: 40, r: 10, t: 8, b: 16 };
const TOP_FRAC = 0.6;
const GAP = 10;
const MUTED = "#5f6368";
const LINE = "#eef1f2";
const THETA_COLOR = "#0EA5E9";
const X_COLOR = "#8a5cf6";
const X_RANGE = 2.6;

export default function StripChart({ historyRef, simTimeRef, gustRef, sinceGustRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const fit = fitCanvas(canvas, wrap.clientWidth, wrap.clientHeight);
    if (!fit) return;
    const { ctx, W, H } = fit;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    const now = simTimeRef.current;
    const plotW = W - MARGIN.l - MARGIN.r;
    const innerH = H - MARGIN.t - MARGIN.b - GAP;
    const thetaH = innerH * TOP_FRAC;
    const xH = innerH - thetaH;
    const thetaTop = MARGIN.t;
    const xTop = MARGIN.t + thetaH + GAP;
    const xOf = (t: number) => MARGIN.l + ((t - (now - WINDOW_S)) / WINDOW_S) * plotW;

    const hist = historyRef.current;
    let peakDeg = 5;
    for (const s of hist) peakDeg = Math.max(peakDeg, Math.abs(radToDeg(s.theta)));
    peakDeg = Math.ceil(peakDeg / 5) * 5;
    const thetaYOf = (thetaRad: number) => thetaTop + thetaH / 2 - (radToDeg(thetaRad) / peakDeg) * (thetaH / 2 - 4);
    const xYOf = (x: number) => xTop + xH / 2 - (x / X_RANGE) * (xH / 2 - 4);

    // gust band
    const g = gustRef.current;
    if (g) {
      const x0 = xOf(g.startT);
      const x1 = xOf(g.endT);
      if (x1 > MARGIN.l && x0 < MARGIN.l + plotW) {
        ctx.fillStyle = "rgba(139,92,246,0.08)";
        ctx.fillRect(Math.max(MARGIN.l, x0), thetaTop, Math.min(MARGIN.l + plotW, x1) - Math.max(MARGIN.l, x0), thetaH + GAP + xH);
      }
    }

    // grid + time ticks
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.font = "9.5px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillStyle = MUTED;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let k = 0; k <= WINDOW_S; k++) {
      const t = Math.floor(now) - k;
      const x = xOf(t);
      if (x < MARGIN.l - 1 || x > MARGIN.l + plotW + 1) continue;
      ctx.beginPath();
      ctx.moveTo(x, thetaTop);
      ctx.lineTo(x, xTop + xH);
      ctx.stroke();
      if (k % 2 === 0) ctx.fillText(k === 0 ? "now" : `-${k}s`, x, xTop + xH + 2);
    }

    // zero lines + row labels
    ctx.strokeStyle = "#c7ced1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN.l, thetaYOf(0));
    ctx.lineTo(MARGIN.l + plotW, thetaYOf(0));
    ctx.moveTo(MARGIN.l, xYOf(0));
    ctx.lineTo(MARGIN.l + plotW, xYOf(0));
    ctx.stroke();

    ctx.fillStyle = THETA_COLOR;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText(`${peakDeg}°`, MARGIN.l - 4, thetaTop + 4);
    ctx.fillText(`-${peakDeg}°`, MARGIN.l - 4, thetaTop + thetaH - 4);
    ctx.fillStyle = X_COLOR;
    ctx.fillText(`x=${X_RANGE}`, MARGIN.l - 4, xTop + 4);
    ctx.fillText(`x=-${X_RANGE}`, MARGIN.l - 4, xTop + xH - 4);

    // theta(t) trace
    ctx.strokeStyle = THETA_COLOR;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let started = false;
    for (const s of hist) {
      if (s.t < now - WINDOW_S) continue;
      const px = xOf(s.t);
      const py = Math.max(thetaTop, Math.min(thetaTop + thetaH, thetaYOf(s.theta)));
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // x(t) trace
    ctx.strokeStyle = X_COLOR;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    started = false;
    for (const s of hist) {
      if (s.t < now - WINDOW_S) continue;
      const px = xOf(s.t);
      const py = Math.max(xTop, Math.min(xTop + xH, xYOf(s.x)));
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // readouts
    const sg = sinceGustRef.current;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
    if (sg.t.length > 4) {
      const peak = peakAbsDeg(sg.theta);
      const settle = settlingTimeS(sg.t, sg.theta, 0.5);
      const settleTxt = settle === null ? "settling…" : `${settle.toFixed(2)}s`;
      ctx.fillStyle = "#3c4043";
      ctx.fillText(`overshoot ${peak.toFixed(2)}°  ·  settle ${settleTxt}`, MARGIN.l + 4, thetaTop + 2);
    }
  }, [historyRef, simTimeRef, gustRef, sinceGustRef]);

  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (!document.hidden) drawRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => drawRef.current());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="sigCanvasWrap sigCpChart">
      <canvas ref={canvasRef} role="img" aria-label="Angle and disturbance strip chart" />
    </div>
  );
}
