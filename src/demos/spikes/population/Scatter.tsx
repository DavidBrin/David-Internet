"use client";

/**
 * The population scatter: pick two feature columns, brush a rectangle with the pointer, and the
 * brushed row indices feed the waveform overlay / boxplot highlight / correlation subset.
 *
 * Axis scaling is robust: the domain clamps to [p1, p99] of the plotted column (isi is
 * heavy-tailed, so it's drawn log-scaled automatically) and points outside that range are
 * clamped to the plot edge rather than dropped, so an extreme outlier still reads as "off to the
 * side" instead of vanishing.
 */
import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { FeatureColumn, FeatureRow } from "../core/data";
import { formatNum, makeScale, percentile } from "./stats";
import { useCanvas } from "./useCanvas";

const INK = "#4a3f20";
const MUTED = "#8a7a4e";
const GRID = "#e7dcbb";
const POINT_R = 2.5;

interface Plotted {
  idx: number;
  xv: number;
  yv: number;
}

interface PointsPx {
  idx: number[];
  px: Float32Array;
  py: Float32Array;
}

function computeDomain(rows: FeatureRow[], col: FeatureColumn, log: boolean): [number, number] {
  const vals: number[] = [];
  for (const r of rows) {
    const v = r[col];
    if (v == null || !isFinite(v)) continue;
    vals.push(log ? Math.log10(Math.max(v, 1e-6)) : v);
  }
  if (vals.length === 0) return [0, 1];
  vals.sort((a, b) => a - b);
  let lo = percentile(vals, 1);
  let hi = percentile(vals, 99);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  return [lo, hi];
}

interface ScatterProps {
  rows: FeatureRow[];
  xCol: FeatureColumn;
  yCol: FeatureColumn;
  groupOf: (row: FeatureRow) => string;
  groupColor: Map<string, string>;
  brushed: Set<number> | null;
  onBrushChange: (indices: Set<number> | null) => void;
}

