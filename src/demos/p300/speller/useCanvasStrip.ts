"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * DPR-aware canvas sizing for a fixed-height strip that fills its wrapper's
 * width (local variant of crossteach/exchange/useFitCanvas.ts's square hook,
 * adapted for rectangular strips whose content is redrawn imperatively from
 * an outside animation loop rather than via a React deps array).
 * canvas.style.display is set to "block" imperatively; ResizeObserver
 * resizes under 2px are ignored.
 */
export function useCanvasStrip(height: number, onResize?: () => void) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const wrapElRef = useRef<HTMLDivElement | null>(null);
  const lastAppliedRef = useRef<{ w: number } | null>(null);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  const setup = useCallback(() => {
    const canvas = canvasElRef.current;
    const wrap = wrapElRef.current;
    if (!canvas || !wrap) return false;
    canvas.style.display = "block";
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(wrap.clientWidth));
    if (w === 0) return false;
    const last = lastAppliedRef.current;
    const settled = last !== null && Math.abs(w - last.w) < 2;
    if (!settled) {
      const needW = Math.floor(w * dpr);
      const needH = Math.floor(height * dpr);
      if (canvas.width !== needW || canvas.height !== needH) {
        canvas.width = needW;
        canvas.height = needH;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${height}px`;
      }
      lastAppliedRef.current = { w };
    }
    return true;
  }, [height]);

  /** Returns a DPR-scaled 2D context ready to draw in CSS pixels, or null if not mounted yet. */
  const getCtx = useCallback((): { ctx: CanvasRenderingContext2D; w: number; h: number } | null => {
    const canvas = canvasElRef.current;
    if (!canvas) return null;
    if (!setup()) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    return { ctx, w, h };
  }, [setup]);

  const canvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasElRef.current = el;
  }, []);
  const wrapRef = useCallback((el: HTMLDivElement | null) => {
    wrapElRef.current = el;
  }, []);

  useEffect(() => {
    const wrap = wrapElRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      setup();
      onResizeRef.current?.();
    });
    ro.observe(wrap);
    setup();
    onResizeRef.current?.();
    return () => ro.disconnect();
  }, [setup]);

  return { canvasRef, wrapRef, getCtx };
}
