"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * DPR-aware canvas sized to its wrapper's width at a fixed aspect ratio (h = w / aspect),
 * shared by the autonomous-car panels.
 * - canvas.style.display = "block" is set imperatively (no inline baseline gap feeding
 *   the ResizeObserver a growing height).
 * - resizes smaller than 2 px are ignored.
 * - `draw(ctx, w, h)` runs in CSS pixels; call the returned `redraw()` from animation
 *   loops instead of re-rendering React.
 */
export function useFitCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, aspect: number) {
  const [ready, setReady] = useState(false);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const wrapEl = useRef<HTMLDivElement | null>(null);
  const size = useRef<{ w: number; h: number } | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const canvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasEl.current = el;
    if (el) setReady(true);
  }, []);
  const wrapRef = useCallback((el: HTMLDivElement | null) => {
    wrapEl.current = el;
    if (el) setReady(true);
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasEl.current;
    const wrap = wrapEl.current;
    if (!canvas || !wrap) return;
    canvas.style.display = "block";
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(wrap.clientWidth));
    const h = Math.max(1, Math.round(w / aspect));
    const last = size.current;
    if (!last || Math.abs(w - last.w) >= 2 || Math.abs(h - last.h) >= 2) {
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
  }, [aspect]);

  useEffect(() => {
    redraw();
  }, [redraw, draw, ready]);

  useEffect(() => {
    const wrap = wrapEl.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw, ready]);

  return { canvasRef, wrapRef, redraw };
}

/** Run `step(dt)` every animation frame while `running`; pauses when the tab is hidden. */
export function useRaf(step: (dt: number) => void, running: boolean) {
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!running) return;
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      stepRef.current(dt);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [running]);
}

/** true once the element has scrolled near the viewport (so heavy panels start lazily). */
export function useNearViewport<T extends Element>(margin = "300px") {
  const [near, setNear] = useState(false);
  const ref = useCallback(
    (el: T | null) => {
      if (!el || near) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setNear(true);
            io.disconnect();
          }
        },
        { rootMargin: margin },
      );
      io.observe(el);
    },
    [near, margin],
  );
  return { ref, near };
}
