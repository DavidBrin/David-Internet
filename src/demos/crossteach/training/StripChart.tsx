"use client";

import { useCallback, useMemo } from "react";
import { useFitCanvas } from "./useFitCanvas";
import { COLORS } from "./colors";
import { progressivePoints } from "./chartMath";
import type { CrossTeachRun } from "./types";

const PAD_LEFT = 40;
const PAD_RIGHT = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 20;

interface StripSeries {
  label: string;
  color: string;
  dashed: boolean;
  values: number[];
}

export default function StripChart({ crossTeaching, epoch }: { crossTeaching: CrossTeachRun; epoch: number }) {
  const epochCount = crossTeaching.history.length;
  const warmupEnd = crossTeaching.consistency_warmup_epochs;

  const series: StripSeries[] = useMemo(
    () => [
      {
        label: "U-Net confident-image ratio",
        color: COLORS.unetDark,
        dashed: false,
        values: crossTeaching.history.map((h) => h.unet_confident_image_ratio),
      },
      {
        label: "ViT confident-image ratio",
        color: COLORS.vitDark,
        dashed: false,
        values: crossTeaching.history.map((h) => h.vit_confident_image_ratio),
      },
      {
        label: "U-Net consistency loss",
        color: COLORS.unetDark,
        dashed: true,
        values: crossTeaching.history.map((h) => h.unet_consistency_loss),
      },
      {
        label: "ViT consistency loss",
        color: COLORS.vitDark,
        dashed: true,
        values: crossTeaching.history.map((h) => h.vit_consistency_loss),
      },
    ],
    [crossTeaching],
  );

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
      const yOf = (v: number) => plotTop + (1 - v) * plotH; // fixed 0..1 scale

      ctx.strokeStyle = COLORS.grid;
      ctx.fillStyle = COLORS.axisText;
      ctx.font = "9px Arial, Helvetica, sans-serif";
      ctx.lineWidth = 1;
      for (const v of [0, 0.5, 1]) {
        const y = yOf(v);
        ctx.beginPath();
        ctx.moveTo(plotLeft, y);
        ctx.lineTo(plotRight, y);
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(v.toFixed(1), plotLeft - 6, y);
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let ep = 1; ep <= epochCount; ep++) {
        const x = xOf(ep);
        ctx.strokeStyle = COLORS.grid;
        ctx.beginPath();
        ctx.moveTo(x, plotBottom);
        ctx.lineTo(x, plotBottom + 3);
        ctx.stroke();
        ctx.fillStyle = COLORS.axisText;
        ctx.fillText(String(ep), x, plotBottom + 4);
      }

      const onX = xOf(warmupEnd + 1);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = COLORS.bandLine;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(onX, plotTop);
      ctx.lineTo(onX, plotBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const s of series) {
        const pts = progressivePoints(s.values, epoch);
        if (pts.length === 0) continue;
        ctx.setLineDash(s.dashed ? [5, 3] : []);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        pts.forEach((p, i) => {
          const x = xOf(p.epoch);
          const y = yOf(p.value);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.strokeRect(plotLeft, plotTop, plotW, plotH);
    },
    [series, epoch, epochCount, warmupEnd],
  );

  const { canvasRef, wrapRef } = useFitCanvas(draw, 110);

  return (
    <div className="ctTStripBlock">
      <div className="ctTStripWrap" ref={wrapRef}>
        <canvas ref={canvasRef} role="img" aria-label="Confident-image ratio and consistency loss vs epoch" />
      </div>
      <div className="ctTStripLegend">
        {series.map((s) => (
          <span key={s.label} className="ctTStripLegendItem">
            <span
              className="ctTSwatch"
              style={{
                background: s.dashed ? "transparent" : s.color,
                borderColor: s.color,
                borderStyle: s.dashed ? "dashed" : "solid",
              }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