export default function Scatter({ rows, xCol, yCol, groupOf, groupColor, brushed, onBrushChange }: ScatterProps) {
  const useLogX = xCol === "isi";
  const useLogY = yCol === "isi";

  const plotted = useMemo<Plotted[]>(() => {
    const out: Plotted[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const xv = r[xCol];
      const yv = r[yCol];
      if (xv == null || !isFinite(xv) || yv == null || !isFinite(yv)) continue;
      out.push({ idx: i, xv, yv });
    }
    return out;
  }, [rows, xCol, yCol]);

  const xDomain = useMemo(() => computeDomain(rows, xCol, useLogX), [rows, xCol, useLogX]);
  const yDomain = useMemo(() => computeDomain(rows, yCol, useLogY), [rows, yCol, useLogY]);

  const pointsPxRef = useRef<PointsPx>({ idx: [], px: new Float32Array(0), py: new Float32Array(0) });
  const draggingRef = useRef(false);
  const anchorRef = useRef({ x: 0, y: 0 });
  const [dragRect, setDragRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number) => {
      ctx.fillStyle = "#fffdf6";
      ctx.fillRect(0, 0, W, H);

      const L = 52;
      const R = 12;
      const T = 12;
      const B = 30;
      const pw = Math.max(10, W - L - R);
      const ph = Math.max(10, H - T - B);

      const xScale = makeScale(xDomain, useLogX);
      const yScale = makeScale(yDomain, useLogY);
      const xPix = (v: number) => L + xScale(v) * pw;
      const yPix = (v: number) => T + (1 - yScale(v)) * ph;

      // grid + ticks
      ctx.strokeStyle = GRID;
      ctx.fillStyle = MUTED;
      ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
      ctx.lineWidth = 1;

      const xTicks = useLogX
        ? tickRange(xDomain).map((e) => Math.pow(10, e))
        : niceTicksInDomain(xDomain);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const v of xTicks) {
        const x = Math.round(xPix(v)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, T);
        ctx.lineTo(x, T + ph);
        ctx.stroke();
        ctx.fillText(formatNum(v), x, T + ph + 4);
      }
      const yTicks = useLogY
        ? tickRange(yDomain).map((e) => Math.pow(10, e))
        : niceTicksInDomain(yDomain);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const v of yTicks) {
        const y = Math.round(yPix(v)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(L, y);
        ctx.lineTo(L + pw, y);
        ctx.stroke();
        ctx.fillText(formatNum(v), L - 5, y);
      }

      ctx.strokeStyle = INK;
      ctx.strokeRect(L + 0.5, T + 0.5, pw - 1, ph - 1);

      // axis labels
      ctx.fillStyle = INK;
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${xCol}${useLogX ? " (log)" : ""}`, L + pw / 2, H - 4);
      ctx.save();
      ctx.translate(12, T + ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText(`${yCol}${useLogY ? " (log)" : ""}`, 0, 0);
      ctx.restore();

      // points
      const idxArr: number[] = new Array(plotted.length);
      const pxArr = new Float32Array(plotted.length);
      const pyArr = new Float32Array(plotted.length);
      const hasBrush = brushed !== null && brushed.size > 0;

      for (let k = 0; k < plotted.length; k++) {
        const p = plotted[k];
        const x = xPix(p.xv);
        const y = yPix(p.yv);
        idxArr[k] = p.idx;
        pxArr[k] = x;
        pyArr[k] = y;
        const row = rows[p.idx];
        const color = groupColor.get(groupOf(row)) ?? "#9a8b5a";
        const isSel = hasBrush && brushed!.has(p.idx);
        let alpha: number;
        let r: number;
        if (!hasBrush) {
          alpha = 0.55;
          r = POINT_R;
        } else if (isSel) {
          alpha = 0.95;
          r = POINT_R + 0.6;
        } else {
          alpha = 0.08;
          r = POINT_R;
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      pointsPxRef.current = { idx: idxArr, px: pxArr, py: pyArr };

      // live drag rectangle
      if (dragRect) {
        const x0 = Math.min(dragRect.x0, dragRect.x1);
        const x1 = Math.max(dragRect.x0, dragRect.x1);
        const y0 = Math.min(dragRect.y0, dragRect.y1);
        const y1 = Math.max(dragRect.y0, dragRect.y1);
        ctx.fillStyle = "rgba(245,158,11,0.12)";
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.strokeStyle = "#d97706";
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
        ctx.setLineDash([]);
      }

      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plotted, xDomain, yDomain, useLogX, useLogY, groupColor, groupOf, brushed, dragRect, xCol, yCol, rows],
  );

  const { canvasRef, wrapRef } = useCanvas(draw);

  function localXY(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = localXY(e);
    draggingRef.current = true;
    anchorRef.current = p;
    setDragRect({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!draggingRef.current) return;
    const p = localXY(e);
    setDragRect({ x0: anchorRef.current.x, y0: anchorRef.current.y, x1: p.x, y1: p.y });
  }

  function finishDrag(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture may already be released
    }
    const p = localXY(e);
    const x0 = Math.min(anchorRef.current.x, p.x);
    const x1 = Math.max(anchorRef.current.x, p.x);
    const y0 = Math.min(anchorRef.current.y, p.y);
    const y1 = Math.max(anchorRef.current.y, p.y);
    setDragRect(null);
    if (x1 - x0 < 4 && y1 - y0 < 4) {
      onBrushChange(null);
      return;
    }
    const { idx, px, py } = pointsPxRef.current;
    const sel = new Set<number>();
    for (let k = 0; k < idx.length; k++) {
      if (px[k] >= x0 && px[k] <= x1 && py[k] >= y0 && py[k] <= y1) sel.add(idx[k]);
    }
    onBrushChange(sel.size > 0 ? sel : null);
  }

  return (
    <div ref={wrapRef} className="skCanvasWrap skPopScatterWrap">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Scatter of ${xCol} vs ${yCol}, drag to brush points`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      />
    </div>
  );
}

function niceTicksInDomain([lo, hi]: [number, number]): number[] {
  if (!isFinite(lo) || !isFinite(hi) || lo === hi) return [lo];
  const span = hi - lo;
  const rawStep = span / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step: number;
  if (norm < 1.5) step = mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 1e-6; v += step) out.push(Math.round(v / step) * step);
  return out;
}

/** Integer powers-of-ten exponents spanning a log10 domain. */
function tickRange([lo, hi]: [number, number]): number[] {
  const eStart = Math.floor(lo);
  const eEnd = Math.ceil(hi);
  const out: number[] = [];
  for (let e = eStart; e <= eEnd; e++) out.push(e);
  return out;
}
