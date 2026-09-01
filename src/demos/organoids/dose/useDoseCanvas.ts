"use client";

/**
 * DPR-aware canvas draw-loop hook, same pattern as the ESP32 camera panel
 * (src/demos/esp32/camera/CameraPanel.tsx): callback refs so the effect notices
 * the canvas mount, a <2px-jitter guard on the wrap's measured size so a
 * ResizeObserver can't feed a resize back into itself, and a draw callback that
 * returns whether to keep animating (used here for the heatmap tween).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useDoseCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => boolean) {
  const [ready, setReady] = useState(false);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const wrapElRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
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

  const lastAppliedRef = useRef<{ w: number; h: number } | null>(null);

  const render = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const canvas = canvasElRef.current;
      const wrap = wrapElRef.current;
      if (!canvas || !wrap) return;
      canvas.style.display = "block";
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const last = lastAppliedRef.current;
      const settled = last !== null && Math.abs(w - last.w) < 2 && Math.abs(h - last.h) < 2;
      if (!settled) {
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        }
        lastAppliedRef.current = { w, h };
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const again = drawRef.current(ctx, w, h, now);
      if (again) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    render();
  }, [render, draw, ready]);

  useEffect(() => {
    const wrap = wrapElRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => render());
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [render, ready]);

  return { canvasRef, wrapRef };
}
