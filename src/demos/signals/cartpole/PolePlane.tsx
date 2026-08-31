"use client";

import { useCallback, useEffect, useRef } from "react";
import { fitCanvas } from "./canvasUtil";
import { closedLoopPoles, type Pole } from "./model";

interface Props {
  k1: number;
  k2: number;
}

const RE_MIN = -22;
const RE_MAX = 8;
const IM_MIN = -12;
const IM_MAX = 12;
const MARGIN = { l: 34, r: 12, t: 10, b: 22 };
const INK = "#202124";
const MUTED = "#5f6368";
const LINE = "#e2e6e8";
const GREEN = "#188038";
const RED = "#d93025";
const AMBER = "#b8860b";

function fmtPole(p: Pole): string {
  if (Math.abs(p.im) < 1e-6) return p.re.toFixed(2);
  const sign = p.im >= 0 ? "+" : "-";
  return `${p.re.toFixed(2)} ${sign} ${Math.abs(p.im).toFixed(2)}j`;
}

export default function PolePlane({ k1, k2 }: Props) {
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

    const plotW = W - MARGIN.l - MARGIN.r;
    const plotH = H - MARGIN.t - MARGIN.b;
    const xOf = (re: number) => MARGIN.l + ((re - RE_MIN) / (RE_MAX - RE_MIN)) * plotW;
    const yOf = (im: number) => MARGIN.t + ((IM_MAX - im) / (IM_MAX - IM_MIN)) * plotH;

    // LHP shading
    ctx.fillStyle = "rgba(24,128,56,0.055)";
    ctx.fillRect(MARGIN.l, MARGIN.t, xOf(0) - MARGIN.l, plotH);

    // grid
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.font = "9.5px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillStyle = MUTED;
    for (let re = Math.ceil(RE_MIN / 5) * 5; re <= RE_MAX; re += 5) {
      const x = xOf(re);
      ctx.beginPath();
      ctx.moveTo(x, MARGIN.t);
      ctx.lineTo(x, MARGIN.t + plotH);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(re), x, MARGIN.t + plotH + 3);
    }
    for (let im = Math.ceil(IM_MIN / 4) * 4; im <= IM_MAX; im += 4) {
      const y = yOf(im);
      ctx.beginPath();
      ctx.moveTo(MARGIN.l, y);
      ctx.lineTo(MARGIN.l + plotW, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(im), MARGIN.l - 4, y);
    }

    // axes
    ctx.strokeStyle = "#9aa0a6";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(xOf(0), MARGIN.t);
    ctx.lineTo(xOf(0), MARGIN.t + plotH);
    ctx.moveTo(MARGIN.l, yOf(0));
    ctx.lineTo(MARGIN.l + plotW, yOf(0));
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = "10px Arial, Helvetica, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("Re(s)", MARGIN.l + plotW - 26, yOf(0) - 4);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Im(s)", xOf(0) + 4, MARGIN.t);

    // poles
    const [p1, p2] = closedLoopPoles(k1, k2);
    const anyUnstable = p1.re > 0 || p2.re > 0;
    const bothStable = p1.re < 0 && p2.re < 0;
    const color = anyUnstable ? RED : bothStable ? GREEN : AMBER;
    const coincide = Math.abs(p1.re - p2.re) < 1e-6 && Math.abs(p1.im - p2.im) < 1e-6;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    const drawX = (re: number, im: number) => {
      const x = Math.max(MARGIN.l, Math.min(MARGIN.l + plotW, xOf(re)));
      const y = Math.max(MARGIN.t, Math.min(MARGIN.t + plotH, yOf(im)));
      const r = 5.5;
      ctx.beginPath();
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x - r, y + r);
      ctx.lineTo(x + r, y - r);
      ctx.stroke();
    };
    drawX(p1.re, p1.im);
    if (!coincide) drawX(p2.re, p2.im);

    // numeric readout
    ctx.fillStyle = INK;
    ctx.font = "11.5px ui-monospace, Menlo, Consolas, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const label = coincide ? `s = ${fmtPole(p1)}  (double)` : `s = ${fmtPole(p1)},  ${fmtPole(p2)}`;
    ctx.fillText(label, MARGIN.l + 4, MARGIN.t + 3);
  }, [k1, k2]);

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

  return (
    <div ref={wrapRef} className="sigCanvasWrap sigCpPole">
      <canvas ref={canvasRef} role="img" aria-label="s-plane pole plot" />
    </div>
  );
}
