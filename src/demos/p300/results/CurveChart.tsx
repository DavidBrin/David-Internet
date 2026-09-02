"use client";

import { useEffect, useId, useRef, useState } from "react";

interface CurveChartProps {
  /** Character accuracy percent, index i = repetition i+1. Expected length 15. */
  curve: number[];
  model: string;
  subject: string;
}

const VBW = 600;
const VBH = 260;
const PAD_L = 38;
const PAD_R = 14;
const PAD_T = 22;
const PAD_B = 30;
const DURATION_MS = 1500;

function ease(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * The hero chart: character accuracy vs. repetitions. Draws in left-to-right
 * once, the first time it is ~30% visible, then stays static. Strict-Mode
 * safe: the "already started" latch is only set from inside the observer
 * callback, never merely because the effect ran.
 */
export default function CurveChart({ curve, model, subject }: CurveChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const clipId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting || entry.intersectionRatio < 0.3) return;
        if (startedRef.current) return;
        startedRef.current = true;
        io.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION_MS);
          setProgress(ease(t));
          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            rafRef.current = null;
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      },
      { threshold: [0, 0.3, 1] },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  const n = curve.length;
  const plotW = VBW - PAD_L - PAD_R;
  const plotH = VBH - PAD_T - PAD_B;
  const xOf = (i: number) => PAD_L + (i / Math.max(1, n - 1)) * plotW;
  const yOf = (v: number) => PAD_T + (1 - v / 100) * plotH;

  const points = curve.map((v, i) => ({ x: xOf(i), y: yOf(v), v, rep: i + 1 }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const baseline = yOf(0);
  const areaD =
    points.length > 0
      ? `${pathD} L${points[points.length - 1].x.toFixed(2)},${baseline.toFixed(2)} L${points[0].x.toFixed(2)},${baseline.toFixed(2)} Z`
      : "";

  const gridVals = [0, 25, 50, 75, 100];
  const xTicks = [1, 5, 10, 15].filter((rep) => rep <= n);
  const fracAt = (i: number) => i / Math.max(1, n - 1);

  const showEarly = n > 0 && progress >= fracAt(0) + 0.03;
  const twelveIdx = 11;
  const showTwelve = n > twelveIdx && progress >= fracAt(twelveIdx) + 0.02;
  const flatFromIdx = 11;
  const flatToIdx = Math.min(n - 1, 14);
  const showFlat = n > flatFromIdx && progress >= 0.985;
  const flatX = n > flatFromIdx ? (xOf(flatFromIdx) + xOf(flatToIdx)) / 2 : 0;
  const flatVals = curve.slice(flatFromIdx, flatToIdx + 1);
  const flatAvg = flatVals.length > 0 ? flatVals.reduce((a, b) => a + b, 0) / flatVals.length : 0;
  const flatY = yOf(flatAvg);

  return (
    <div className="pR-curveWrap" ref={wrapRef}>
      <svg className="pR-curveSvg" viewBox={`0 0 ${VBW} ${VBH}`} role="img" aria-label="Character accuracy versus repetition count">
        {gridVals.map((v) => (
          <g key={v}>
            <line className="pR-grid" x1={PAD_L} x2={VBW - PAD_R} y1={yOf(v)} y2={yOf(v)} />
            <text className="pR-axisText" x={PAD_L - 6} y={yOf(v)} textAnchor="end" dominantBaseline="middle">
              {v}%
            </text>
          </g>
        ))}
        {xTicks.map((rep) => (
          <text key={rep} className="pR-axisText" x={xOf(rep - 1)} y={VBH - PAD_B + 14} textAnchor="middle">
            {rep}
          </text>
        ))}
        <text className="pR-axisTitle" x={(PAD_L + VBW - PAD_R) / 2} y={VBH - 4} textAnchor="middle">
          repetitions
        </text>

        {n > flatFromIdx && (
          <line
            className="pR-flatMark"
            x1={xOf(flatFromIdx)}
            x2={xOf(flatToIdx)}
            y1={baseline + 12}
            y2={baseline + 12}
            style={{ opacity: showFlat ? 0.6 : 0 }}
          />
        )}

        <clipPath id={clipId}>
          <rect x={PAD_L} y={0} width={Math.max(0, plotW * progress)} height={VBH} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <path className="pR-curveArea" d={areaD} />
          <path className="pR-curveLine" d={pathD} />
        </g>

        {points.map((p, i) => {
          const revealed = progress >= fracAt(i);
          return (
            <circle
              key={i}
              className="pR-dot"
              cx={p.x}
              cy={p.y}
              r={3.2}
              style={{
                opacity: revealed ? 1 : 0,
                transform: `scale(${revealed ? 1 : 0.2})`,
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            />
          );
        })}
      </svg>

      {n > 0 && (
        <div
          className="pR-annot pR-annotAbove"
          style={{ opacity: showEarly ? 1 : 0, left: `${(xOf(0) / VBW) * 100}%`, top: `${(yOf(curve[0]) / VBH) * 100}%` }}
        >
          {curve[0]}% after one repetition
        </div>
      )}
      {n > twelveIdx && (
        <div
          className="pR-annot pR-annotAbove"
          style={{
            opacity: showTwelve ? 1 : 0,
            left: `${(xOf(twelveIdx) / VBW) * 100}%`,
            top: `${(yOf(curve[twelveIdx]) / VBH) * 100}%`,
          }}
        >
          {curve[twelveIdx]}% by twelve
        </div>
      )}
      {n > flatFromIdx && (
        <div
          className="pR-annot pR-annotBelow"
          style={{ opacity: showFlat ? 1 : 0, left: `${(flatX / VBW) * 100}%`, top: `${(flatY / VBH) * 100}%` }}
        >
          more flashes stop helping
        </div>
      )}

      <p className="pR-curveCaption ppNote">
        {model}, subject {subject}, 100 test letters.
      </p>
    </div>
  );
}
