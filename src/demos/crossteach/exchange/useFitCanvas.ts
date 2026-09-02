"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * DPR-aware square-canvas sizing hook for the exchange panel (local variant of
 * training/useFitCanvas.ts, generalized with an extra `deps` array so a redraw
 * can be requested for reasons other than resize - e.g. slider drag, image
 * switch). canvas.style.display is set to "block" imperatively; ResizeObserver
 * resizes under 2px are ignored; the actual pixel redraw is scheduled on
 * requestAnimationFrame so rapid slider input coalesces to one paint/frame.
 */
export function useFitCanvasSquare(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  deps: readonly unknown[] = [],
) {
  const [ready, setReady] = useState(false);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const wrapElRef = useRef<HTMLDivElement | null>(null);
  const lastAppliedRef = useRef<{ w: number } | null>(null);
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
    if (w === 0) return;
    const last = lastAppliedRef.current;
    const settled = last !== null && Math.abs(w - last.w) < 2;
    if (!settled) {
      const need = Math.floor(w * dpr);
      if (canvas.width !== need || canvas.height !== need) {
        canvas.width = need;
        canvas.height = need;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${w}px`;
      }
      lastAppliedRef.current = { w };
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRef.current(ctx, w);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(render);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render, ready, ...deps]);

  useEffect(() => {
    const wrap = wrapElRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => render());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [render, ready]);

  return { canvasRef, wrapRef };
}
