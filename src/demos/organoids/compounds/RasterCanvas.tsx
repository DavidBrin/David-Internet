"use client";

/**
 * The chapter-4 centerpiece: one canvas, 48 rows (wells A1..F8), spike ticks
 * stacked into 16 sub-lanes per row (one per electrode), a left-to-right
 * time cursor that reveals the recording as it sweeps, burst glows behind
 * the ticks they cover, and brighter vertical bands for well-level network
 * events. Detection (burst runs / network-event windows) is precomputed by
 * the caller (detectPlacements.ts) — this component only ever reads
 * precomputed placements and redraws from a dirty flag, so scrubbing the
 * sliders never re-runs detection inside the render loop.
 */
import { useEffect, useRef } from "react";

export interface RasterBurst {
  lane: number; // 0..15, electrode index within the well
  t0: number;
  t1: number;
}

export interface RasterEvent {
  t0: number;
  t1: number;
}

export interface RasterRow {
  label: string; // "A1".."F8"
  color: string;
  stim: boolean;
  active: boolean;
  ticks: { t: number; lane: number }[]; // sorted ascending by t
  bursts: RasterBurst[];
  events: RasterEvent[];
}

interface Props {
  rows: RasterRow[];
  duration: number; // seconds of data (600)
  playing: boolean;
  /** seconds of data swept per real second, at speed = 1x. */
  baseRate: number;
  speed: number;
  /** bumped by the parent whenever `rows` represents new data — resets the cursor to 0. */
  resetToken: number;
  onCursor: (t: number) => void;
}

const ROW_H = 8.6;
const LANES = 16;
const LEFT_GUTTER = 34;
const AXIS_H = 22;
const RIGHT_PAD = 6;
const TRAIL_S = 3.5; // how long a just-swept burst/event stays "bright" behind the cursor

