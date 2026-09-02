"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * DPR-aware canvas sizing hook shared by the training panel's charts.
 * - canvas.style.display is set to "block" imperatively (kills inline baseline gap).
 * - ResizeObserver-driven resizes smaller than 2px are ignored (no thrash on subpixel jitter).
 * - `draw(ctx, w, h)` runs in CSS pixel space; the transform bakes in the DPR scale.
 */
export function useFitCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, heightPx: number) {
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
    const w = Math.max(1, Math.floor(wrap.clientWidth));
    const h = heightPx;
    if (w === 0) return;
    const last = lastAppliedRef.current;
    const settled = last !== null && Math.abs(w - last.w) < 2 && Math.abs(h - last.h) < 2;
    if (!settled) {
      const needW = Math.floor(w * dpr);
      const needH = Math.floor(h * dpr);
      if (canvas.width !== needW || canvas.height !== needH) {
        canvas.width = needW;
        canvas.height = needH;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      lastAppliedRef.current = { w, h };
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRef.current(ctx, w, h);
  }, [heightPx]);

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

/** Same contract as useFitCanvas, but the canvas is always square (h = wrap.clientWidth). */
export function useFitCanvasSquare(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
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
    const w = Math.max(1, Math.floor(wrap.clientWidth));
    const h = w;
    if (w === 0) return;
    const last = lastAppliedRef.current;
    const settled = last !== null && Math.abs(w - last.w) < 2 && Math.abs(h - last.h) < 2;
    if (!settled) {
      const needW = Math.floor(w * dpr);
      const needH = Math.floor(h * dpr);
      if (canvas.width !== needW || canvas.height !== needH) {
        canvas.width = needW;
        canvas.height = needH;
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
