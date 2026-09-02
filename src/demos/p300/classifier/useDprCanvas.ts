"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * DPR-aware canvas sizing hook (same pattern used across the David-Internet
 * demo panels, e.g. organoids/spectrum): measures the wrapping element,
 * skips sub-2px resize churn, sets canvas.style.display block imperatively,
 * and redraws either on a real resize or whenever the draw callback's
 * identity changes. `draw` receives the CSS pixel size (not device pixels) —
 * the returned transform already accounts for devicePixelRatio.
 */
export function useDprCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): {
  canvasRef: (el: HTMLCanvasElement | null) => void;
  wrapRef: (el: HTMLDivElement | null) => void;
} {
  const [ready, setReady] = useState(false);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const wrapElRef = useRef<HTMLDivElement | null>(null);
  const lastAppliedRef = useRef<{ w: number; h: number } | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const canvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasElRef.current = el;
    if (el) setReady(true);
  }, []);
  const wrapRef = useCallback((el: HTMLDivElement | null) => {
    wrapElRef.current = el;
    if (el) setReady(true);
  }, []);

  const render = useCallback(() => {
    const canvas = canvasElRef.current;
    const wrap = wrapElRef.current;
    if (!canvas || !wrap) return;
    canvas.style.display = "block";
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    const last = lastAppliedRef.current;
    const settled = last !== null && Math.abs(w - last.w) < 2 && Math.abs(h - last.h) < 2;
    if (!settled) {
      const targetW = Math.floor(w * dpr);
      const targetH = Math.floor(h * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      lastAppliedRef.current = { w, h };
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRef.current(ctx, w, h);
  }, []);

  useEffect(() => {
    render();
  }, [render, draw, ready]);

  useEffect(() => {
    const wrap = wrapElRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => render());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [render, ready]);

  return { canvasRef, wrapRef };
}
