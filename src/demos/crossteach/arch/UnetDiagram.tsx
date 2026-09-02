"use client";

import { useCallback, useRef, useState } from "react";
import type { StageInfo } from "./types";
import { cached, decodeGrayscale, loadImageElement, type GrayscaleData } from "./imgDecode";
import { colorizeGrayscale } from "./colormap";
import { useFitCanvasSquare } from "./useFitCanvas";

// Layout constants for the encoder/decoder cartoon (viewBox units).
const ROW_Y = [40, 96, 152, 208, 264];
const SVG_W = 200;
const SVG_H = 296;
const ENC_X = 54;
const DEC_X = 160;
const DEFAULT_STAGE = "layer2";

function blockSize(hw: number): { w: number; h: number } {
  const ratio = hw / 256;
  return { w: 18 + 46 * ratio, h: 10 + 16 * ratio };
}

export default function UnetDiagram({ imageId, stages }: { imageId: string; stages: StageInfo[] }) {
  const [selected, setSelected] = useState<string>(DEFAULT_STAGE);
  const [hovered, setHovered] = useState<string | null>(null);
  const active = hovered ?? selected;
  const fallbackIdx = Math.min(2, Math.max(0, stages.length - 1));
  const activeStage = stages.find((s) => s.name === active) ?? stages[fallbackIdx] ?? null;

  const imgCache = useRef(new Map<string, Promise<HTMLImageElement>>()).current;
  const heatCache = useRef(new Map<string, Promise<GrayscaleData>>()).current;

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#f1f8f6";
      ctx.fillRect(0, 0, w, h);
      if (!activeStage) return;
      const inputUrl = `/demos/crossteach/input/${imageId}.webp`;
      const heatUrl = `/demos/crossteach/act/${imageId}_${activeStage.name}.png`;
      Promise.all([cached(imgCache, inputUrl, loadImageElement), cached(heatCache, heatUrl, decodeGrayscale)])
        .then(([img, heat]) => {
          ctx.clearRect(0, 0, w, h);
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, 0, 0, w, h);
          const tmp = document.createElement("canvas");
          tmp.width = heat.w;
          tmp.height = heat.h;
          const tctx = tmp.getContext("2d");
          if (!tctx) return;
          tctx.putImageData(colorizeGrayscale(heat.data, heat.w, heat.h, { alphaBase: 1 }), 0, 0);
          // nearest-neighbor upscale so shallow stages look sharp, deep stages look blocky
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = 0.65;
          ctx.drawImage(tmp, 0, 0, w, h);
          ctx.globalAlpha = 1;
          ctx.imageSmoothingEnabled = true;
        })
        .catch(() => {});
    },
    [imageId, activeStage, imgCache, heatCache]
  );

  const { canvasRef, wrapRef } = useFitCanvasSquare(draw);

  if (stages.length === 0) {
    return <div className="ctAHalf ctAUnet ctANote">No activation stages for this image.</div>;
  }

  const skipStages = stages.slice(0, 4);

  return (
    <div className="ctAHalf ctAUnet">
      <div className="ctADiagramRow">
        <svg className="ctASvg" viewBox={`0 0 ${SVG_W} ${SVG_H}`} role="img" aria-label="U-Net encoder-decoder diagram">
          <line x1={ENC_X} y1={ROW_Y[0]} x2={ENC_X} y2={ROW_Y[4]} className="ctASpine" />
          <line x1={DEC_X} y1={ROW_Y[3]} x2={DEC_X} y2={ROW_Y[0]} className="ctASpine" />
          <path
            d={`M ${ENC_X} ${ROW_Y[4]} Q ${(ENC_X + DEC_X) / 2} ${ROW_Y[4] + 22} ${DEC_X} ${ROW_Y[3]}`}
            className="ctASpine"
            fill="none"
          />

          {skipStages.map((s, i) => {
            const size = blockSize(s.hw);
            const y = ROW_Y[i];
            const isActive = s.name === active;
            return (
              <path
                key={`skip-${s.name}`}
                d={`M ${ENC_X + size.w / 2} ${y} Q ${(ENC_X + DEC_X) / 2} ${y - 16} ${DEC_X - size.w / 2} ${y}`}
                className={isActive ? "ctASkip ctASkipActive" : "ctASkip"}
                fill="none"
              />
            );
          })}

          {skipStages.map((s, i) => {
            const size = blockSize(s.hw);
            const y = ROW_Y[i];
            const isActive = s.name === active;
            return (
              <rect
                key={`dec-${s.name}`}
                x={DEC_X - size.w / 2}
                y={y - size.h / 2}
                width={size.w}
                height={size.h}
                rx={3}
                className={isActive ? "ctADecBlock ctADecBlockActive" : "ctADecBlock"}
              />
            );
          })}

          {stages.map((s, i) => {
            const size = blockSize(s.hw);
            const y = ROW_Y[i];
            const isActive = s.name === active;
            return (
              <g
                key={`enc-${s.name}`}
                className="ctAEncGroup"
                onMouseEnter={() => setHovered(s.name)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(s.name)}
              >
                <rect
                  x={ENC_X - size.w / 2}
                  y={y - size.h / 2}
                  width={size.w}
                  height={size.h}
                  rx={3}
                  className={isActive ? "ctAEncBlock ctAEncBlockActive" : "ctAEncBlock"}
                />
                <text x={ENC_X} y={y - size.h / 2 - 5} textAnchor="middle" className="ctALabel">
                  {s.name}
                </text>
              </g>
            );
          })}

          <text x={ENC_X} y={SVG_H - 6} textAnchor="middle" className="ctASpineLabel">encoder</text>
          <text x={DEC_X} y={SVG_H - 6} textAnchor="middle" className="ctASpineLabel">decoder</text>
        </svg>

        <div className="ctACanvasCol">
          <div className="ctACanvasWrap" ref={wrapRef}>
            <canvas ref={canvasRef} className="ctACanvas" />
          </div>
          <p className="ctMono ctAFacts">
            {activeStage ? `${activeStage.name} - ${activeStage.hw}x${activeStage.hw} x ${activeStage.ch}ch` : ""}
          </p>
        </div>
      </div>
      <p className="ctNote">Real activations from the shipped cross-taught U-Net checkpoint.</p>
    </div>
  );
}
