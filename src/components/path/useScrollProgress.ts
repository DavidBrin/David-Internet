"use client";
/**
 * The single shared scroll-progress engine for /path.
 *
 * One rAF loop per page:
 *  - every element carrying [data-progress] under `root` gets a `--sp` CSS var
 *    (0 → 1 as it crosses the viewport); all wash/reveal/parallax effects are
 *    pure CSS driven by that var.
 *  - `root` gets `--gp` (whole-page progress) and `--river-progress`
 *    (progress through the journey container, where the river lives).
 *  - the active phase index (section under the viewport center) is exposed as
 *    React state for the backdrop crossfade.
 *
 * prefers-reduced-motion: the loop never starts; everything is set once to its
 * fully-revealed end state (river fully drawn, no rain, no parallax drift).
 */
import { useEffect, useRef, useState } from "react";

export interface FrameInfo {
  /** 0→1 through the journey container (drives the river draw + wet edge). */
  riverProgress: number;
  scrollY: number;
  viewportH: number;
}

interface Options {
  /** Page root — receives --gp / --river-progress; scoped [data-progress] scan. */
  root: React.RefObject<HTMLElement | null>;
  /** The journey column the river SVG spans. */
  journey: React.RefObject<HTMLElement | null>;
  /** Called every frame after vars are written (imperative extras: wet edge). */
  onFrame?: (info: FrameInfo) => void;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function useScrollProgress({ root, journey, onFrame }: Options) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    const rootEl = root.current;
    if (!rootEl) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isReduced = mq.matches;
    setReduced(isReduced);

    let raf = 0;
    let running = true;

    const frame = () => {
      if (!running) return;
      const vh = window.innerHeight;
      const scrollY = window.scrollY;

      // Per-element progress: 0 when the element's top hits the viewport
      // bottom, 1 when its bottom leaves the top.
      const tracked = rootEl.querySelectorAll<HTMLElement>("[data-progress]");
      tracked.forEach((el) => {
        const r = el.getBoundingClientRect();
        // "scrub" = progress through a taller-than-viewport pinned section
        // (0 at its start even when it opens the page); default = progress
        // crossing the viewport.
        const p = isReduced
          ? 1
          : el.dataset.progress === "scrub"
            ? clamp01(-r.top / Math.max(1, r.height - vh))
            : clamp01((vh - r.top) / (vh + r.height));
        el.style.setProperty("--sp", p.toFixed(4));
      });

      // Whole-page progress.
      const doc = document.documentElement;
      const gp = clamp01(scrollY / Math.max(1, doc.scrollHeight - vh));
      rootEl.style.setProperty("--gp", gp.toFixed(4));

      // River progress: wet edge sits ~62% down the viewport.
      let riverProgress = isReduced ? 1 : 0;
      const journeyEl = journey.current;
      if (journeyEl && !isReduced) {
        const jr = journeyEl.getBoundingClientRect();
        riverProgress = clamp01((vh * 0.62 - jr.top) / Math.max(1, jr.height));
      }
      rootEl.style.setProperty("--river-progress", riverProgress.toFixed(4));

      // Active phase = section band covering the viewport center.
      const sections = rootEl.querySelectorAll<HTMLElement>("[data-phase-index]");
      let active = 0;
      sections.forEach((el) => {
        const r = el.getBoundingClientRect();
        // A phase owns the backdrop until the NEXT section nears the top of
        // the viewport, so late set-pieces still play in their own world.
        if (r.top <= vh * 0.2) active = Number(el.dataset.phaseIndex);
      });
      setActiveIndex((prev) => (prev === active ? prev : active));

      onFrameRef.current?.({ riverProgress, scrollY, viewportH: vh });

      if (!isReduced) raf = requestAnimationFrame(frame);
    };

    if (isReduced) {
      // One pass now + on resize/scroll (cheap; state still tracks position).
      frame();
      const onScroll = () => frame();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      return () => {
        running = false;
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      };
    }

    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [root, journey]);

  return { activeIndex, reduced };
}
