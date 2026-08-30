"use client";
/**
 * RiverRibbon — the SVG water path spanning the whole journey column.
 *
 * Geometry is generated from the *measured* layout (each phase section's top /
 * height in px), so the river genuinely passes each chapter. The viewBox is
 * 1000 units wide × container-height px tall with preserveAspectRatio="none":
 * y-coordinates are real pixels, x stretches to the column width.
 *
 * Each path is drawn three times (glow / body / highlight) and revealed with
 * the stroke-dash trick. The dash math lives in CSS, driven by
 * --river-progress (set by useScrollProgress) plus per-path --p0/--pspan
 * (the slice of global progress this path draws over) and --len (measured).
 */
import { useEffect, useRef } from "react";

export interface PhaseGeom {
  top: number;
  height: number;
  /** 0–1000 horizontal position of the river through this phase. */
  x: number;
  branch: boolean;
  isDelta: boolean;
  /** Number of delta distributaries (delta phase only). */
  fanCount?: number;
}

interface Props {
  phases: PhaseGeom[];
  /** Total journey-container height in px. */
  height: number;
  /** Receives the main path element once, for wet-edge positioning. */
  onMainPath?: (el: SVGPathElement | null) => void;
}

interface Pt {
  x: number;
  y: number;
}

/** Catmull-Rom → cubic bezier path string through the given points. */
function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Deterministic wiggle so meanders feel hand-drawn, stable across renders. */
const wiggle = (i: number, amp: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return ((s - Math.floor(s)) - 0.5) * 2 * amp;
};

export default function RiverRibbon({ phases, height, onMainPath }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mainRef = useRef<SVGPathElement>(null);

  // ---- main channel (+ branch loops anchored to its real points) ----
  const mainPts: Pt[] = [{ x: 500, y: -20 }];
  const branches: { d: string; y0: number; y1: number; key: string }[] = [];
  let deltaPhase: PhaseGeom | null = null;
  phases.forEach((ph, i) => {
    if (ph.isDelta) {
      deltaPhase = ph;
      // The main channel terminates a little into the delta section.
      mainPts.push({ x: 500, y: ph.top + ph.height * 0.18 });
      return;
    }
    const a: Pt = { x: ph.x + wiggle(i, 40), y: ph.top + ph.height * 0.45 };
    const b: Pt = { x: ph.x + wiggle(i + 50, 60), y: ph.top + ph.height * 0.85 };
    mainPts.push(a, b);

    if (ph.branch) {
      // Diverge at the phase's first main anchor, rejoin at the second, and
      // bulge to the riverside away from the content card.
      const away = ph.x > 500 ? ph.x + 230 : ph.x - 230;
      const pts: Pt[] = [
        a,
        { x: (a.x + away) / 2, y: a.y + (b.y - a.y) * 0.22 },
        { x: away, y: a.y + (b.y - a.y) * 0.5 },
        { x: (b.x + away) / 2, y: a.y + (b.y - a.y) * 0.78 },
        b,
      ];
      branches.push({ d: smoothPath(pts), y0: a.y, y1: b.y, key: `branch-${ph.top}` });
    }
  });
  if (!deltaPhase) mainPts.push({ x: 500, y: height + 20 });
  const mainD = smoothPath(mainPts);

  // ---- delta fan ----
  const fans: { d: string; y0: number; y1: number; key: string }[] = [];
  if (deltaPhase) {
    const ph: PhaseGeom = deltaPhase;
    const n = ph.fanCount ?? 5;
    const yStart = ph.top + ph.height * 0.18;
    const yEnd = ph.top + ph.height * 0.86;
    for (let i = 0; i < n; i++) {
      const xEnd = 90 + (820 / Math.max(1, n - 1)) * i;
      const pts: Pt[] = [
        { x: 500, y: yStart },
        { x: 500 + (xEnd - 500) * 0.35 + wiggle(i, 30), y: yStart + (yEnd - yStart) * 0.45 },
        { x: xEnd, y: yEnd },
      ];
      fans.push({ d: smoothPath(pts), y0: yStart, y1: yEnd, key: `fan-${i}` });
    }
  }

  // Measure path lengths → CSS vars for the dash-draw math.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.querySelectorAll<SVGGElement>("g[data-river-path]").forEach((g) => {
      const p = g.querySelector<SVGPathElement>("path");
      if (!p) return;
      const len = p.getTotalLength();
      g.style.setProperty("--len", `${len.toFixed(0)}px`);
      g.classList.add("riverPath--measured");
    });
    onMainPath?.(mainRef.current);
    return () => onMainPath?.(null);
  }, [mainD, onMainPath]);

  const slice = (y0: number, y1: number) => ({
    "--p0": (y0 / height).toFixed(4),
    "--pspan": Math.max(0.0001, (y1 - y0) / height).toFixed(4),
  }) as React.CSSProperties;

  const strokes = (d: string, main = false) => (
    <>
      <path className="riverStroke riverStroke--glow" d={d} />
      <path className="riverStroke riverStroke--body" d={d} ref={main ? mainRef : undefined} />
      <path className="riverStroke riverStroke--shine" d={d} />
    </>
  );

  return (
    <svg
      ref={svgRef}
      className="riverSvg"
      viewBox={`0 0 1000 ${Math.max(1, Math.round(height))}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {branches.map((b) => (
        <g key={b.key} data-river-path className="riverPath riverPath--branch" style={slice(b.y0, b.y1)}>
          {strokes(b.d)}
        </g>
      ))}
      <g data-river-path className="riverPath riverPath--main" style={slice(0, height)}>
        {strokes(mainD, true)}
      </g>
      {fans.map((f) => (
        <g key={f.key} data-river-path className="riverPath riverPath--fan" style={slice(f.y0, f.y1)}>
          {strokes(f.d)}
        </g>
      ))}
    </svg>
  );
}
