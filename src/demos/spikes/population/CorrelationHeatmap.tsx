"use client";

/**
 * Correlation-heatmap mode — mirrors the notebooks' plot_correlation_heatmaps: Pearson r across
 * all 11 feature columns, computed pairwise (rows missing either value are dropped for that
 * pair) over the brushed subset (or the whole table with no brush). Cells cross-fade over 150ms
 * when the subset changes, the same "prev -> cur" morph pattern used elsewhere in this demo.
 */
import { useCallback, useMemo, useRef } from "react";
import { FEATURE_COLUMNS, type FeatureRow } from "../core/data";
import { coolwarm, pearson } from "./stats";
import { useCanvas } from "./useCanvas";

const SHORT: Record<(typeof FEATURE_COLUMNS)[number], string> = {
  ramp_amp: "ramp_amp",
  inflection_time: "infl_t",
  inflection_amp: "infl_amp",
  peak_amp: "peak_amp",
  peak_width: "peak_w",
  peak_sharpness: "peak_sh",
  exp_lambda: "λ",
  exp_const: "exp_c",
  isi: "isi",
  r_squared_ramp: "r²_ramp",
  r_squared_exp: "r²_exp",
};

const ANIM_MS = 150;

function computeMatrix(rows: FeatureRow[]): number[][] {
  const cols = FEATURE_COLUMNS;
  const n = cols.length;
  const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(NaN));
  for (let i = 0; i < n; i++) {
    m[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (const r of rows) {
        const xv = r[cols[i]];
        const yv = r[cols[j]];
        if (xv == null || yv == null || !isFinite(xv) || !isFinite(yv)) continue;
        xs.push(xv);
        ys.push(yv);
      }
      const c = pearson(xs, ys);
      m[i][j] = c;
      m[j][i] = c;
    }
  }
  return m;
}

interface CorrelationHeatmapProps {
  rows: FeatureRow[];
}

export default function CorrelationHeatmap({ rows }: CorrelationHeatmapProps) {
  const matrix = useMemo(() => computeMatrix(rows), [rows]);

  const prevRef = useRef<number[][] | null>(null);
  const curRef = useRef<number[][] | null>(null);
  const animStartRef = useRef(0);
  if (curRef.current !== matrix) {
    if (curRef.current) {
      prevRef.current = curRef.current;
      animStartRef.current = performance.now();
    }
    curRef.current = matrix;
  }

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number, now: number) => {
      const cur = curRef.current!;
      const prev = prevRef.current;
      const t = prev ? Math.min(1, (now - animStartRef.current) / ANIM_MS) : 1;

      ctx.fillStyle = "#fffdf6";
      ctx.fillRect(0, 0, W, H);

      const n = FEATURE_COLUMNS.length;
      const L = 76;
      const T = 62;
      const R = 8;
      const B = 8;
      const cell = Math.max(8, Math.min((W - L - R) / n, (H - T - B) / n));

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const a = prev ? prev[i][j] : cur[i][j];
          const b = cur[i][j];
          const av = isFinite(a) ? a : b;
          const bv = isFinite(b) ? b : a;
          const v = isFinite(av) && isFinite(bv) ? av + (bv - av) * t : NaN;
          const x = L + j * cell;
          const y = T + i * cell;
          ctx.fillStyle = isFinite(v) ? coolwarm(v) : "#eee5cc";
          ctx.fillRect(x, y, cell - 1, cell - 1);
          ctx.fillStyle = isFinite(v) && Math.abs(v) > 0.55 ? "#fff" : "#3a3020";
          ctx.font = `${Math.max(8, Math.min(11, cell * 0.26))}px ui-monospace, Menlo, Consolas, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(isFinite(v) ? v.toFixed(2) : "–", x + cell / 2, y + cell / 2);
        }
      }

      ctx.fillStyle = "#4a3f20";
      ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i < n; i++) {
        ctx.fillText(SHORT[FEATURE_COLUMNS[i]], L - 6, T + i * cell + cell / 2);
      }
      for (let j = 0; j < n; j++) {
        ctx.save();
        ctx.translate(L + j * cell + cell / 2, T - 6);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(SHORT[FEATURE_COLUMNS[j]], 0, 0);
        ctx.restore();
      }

      return t < 1;
    },
    [matrix],
  );

  const { canvasRef, wrapRef } = useCanvas(draw);

  return (
    <div ref={wrapRef} className="skPopCorrWrap">
      <canvas ref={canvasRef} role="img" aria-label="Correlation heatmap of the 11 feature columns" />
    </div>
  );
}
