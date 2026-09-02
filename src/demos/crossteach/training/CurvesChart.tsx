"use client";

import { useCallback, useMemo, useState } from "react";
import { useFitCanvas } from "./useFitCanvas";
import { COLORS } from "./colors";
import { progressivePoints } from "./chartMath";
import type { CurvesData } from "./types";

type SeriesKey = "unetSup" | "vitSup" | "unetCT" | "vitCT" | "ensCT";

interface SeriesDef {
  key: SeriesKey;
  label: string;
  color: string;
  dashed: boolean;
  lineWidth: number;
  values: number[];
}

const Y_MIN = 0.6;
const Y_MAX = 0.9;
const PAD_LEFT = 40;
const PAD_RIGHT = 10;
const PAD_TOP = 22;
const PAD_BOTTOM = 26;

function seriesFor(curves: CurvesData): SeriesDef[] {
  return [
    {
      key: "unetSup",
      label: "U-Net (supervised)",
      color: COLORS.unetLight,
      dashed: true,
      lineWidth: 1.6,
      values: curves.unetSupervised.history.map((h) => h.val_dice),
    },
    {
      key: "vitSup",
      label: "ViT (supervised)",
      color: COLORS.vitLight,
      dashed: true,
      lineWidth: 1.6,
      values: curves.vitSupervised.history.map((h) => h.val_dice),
    },
    {
      key: "unetCT",
      label: "U-Net (cross-teaching)",
      color: COLORS.unetDark,
      dashed: false,
      lineWidth: 2.2,
      values: curves.crossTeaching.history.map((h) => h.unet_val_dice),
    },
    {
      key: "vitCT",
      label: "ViT (cross-teaching)",
      color: COLORS.vitDark,
      dashed: false,
      lineWidth: 2.2,
      values: curves.crossTeaching.history.map((h) => h.vit_val_dice),
    },
    {
      key: "ensCT",
      label: "Ensemble (cross-teaching)",
      color: COLORS.ensemble,
      dashed: false,
      lineWidth: 2.4,
      values: curves.crossTeaching.history.map((h) => h.ensemble_val_dice),
    },
  ];
}

export default function CurvesChart({ curves, epoch }: { curves: CurvesData; epoch: number }) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const series = useMemo(() => seriesFor(curves), [curves]);
  const epochCount = curves.config.epochs;
  const warmupEnd = curves.config.warmupEpochs; // epochs 1..warmupEnd are warmup

  const toggle = useCallback((key: SeriesKey) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);

      const plotLeft = PAD_LEFT;
      const plotRight = w - PAD_RIGHT;
      const plotTop = PAD_TOP;
      const plotBottom = h - PAD_BOTTOM;
      const plotW = Math.max(1, plotRight - plotLeft);
      const plotH = Math.max(1, plotBottom - plotTop);
      const stepPx = plotW / (epochCount - 1);

      const xOf = (ep: number) => plotLeft + (ep - 1) * stepPx;
      const yOf = (v: number) => plotTop + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * plotH;

      // warmup band: epochs 1..warmupEnd, ending halfway to the next epoch tick
      const bandLeft = Math.max(plotLeft, xOf(1) - stepPx / 2);
      const bandRight = xOf(warmupEnd) + stepPx / 2;
      ctx.fillStyle = COLORS.band;
      ctx.fillRect(bandLeft, plotTop, bandRight - bandLeft, plotH);

      // gridlines + y labels
      ctx.strokeStyle = COLORS.grid;
      ctx.fillStyle = COLORS.axisText;
      ctx.font = "10px Arial, Helvetica, sans-serif";
      ctx.lineWidth = 1;
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const v = Y_MIN + ((Y_MAX - Y_MIN) * i) / steps;
        const y = yOf(v);
        ctx.beginPath();
        ctx.moveTo(plotLeft, y);
        ctx.lineTo(plotRight, y);
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(v.toFixed(2), plotLeft - 6, y);
      }

      // x ticks
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let ep = 1; ep <= epochCount; ep++) {
        const x = xOf(ep);
        ctx.strokeStyle = COLORS.grid;
        ctx.beginPath();
        ctx.moveTo(x, plotBottom);
        ctx.lineTo(x, plotBottom + 4);
        ctx.stroke();
        ctx.fillStyle = COLORS.axisText;
        ctx.fillText(String(ep), x, plotBottom + 6);
      }

      // exchange-on marker at warmupEnd+1
      const onX = xOf(warmupEnd + 1);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = COLORS.bandLine;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(onX, plotTop);
      ctx.lineTo(onX, plotBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // annotations
      ctx.fillStyle = "#0f766e";
      ctx.font = "600 10px Arial, Helvetica, sans-serif";
      if (bandRight - bandLeft > 70) {
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("warmup: exchange off", (bandLeft + bandRight) / 2, plotTop - 8);
      }
      ctx.textAlign = "left";
      ctx.fillText(`epoch ${warmupEnd + 1}: confident ratio 0 -> 1.0`, Math.min(onX + 6, plotRight - 150), plotTop - 8);

      // series
      for (const s of series) {
        if (hidden.has(s.key)) continue;
        const pts = progressivePoints(s.values, epoch);
        if (pts.length === 0) continue;
        ctx.setLineDash(s.dashed ? [6, 4] : []);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.lineWidth;
        ctx.beginPath();
        pts.forEach((p, i) => {
          const x = xOf(p.epoch);
          const y = yOf(p.value);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        const last = pts[pts.length - 1];
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(xOf(last.epoch), yOf(last.value), 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // axis frame
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.strokeRect(plotLeft, plotTop, plotW, plotH);
    },
    [series, hidden, epoch, epochCount, warmupEnd],
  );

  const { canvasRef, wrapRef } = useFitCanvas(draw, 260);

  return (
    <div className="ctTCurvesBlock">
      <div className="ctTCurves" ref={wrapRef}>
        <canvas ref={canvasRef} role="img" aria-label="Validation Dice vs epoch for five training runs" />
      </div>
      <div className="ctTLegend">
        {series.map((s) => (
          <button
            key={s.key}
            type="button"
            className="ctTLegendItem"
            data-off={hidden.has(s.key) ? "true" : "false"}
            onClick={() => toggle(s.key)}
          >
            <span
              className="ctTSwatch"
              style={{
                background: s.dashed ? "transparent" : s.color,
                borderColor: s.color,
                borderStyle: s.dashed ? "dashed" : "solid",
              }}
            />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