function upperBound(arr: { t: number }[], t: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function RasterCanvas({ rows, duration, playing, baseRate, speed, resetToken, onCursor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef(0);
  const dirtyRef = useRef(true);
  const playingRef = useRef(playing);
  const rateRef = useRef(baseRate * speed);
  const rowsRef = useRef(rows);
  const onCursorRef = useRef(onCursor);
  playingRef.current = playing;
  rateRef.current = baseRate * speed;
  rowsRef.current = rows;
  onCursorRef.current = onCursor;

  useEffect(() => {
    cursorRef.current = 0;
    dirtyRef.current = true;
  }, [resetToken]);

  useEffect(() => {
    dirtyRef.current = true;
  }, [rows]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastReport = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const dpr = window.devicePixelRatio || 1;
      const W = Math.max(1, Math.round(wrap.clientWidth));
      const H = Math.round(rowsRef.current.length * ROW_H + AXIS_H);
      const pxW = Math.floor(W * dpr);
      const pxH = Math.floor(H * dpr);
      // skip resizes under 2px of change (in device pixels) to avoid thrash
      if (Math.abs(canvas.width - pxW) >= 2 || Math.abs(canvas.height - pxH) >= 2) {
        canvas.width = pxW;
        canvas.height = pxH;
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
        canvas.style.display = "block";
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#fffafd";
      ctx.fillRect(0, 0, W, H);

      const plotX0 = LEFT_GUTTER;
      const plotW = Math.max(1, W - LEFT_GUTTER - RIGHT_PAD);
      const xOf = (t: number) => plotX0 + (t / duration) * plotW;
      const cursorT = cursorRef.current;
      const rowsNow = rowsRef.current;

      ctx.font = "7px ui-monospace, Consolas, monospace";
      ctx.textBaseline = "middle";

      for (let ri = 0; ri < rowsNow.length; ri++) {
        const row = rowsNow[ri];
        const y = ri * ROW_H;
        const [cr, cg, cb] = hexToRgb(row.color);

        if (ri % 8 === 0) {
          ctx.fillStyle = "rgba(190,95,143,0.10)";
          ctx.fillRect(0, y, W, 1);
        }
        if (ri % 2 === 1) {
          ctx.fillStyle = "rgba(0,0,0,0.018)";
          ctx.fillRect(plotX0, y, plotW, ROW_H);
        }

        // ---- network events: brighter vertical band across the row ----
        for (const ev of row.events) {
          if (ev.t0 > cursorT) continue;
          const t1c = Math.min(ev.t1, cursorT);
          const x0 = xOf(ev.t0);
          const x1 = xOf(t1c);
          const recent = cursorT - ev.t0 < TRAIL_S;
          ctx.fillStyle = recent ? `rgba(${cr},${cg},${cb},0.55)` : `rgba(${cr},${cg},${cb},0.16)`;
          ctx.fillRect(x0, y + 0.4, Math.max(1.4, x1 - x0), ROW_H - 0.8);
        }

        // ---- bursts: rounded glow behind the run of ticks ----
        const laneH = ROW_H / LANES;
        for (const b of row.bursts) {
          if (b.t0 > cursorT) continue;
          const t1c = Math.min(b.t1, cursorT);
          const x0 = xOf(b.t0);
          const x1 = xOf(t1c);
          const laneY = y + (b.lane + 0.5) * laneH;
          const recent = cursorT - b.t0 < TRAIL_S;
          ctx.fillStyle = recent ? `rgba(${cr},${cg},${cb},0.85)` : `rgba(${cr},${cg},${cb},0.30)`;
          const w = Math.max(1.8, x1 - x0 + 1.5);
          const h = Math.max(1.6, laneH + 0.8);
          if (typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(x0 - 0.75, laneY - h / 2, w, h, h / 2);
            ctx.fill();
          } else {
            ctx.fillRect(x0 - 0.75, laneY - h / 2, w, h);
          }
        }

        // ---- ticks ----
        ctx.fillStyle = row.color;
        const n = upperBound(row.ticks, cursorT);
        for (let k = 0; k < n; k++) {
          const tk = row.ticks[k];
          const x = xOf(tk.t);
          const ly = y + (tk.lane + 0.5) * laneH;
          ctx.fillRect(x, ly - 0.5, 1, Math.max(0.9, laneH * 0.85));
        }

        // ---- row label ----
        ctx.fillStyle = row.active ? "#6d2c4e" : "#c8a6ba";
        ctx.textAlign = "right";
        ctx.fillText(row.label + (row.stim ? "•" : ""), LEFT_GUTTER - 4, y + ROW_H / 2);
      }

      // ---- sweep cursor ----
      const cx = xOf(cursorT);
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, rowsNow.length * ROW_H);
      ctx.stroke();

      // ---- time axis ----
      const axisY = rowsNow.length * ROW_H;
      ctx.fillStyle = "#fff6fa";
      ctx.fillRect(0, axisY, W, AXIS_H);
      ctx.strokeStyle = "#f0cfe1";
      ctx.beginPath();
      ctx.moveTo(0, axisY + 0.5);
      ctx.lineTo(W, axisY + 0.5);
      ctx.stroke();
      ctx.fillStyle = "#a4527f";
      ctx.textAlign = "center";
      ctx.font = "9px ui-monospace, Consolas, monospace";
      const step = duration <= 60 ? 10 : duration <= 300 ? 60 : 120;
      for (let t = 0; t <= duration; t += step) {
        const x = xOf(t);
        ctx.fillRect(x, axisY, 1, 4);
        ctx.fillText(`${t}s`, x, axisY + AXIS_H / 2 + 5);
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.12, (now - last) / 1000);
      last = now;
      if (playingRef.current) {
        let t = cursorRef.current + dt * rateRef.current;
        if (t >= duration) t = 0;
        cursorRef.current = t;
        dirtyRef.current = true;
        if (now - lastReport > 100) {
          lastReport = now;
          onCursorRef.current(t);
        }
      }
      if (dirtyRef.current) {
        dirtyRef.current = false;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

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
    <div ref={wrapRef} className="ogCanvasWrap ogCmpRasterWrap">
      <canvas ref={canvasRef} role="img" aria-label="Spike raster, all 48 wells, 0 to 600 seconds" />
    </div>
  );
}
