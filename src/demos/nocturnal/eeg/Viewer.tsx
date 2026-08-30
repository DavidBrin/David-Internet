"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

const ROW_H = 21;
const GUTTER = 44;
const AXIS_H = 22;
const INK = "#202124";
const MUTED = "#5f6368";
const LINE = "#dadce0";
const TRACE = "#8a8f95";
const BAD = "#c4c7cb";

export interface ViewerProps {
  fs: number;
  channels: Float32Array[];
  names: string[];
  bad: boolean[];
  /** Selected names in order [A, B]. */
  selected: string[];
  colors: [string, string];
  playing: boolean;
  /** µV spanned by half a row (a fixed scale, so a noisy channel looks noisy). */
  uvPerHalfRow: number;
  autoscale: boolean;
  windowS: number;
  /** Window start in seconds — the live playhead lives here, not in React state. */
  t0Ref: MutableRefObject<number>;
  maxStart: number;
  /** Bumped by the parent when the scrub slider moves, so the canvas redraws. */
  scrubNonce: number;
  /** Called at ~8 Hz while playing so the parent can follow the playhead. */
  onTick: (t0: number) => void;
}

export default function Viewer(props: ViewerProps) {
  const { fs, channels, names, bad, selected, colors, playing, uvPerHalfRow, autoscale, windowS, t0Ref, maxStart, scrubNonce, onTick } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(true);
  const playingRef = useRef(playing);
  const onTickRef = useRef(onTick);
  playingRef.current = playing;
  onTickRef.current = onTick;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth;
    const H = names.length * ROW_H + AXIS_H;
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

    const t0 = t0Ref.current;
    const n = Math.round(windowS * fs);
    const i0 = Math.min(Math.round(t0 * fs), Math.max(0, (channels[0]?.length ?? 0) - n));
    const plotW = W - GUTTER - 6;
    const xOf = (k: number) => GUTTER + (k / n) * plotW;

    // rows
    ctx.font = "11px Arial, Helvetica, sans-serif";
    ctx.textBaseline = "middle";
    for (let c = 0; c < names.length; c++) {
      const yTop = c * ROW_H;
      ctx.fillStyle = c % 2 ? "#fafafa" : "#fff";
      ctx.fillRect(GUTTER, yTop, W - GUTTER, ROW_H);
      const idx = selected.indexOf(names[c]);
      ctx.fillStyle = idx >= 0 ? colors[idx] : bad[c] ? "#9aa0a6" : INK;
      ctx.textAlign = "right";
      ctx.fillText(names[c] + (bad[c] ? " ⚠" : ""), GUTTER - 6, yTop + ROW_H / 2);
    }

    // time grid + axis (one tick per second)
    const axisY = names.length * ROW_H;
    ctx.fillStyle = MUTED;
    ctx.textAlign = "center";
    ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
    const firstSec = Math.ceil(i0 / fs);
    for (let s = firstSec; s <= (i0 + n) / fs; s++) {
      const x = xOf(s * fs - i0);
      ctx.fillStyle = LINE;
      ctx.fillRect(Math.round(x), 0, 1, axisY);
      ctx.fillStyle = MUTED;
      ctx.fillText(`${s} s`, x, axisY + AXIS_H / 2 + 1);
    }

    // traces: unselected first, selected on top
    ctx.save();
    ctx.beginPath();
    ctx.rect(GUTTER, 0, W - GUTTER, axisY);
    ctx.clip();
    ctx.lineJoin = "round";
    const order: number[] = [];
    for (let c = 0; c < names.length; c++) if (!selected.includes(names[c])) order.push(c);
    for (const s of selected) {
      const c = names.indexOf(s);
      if (c >= 0) order.push(c);
    }
    const halfRow = ROW_H / 2;
    for (const c of order) {
      const sig = channels[c];
      if (!sig) continue;
      const yc = c * ROW_H + halfRow;
      // per-window baseline (display only): slow drifts would otherwise pin a trace at the clamp
      let s1 = 0;
      let s2 = 0;
      for (let k = 0; k < n; k++) {
        const v = sig[i0 + k];
        s1 += v;
        s2 += v * v;
      }
      const base = s1 / n;
      let pxPerUv = halfRow / uvPerHalfRow;
      if (autoscale) {
        const sd = Math.sqrt(Math.max(s2 / n - base * base, 1e-6));
        pxPerUv = halfRow / (3 * sd);
      }
      const idx = selected.indexOf(names[c]);
      ctx.strokeStyle = idx >= 0 ? colors[idx] : bad[c] ? BAD : TRACE;
      ctx.lineWidth = idx >= 0 ? 1.5 : 0.8;
      const lim = ROW_H * 0.8; // let a trace spill a little into its neighbours, then clamp
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        let y = yc - (sig[i0 + k] - base) * pxPerUv;
        if (y < yc - lim) y = yc - lim;
        else if (y > yc + lim) y = yc + lim;
        const x = xOf(k);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // scale bar (fixed scale only)
    if (!autoscale) {
      const x = W - 5;
      const yb = axisY - 6;
      const h = halfRow;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(x - 52, yb - h - 3, 54, h + 8);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yb);
      ctx.lineTo(x, yb - h);
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = "10px Arial, Helvetica, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${fmtUv(uvPerHalfRow)} µV`, x - 4, yb - h / 2);
    }
  }, [fs, channels, names, bad, selected, colors, uvPerHalfRow, autoscale, windowS, t0Ref]);

  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
    dirtyRef.current = true;
  }, [draw]);

  useEffect(() => {
    dirtyRef.current = true;
  }, [scrubNonce]);

  // one rAF loop for the life of the component: advances the playhead, redraws when dirty
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastTick = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playingRef.current) {
        let t = t0Ref.current + dt;
        if (t > maxStart) t = 0;
        t0Ref.current = t;
        dirtyRef.current = true;
        if (now - lastTick > 120) {
          lastTick = now;
          onTickRef.current(t);
        }
      }
      if (dirtyRef.current) {
        dirtyRef.current = false;
        drawRef.current();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [maxStart, t0Ref]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      dirtyRef.current = true;
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="nnE-canvasWrap nnE-viewer">
      <canvas ref={canvasRef} role="img" aria-label="EEG traces, 10 second window" />
    </div>
  );
}

export function fmtUv(v: number): string {
  return v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(0) : v.toFixed(1);
}
