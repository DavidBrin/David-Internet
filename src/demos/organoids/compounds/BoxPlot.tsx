"use client";

/**
 * Dose-response boxplot — mirrors plot_aperiodic_boxplot / plot_peak_boxplot2
 * (knee mode): raw per-well points, jittered within their compound group,
 * animate into place; a box + whiskers summarize the group underneath them.
 * Well identity (r,c) is the animation key, so the same point tweens on
 * every parameter/day/stim-filter change instead of remounting.
 */
import { useEffect, useMemo, useRef, useState } from "react";

export interface BoxPlotPoint {
  key: string;
  value: number;
  group: string;
}

export interface BoxPlotGroup {
  key: string;
  label: string;
  color: string;
}

interface Props {
  points: BoxPlotPoint[];
  groups: BoxPlotGroup[];
  yLabel: string;
  yFormat?: (v: number) => string;
  height?: number;
}

const VB_W = 720;

function strHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function percentile(sorted: number[], q: number): number {
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

interface Stats {
  q1: number;
  median: number;
  q3: number;
  loWhisker: number;
  hiWhisker: number;
  n: number;
}

function boxStats(values: number[]): Stats | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const median = percentile(sorted, 0.5);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const loBound = q1 - 1.5 * iqr;
  const hiBound = q3 + 1.5 * iqr;
  let loWhisker = sorted[0];
  let hiWhisker = sorted[sorted.length - 1];
  for (const v of sorted) {
    if (v >= loBound) {
      loWhisker = v;
      break;
    }
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i] <= hiBound) {
      hiWhisker = sorted[i];
      break;
    }
  }
  return { q1, median, q3, loWhisker, hiWhisker, n: sorted.length };
}

interface Pos {
  x: number;
  y: number;
  color: string;
}

export default function BoxPlot({ points, groups, yLabel, yFormat, height = 340 }: Props) {
  const margin = { top: 14, right: 16, bottom: 40, left: 56 };
  const plotW = VB_W - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const colW = plotW / Math.max(1, groups.length);

  const domain = useMemo<[number, number]>(() => {
    if (points.length === 0) return [0, 1];
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of points) {
      if (p.value < lo) lo = p.value;
      if (p.value > hi) hi = p.value;
    }
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.15;
    return [lo - pad, hi + pad];
  }, [points]);

  const yOf = (v: number) => margin.top + plotH * (1 - (v - domain[0]) / (domain[1] - domain[0]));

  const byGroup = useMemo(() => {
    const m = new Map<string, BoxPlotPoint[]>();
    for (const g of groups) m.set(g.key, []);
    for (const p of points) m.get(p.group)?.push(p);
    return m;
  }, [points, groups]);

  const targets = useMemo(() => {
    const out = new Map<string, Pos>();
    groups.forEach((g, gi) => {
      const gx = margin.left + colW * (gi + 0.5);
      for (const p of byGroup.get(g.key) ?? []) {
        const jitter = (strHash(p.key + ":" + p.group) - 0.5) * colW * 0.55;
        out.set(p.key, { x: gx + jitter, y: yOf(p.value), color: g.color });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, byGroup, colW, domain]);

  const [renderPos, setRenderPos] = useState<Map<string, Pos>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setRenderPos((prev) => {
      const next = new Map(prev);
      for (const [key, t] of targets) {
        if (!seenRef.current.has(key)) {
          const scatterX = margin.left + strHash(key + "#scatter") * plotW;
          next.set(key, { x: scatterX, y: t.y, color: t.color });
          seenRef.current.add(key);
        }
      }
      for (const key of Array.from(next.keys())) {
        if (!targets.has(key)) {
          next.delete(key);
          seenRef.current.delete(key);
        }
      }
      return next;
    });
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setRenderPos((prev) => {
          const next = new Map(prev);
          for (const [key, t] of targets) next.set(key, t);
          return next;
        });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets]);

  const stats = groups.map((g) => ({ g, s: boxStats((byGroup.get(g.key) ?? []).map((p) => p.value)) }));
  const nTicks = 5;
  const tickVals = Array.from({ length: nTicks }, (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / (nTicks - 1));

  return (
    <svg className="ogCmpBox" viewBox={`0 0 ${VB_W} ${height}`} role="img" aria-label={`Dose-response boxplot of ${yLabel}`}>
      {tickVals.map((v, i) => (
        <g key={i}>
          <line className="ogCmpBoxGrid" x1={margin.left} x2={VB_W - margin.right} y1={yOf(v)} y2={yOf(v)} />
          <text className="ogCmpBoxAxisLabel" x={margin.left - 8} y={yOf(v)} textAnchor="end" dominantBaseline="middle">
            {yFormat ? yFormat(v) : v.toFixed(2)}
          </text>
        </g>
      ))}
      <text className="ogCmpBoxAxisTitle" transform={`translate(14 ${height / 2}) rotate(-90)`} textAnchor="middle">
        {yLabel}
      </text>

      {stats.map(({ g, s }, gi) => {
        const gx = margin.left + colW * (gi + 0.5);
        const boxHalf = colW * 0.24;
        return (
          <g key={g.key}>
            <text className="ogCmpBoxGroupLabel" x={gx} y={height - margin.bottom + 20} textAnchor="middle" fill={g.color}>
              {g.label}
            </text>
            {s && s.n >= 2 && (
              <g className="ogCmpBoxShape">
                <line className="ogCmpBoxWhisker" x1={gx} x2={gx} y1={yOf(s.loWhisker)} y2={yOf(s.q1)} stroke={g.color} />
                <line className="ogCmpBoxWhisker" x1={gx} x2={gx} y1={yOf(s.q3)} y2={yOf(s.hiWhisker)} stroke={g.color} />
                <line className="ogCmpBoxCap" x1={gx - boxHalf * 0.5} x2={gx + boxHalf * 0.5} y1={yOf(s.loWhisker)} y2={yOf(s.loWhisker)} stroke={g.color} />
                <line className="ogCmpBoxCap" x1={gx - boxHalf * 0.5} x2={gx + boxHalf * 0.5} y1={yOf(s.hiWhisker)} y2={yOf(s.hiWhisker)} stroke={g.color} />
                <rect
                  className="ogCmpBoxRect"
                  x={gx - boxHalf}
                  y={yOf(s.q3)}
                  width={boxHalf * 2}
                  height={Math.max(1, yOf(s.q1) - yOf(s.q3))}
                  fill={g.color}
                  stroke={g.color}
                />
                <line className="ogCmpBoxMedian" x1={gx - boxHalf} x2={gx + boxHalf} y1={yOf(s.median)} y2={yOf(s.median)} stroke={g.color} />
              </g>
            )}
          </g>
        );
      })}

      {Array.from(renderPos.entries()).map(([key, p]) => (
        <circle key={key} className="ogCmpBoxPoint" cx={p.x} cy={p.y} r={3.6} fill={p.color} />
      ))}
    </svg>
  );
}
