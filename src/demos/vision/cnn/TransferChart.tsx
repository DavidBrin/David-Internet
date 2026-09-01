"use client";

import { useMemo, useState } from "react";
import type { TransferRun } from "./types";

const COLORS: Record<string, string> = {
  "scratch-0-4": "#ef4444",
  "finetune-0-4": "#22c55e",
  "scratch-5-9": "#f59e0b",
  "finetune-5-9": "#0ea5e9",
};

const W = 620;
const H = 300;
const MARGIN = { top: 16, right: 16, bottom: 34, left: 46 };
const PLOT_W = W - MARGIN.left - MARGIN.right;
const PLOT_H = H - MARGIN.top - MARGIN.bottom;

function niceTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}

export default function TransferChart({ epochs, runs }: { epochs: number[]; runs: TransferRun[] }) {
  const [metric, setMetric] = useState<"loss" | "acc">("loss");
  const [logScale, setLogScale] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const values = useMemo(() => {
    return runs.map((r) => ({ run: r.run, label: r.label, values: metric === "loss" ? r.loss : r.acc }));
  }, [runs, metric]);

  const useLog = metric === "loss" && logScale;

  const [yMin, yMax] = useMemo(() => {
    const all = values.flatMap((v) => v.values);
    if (metric === "acc") return [60, 100];
    if (useLog) {
      const positive = all.filter((v) => v > 0);
      return [Math.min(...positive), Math.max(...positive)];
    }
    return [0, Math.max(...all)];
  }, [values, metric, useLog]);

  const xMin = epochs[0];
  const xMax = epochs[epochs.length - 1];

  const xScale = (e: number) => MARGIN.left + ((e - xMin) / (xMax - xMin)) * PLOT_W;
  const yScale = (v: number) => {
    const norm = useLog
      ? (Math.log10(Math.max(v, yMin)) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin) || 1)
      : (v - yMin) / (yMax - yMin || 1);
    return MARGIN.top + (1 - norm) * PLOT_H;
  };

  const yTicks = useMemo(() => {
    if (useLog) {
      const lo = Math.floor(Math.log10(yMin));
      const hi = Math.ceil(Math.log10(yMax));
      const ticks: number[] = [];
      for (let p = lo; p <= hi; p++) ticks.push(10 ** p);
      return ticks;
    }
    return niceTicks(yMin, yMax, 5);
  }, [useLog, yMin, yMax]);

  const paths = values.map((v) => {
    const d = epochs.map((e, i) => `${i === 0 ? "M" : "L"}${xScale(e).toFixed(2)},${yScale(v.values[i]).toFixed(2)}`).join(" ");
    return { ...v, d, color: COLORS[v.run] ?? "#888" };
  });

  const scratch04 = runs.find((r) => r.run === "scratch-0-4");
  const finetune04 = runs.find((r) => r.run === "finetune-0-4");
  const epoch10Idx = epochs.indexOf(10);

  return (
    <div className="vsCnChart">
      <div className="vsRow vsCnChartControls">
        <div className="vsRow" style={{ gap: 6 }}>
          <button type="button" className="vsBtn" data-active={metric === "loss"} onClick={() => setMetric("loss")}>
            Loss
          </button>
          <button type="button" className="vsBtn" data-active={metric === "acc"} onClick={() => setMetric("acc")}>
            Accuracy
          </button>
        </div>
        {metric === "loss" && (
          <button type="button" className="vsBtn" data-active={logScale} onClick={() => setLogScale((s) => !s)}>
            log scale
          </button>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="vsCnChartSvg" role="img" aria-label={`STL-10 transfer study, ${metric}`}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={MARGIN.left}
              x2={W - MARGIN.right}
              y1={yScale(t)}
              y2={yScale(t)}
              className="vsCnGrid"
            />
            <text x={MARGIN.left - 8} y={yScale(t)} className="vsCnAxisLabel" textAnchor="end" dominantBaseline="middle">
              {metric === "acc" ? `${t.toFixed(0)}` : useLog ? t.toExponential(0) : t.toFixed(2)}
            </text>
          </g>
        ))}
        {epochs.map((e) => (
          <text key={e} x={xScale(e)} y={H - MARGIN.bottom + 16} className="vsCnAxisLabel" textAnchor="middle">
            {e}
          </text>
        ))}
        <text x={W / 2} y={H - 4} className="vsCnAxisTitle" textAnchor="middle">
          epoch
        </text>

        {paths.map((p) => (
          <path
            key={p.run}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={hovered === p.run ? 3.5 : 2}
            opacity={hovered && hovered !== p.run ? 0.25 : 1}
            pathLength={1}
            className="vsCnLine"
            style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
          />
        ))}
      </svg>

      <div className="vsCnLegend">
        {paths.map((p) => (
          <button
            type="button"
            key={p.run}
            className="vsCnLegendItem"
            onMouseEnter={() => setHovered(p.run)}
            onMouseLeave={() => setHovered(null)}
            data-dim={hovered !== null && hovered !== p.run}
          >
            <span className="vsCnSwatch" style={{ background: p.color }} />
            {p.label}
          </button>
        ))}
      </div>

      {scratch04 && finetune04 && epoch10Idx >= 0 && (
        <p className="vsBwCaption vsCnCaption">
          Fine-tuning only the fc layer on new classes converges faster than training from scratch &mdash; loss
          at epoch 10: <span className="vsMono">{finetune04.loss[epoch10Idx].toFixed(3)}</span> (fine-tune) vs{" "}
          <span className="vsMono">{scratch04.loss[epoch10Idx].toFixed(2)}</span> (scratch).
        </p>
      )}
    </div>
  );
}
