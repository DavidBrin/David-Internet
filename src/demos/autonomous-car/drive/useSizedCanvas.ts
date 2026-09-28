"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * DPR-aware canvas sized to its wrapper's width, with the height a function of the width
 * (so charts can stay readable on phones). `redraw()` runs `draw(ctx, w, h)` in CSS
 * pixels; animation loops call it directly instead of re-rendering React.
 */
export function useSizedCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, heightFor: (w: number) => number) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const size = useRef<{ w: number; h: number } | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const heightRef = useRef(heightFor);
  heightRef.current = heightFor;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(wrap.clientWidth));
    const h = Math.max(1, Math.round(heightRef.current(w)));
    const last = size.current;
    if (!last || Math.abs(w - last.w) >= 2 || h !== last.h) {
      canvas.style.display = "block";
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      size.current = { w, h };
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRef.current(ctx, size.current!.w, size.current!.h);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    redraw();
    const ro = new ResizeObserver(() => redraw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  return { canvasRef, wrapRef, redraw };
}
