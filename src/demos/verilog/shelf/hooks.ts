"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** True when the viewer asked for reduced motion; widgets then fall back to manual stepping. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * requestAnimationFrame ticker. Calls `onTick(steps)` with however many whole steps elapsed
 * since the last frame at `stepsPerSecond`. Stops entirely when `running` is false.
 */
export function useTicker(running: boolean, stepsPerSecond: number, onTick: (steps: number) => void): void {
  const cb = useRef(onTick);
  cb.current = onTick;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      acc += ((now - last) / 1000) * stepsPerSecond;
      last = now;
      const steps = Math.floor(acc);
      if (steps > 0) {
        acc -= steps;
        cb.current(Math.min(steps, 200));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, stepsPerSecond]);
}

/** Play/step state shared by the clocked widgets. Auto-run is disabled under reduced motion. */
export function usePlayback(defaultRunning = false) {
  const reduced = usePrefersReducedMotion();
  const [running, setRunning] = useState(defaultRunning);
  const toggle = useCallback(() => setRunning((r) => !r), []);
  return { running: running && !reduced, setRunning, toggle, reduced };
}

/** Fetches plain-text RTL from /demos/verilog/lib-src/<hw>/<file>. */
export function useRtlText(hw: string, file: string): { text: string | null; error: string | null } {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setText(null);
    setError(null);
    fetch(`/demos/verilog/lib-src/${hw}/${file}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [hw, file]);
  return { text, error };
}

/** Counter that bumps whenever `value` changes; useful as a React `key` to restart a CSS animation. */
export function useChangeKey(value: unknown): number {
  const [key, setKey] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setKey((k) => k + 1);
    }
  }, [value]);
  return key;
}
