"use client";

/**
 * Group boxplots — mirrors the notebooks' boxplots_by_Param: one feature, grouped by the
 * scatter's color-by metadata. Box/median/whiskers/outlier dots per group, drawn to the full
 * population; when a brush is active, the brushed rows are overlaid as small jittered accent
 * dots on top of their group.
 */
import { useMemo } from "react";
import type { FeatureColumn, FeatureRow } from "../core/data";
import { hash01, quartiles } from "./stats";

const W = 760;
const H = 260;
const L = 46;
const R = 12;
const T = 14;
const B = 26;

interface GroupStat {
  g: string;
  n: number;
  q1: number;
  median: number;
  q3: number;
  whiskerLo: number;
  whiskerHi: number;
  outliers: number[];
}

interface GroupBoxplotsProps {
  rows: FeatureRow[];
  feature: FeatureColumn;
  groups: string[];
  groupOf: (row: FeatureRow) => string;
  groupColor: Map<string, string>;
  brushed: Set<number> | null;
}

export default function GroupBoxplots({ rows, feature, groups, groupOf, groupColor, brushed }: GroupBoxplotsProps) {
  const stats = useMemo<GroupStat[]>(() => {
    const byGroup = new Map<string, number[]>();
    for (const g of groups) byGroup.set(g, []);
    for (const r of rows) {
      const v = r[feature];
      if (v == null || !isFinite(v)) continue;
      const g = groupOf(r);
      const arr = byGroup.get(g);
      if (arr) arr.push(v);
    }
    return groups.map((g) => {
      const vals = (byGroup.get(g) ?? []).slice().sort((a, b) => a - b);
      if (vals.length === 0) {
        return { g, n: 0, q1: NaN, median: NaN, q3: NaN, whiskerLo: NaN, whiskerHi: NaN, outliers: [] };
      }
      const { q1, median, q3 } = quartiles(vals);
      const iqr = q3 - q1;
      const loFence = q1 - 1.5 * iqr;
      const hiFence = q3 + 1.5 * iqr;
      const inFence = vals.filter((v) => v >= loFence && v <= hiFence);
      const whiskerLo = inFence.length ? inFence[0] : vals[0];
      const whiskerHi = inFence.length ? inFence[inFence.length - 1] : vals[vals.length - 1];
      const outliers = vals.filter((v) => v < loFence || v > hiFence);
      return { g, n: vals.length, q1, median, q3, whiskerLo, whiskerHi, outliers };
    });
  }, [rows, feature, groups, groupOf]);

  const [yMin, yMax] = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of stats) {
      if (s.n === 0) continue;
      lo = Math.min(lo, s.whiskerLo, ...s.outliers);
      hi = Math.max(hi, s.whiskerHi, ...s.outliers);
    }
    if (!isFinite(lo)) return [0, 1];
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.08;
    return [lo - pad, hi + pad];
  }, [stats]);

  const pw = W - L - R;
  const ph = H - T - B;
  const band = groups.length > 0 ? pw / groups.length : pw;
  const boxWidth = Math.min(band * 0.5, 46);
  const yPix = (v: number) => T + (1 - (v - yMin) / (yMax - yMin || 1)) * ph;
  const yTicks = niceAxisTicks(yMin, yMax, 5);

  const brushedByGroup = useMemo(() => {
    const m = new Map<string, { idx: number; v: number }[]>();
    if (!brushed || brushed.size === 0) return m;
    for (const idx of brushed) {
      const r = rows[idx];
      if (!r) continue;
      const v = r[feature];
      if (v == null || !isFinite(v)) continue;
      const g = groupOf(r);
      let arr = m.get(g);
      if (!arr) {
        arr = [];
        m.set(g, arr);
      }
      arr.push({ idx, v });
    }
    return m;
  }, [brushed, rows, feature, groupOf]);

  return (
    <div className="skPopBoxWrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Boxplots of ${feature} by group`}>
        {yTicks.map((v) => (
          <g key={`gy-${v}`}>
            <line x1={L} x2={L + pw} y1={yPix(v)} y2={yPix(v)} className="skPopGrid" />
            <text x={L - 6} y={yPix(v)} className="skPopAxisText" textAnchor="end" dominantBaseline="middle">
              {formatTick(v)}
            </text>
          </g>
        ))}
        <rect x={L} y={T} width={pw} height={ph} className="skPopPlotFrame" />

        {stats.map((s, i) => {
          const cx = L + band * i + band / 2;
          const color = groupColor.get(s.g) ?? "#9a8b5a";
          if (s.n === 0) {
            return (
              <text key={s.g} x={cx} y={T + ph / 2} className="skPopAxisText" textAnchor="middle" dominantBaseline="middle">
                n/a
              </text>
            );
          }
          const boxX = cx - boxWidth / 2;
          const brushedPts = brushedByGroup.get(s.g) ?? [];
          return (
            <g key={s.g}>
              <line x1={cx} x2={cx} y1={yPix(s.whiskerLo)} y2={yPix(s.q1)} className="skPopWhisker" />
              <line x1={cx} x2={cx} y1={yPix(s.q3)} y2={yPix(s.whiskerHi)} className="skPopWhisker" />
              <line x1={cx - boxWidth * 0.25} x2={cx + boxWidth * 0.25} y1={yPix(s.whiskerLo)} y2={yPix(s.whiskerLo)} className="skPopWhisker" />
              <line x1={cx - boxWidth * 0.25} x2={cx + boxWidth * 0.25} y1={yPix(s.whiskerHi)} y2={yPix(s.whiskerHi)} className="skPopWhisker" />
              <rect
                x={boxX}
                y={yPix(s.q3)}
                width={boxWidth}
                height={Math.max(1, yPix(s.q1) - yPix(s.q3))}
                fill={color}
                fillOpacity={0.28}
                stroke={color}
                strokeWidth={1.3}
              />
              <line x1={boxX} x2={boxX + boxWidth} y1={yPix(s.median)} y2={yPix(s.median)} stroke={color} strokeWidth={2} />
              {s.outliers.map((v, k) => (
                <circle key={k} cx={cx} cy={yPix(v)} r={2} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={1} />
              ))}
              {brushedPts.map(({ idx, v }) => (
                <circle
                  key={idx}
                  cx={cx + (hash01(idx) - 0.5) * boxWidth * 0.8}
                  cy={yPix(v)}
                  r={2.2}
                  fill="#f59e0b"
                  stroke="#7c4a03"
                  strokeWidth={0.6}
                />
              ))}
              <text x={cx} y={T + ph + 14} className="skPopAxisText" textAnchor="middle">
                {truncateLabel(s.g)}
              </text>
              <text x={cx} y={T + ph + 24} className="skPopAxisTextMuted" textAnchor="middle">
                n={s.n}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function niceAxisTicks(min: number, max: number, count: number): number[] {
  if (!isFinite(min) || !isFinite(max) || min === max) return [min];
  const span = max - min;
  const rawStep = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step: number;
  if (norm < 1.5) step = mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-6; v += step) out.push(Math.round(v / step) * step);
  return out;
}

function formatTick(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

function truncateLabel(s: string): string {
  return s.length > 10 ? `${s.slice(0, 9)}…` : s;
}
