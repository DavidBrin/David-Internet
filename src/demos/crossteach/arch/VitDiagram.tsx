"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { cached, decodeGrayscale, loadImageElement, type GrayscaleData } from "./imgDecode";
import { colorizeGrayscale } from "./colormap";
import { useFitCanvasSquare } from "./useFitCanvas";

const GRID = 14;
const DEFAULT_PATCH = Math.floor(GRID / 2) * GRID + Math.floor(GRID / 2); // center patch, so overlay is never empty

export default function VitDiagram({
  imageId,
  layers,
  heads,
}: {
  imageId: string;
  layers: number;
  heads: number;
}) {
  const [hoveredPatch, setHoveredPatch] = useState<number | null>(null);
  const [pinnedPatch, setPinnedPatch] = useState<number | null>(DEFAULT_PATCH);
  const [showCls, setShowCls] = useState(false);
  const [animT, setAnimT] = useState(1); // 0..1 tiling-animation progress; 1 = settled
  const hasAnimatedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const imgCache = useRef(new Map<string, Promise<HTMLImageElement>>()).current;
  const spriteCache = useRef(new Map<string, Promise<GrayscaleData>>()).current;
  const clsCache = useRef(new Map<string, Promise<GrayscaleData>>()).current;

  const activePatch = hoveredPatch ?? pinnedPatch;

  // Auto-play the tiling animation once, on first mount only. The rAF handle is
  // ref-guarded for cleanup; hasAnimatedRef only flips true once the animation
  // actually finishes, so React 18 dev Strict Mode's setup->cleanup->setup replay
  // (which cancels the first run before it completes) still lets the surviving
  // effect invocation play the animation through instead of getting stuck at t=0.
  useEffect(() => {
    if (hasAnimatedRef.current) return;
    setAnimT(0);
    const dur = 800;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setAnimT(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        hasAnimatedRef.current = true;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#f1f8f6";
      ctx.fillRect(0, 0, w, h);
      const inputUrl = `/demos/crossteach/input/${imageId}.webp`;
      const cell = w / GRID;

      cached(imgCache, inputUrl, loadImageElement)
        .then((img) => {
          ctx.imageSmoothingEnabled = true;

          if (animT < 1) {
            // "224x224 -> 196 patches of 16x16": grid sweeps in, tiles briefly separate then settle.
            const gap = 5 * (1 - animT);
            for (let r = 0; r < GRID; r++) {
              for (let c = 0; c < GRID; c++) {
                const sx = (c / GRID) * img.naturalWidth;
                const sy = (r / GRID) * img.naturalHeight;
                const sw = img.naturalWidth / GRID;
                const sh = img.naturalHeight / GRID;
                const dx = c * cell + gap;
                const dy = r * cell + gap;
                const dw = Math.max(0, cell - gap * 2);
                const dh = Math.max(0, cell - gap * 2);
                ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
              }
            }
            ctx.strokeStyle = `rgba(20,184,166,${0.15 + 0.35 * animT})`;
            ctx.lineWidth = 1;
            const lim = w * animT;
            for (let i = 0; i <= GRID; i++) {
              ctx.beginPath();
              ctx.moveTo(i * cell, 0);
              ctx.lineTo(i * cell, Math.min(h, lim));
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(0, i * cell);
              ctx.lineTo(Math.min(w, lim), i * cell);
              ctx.stroke();
            }
            return;
          }

          ctx.drawImage(img, 0, 0, w, h);

          ctx.strokeStyle = "rgba(20,184,166,0.35)";
          ctx.lineWidth = 1;
          for (let i = 0; i <= GRID; i++) {
            ctx.beginPath();
            ctx.moveTo(i * cell, 0);
            ctx.lineTo(i * cell, h);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * cell);
            ctx.lineTo(w, i * cell);
            ctx.stroke();
          }

          const overlayAndOutline = (map: GrayscaleData, mw: number, mh: number, outlinePatch: number | null) => {
            const tmp = document.createElement("canvas");
            tmp.width = mw;
            tmp.height = mh;
            const tctx = tmp.getContext("2d");
            if (tctx) {
              tctx.putImageData(colorizeGrayscale(map.data, mw, mh, { alphaBase: 0.85, proportionalAlpha: true }), 0, 0);
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(tmp, 0, 0, w, h);
              ctx.imageSmoothingEnabled = true;
            }
            if (outlinePatch !== null) {
              const row = Math.floor(outlinePatch / GRID);
              const col = outlinePatch % GRID;
              ctx.strokeStyle = "#f59e0b";
              ctx.lineWidth = 2;
              ctx.strokeRect(col * cell + 1, row * cell + 1, cell - 2, cell - 2);
            }
          };

          if (showCls) {
            cached(clsCache, `/demos/crossteach/attention/${imageId}_cls.png`, decodeGrayscale)
              .then((cls) => overlayAndOutline(cls, cls.w, cls.h, activePatch))
              .catch(() => {});
          } else if (activePatch !== null) {
            cached(spriteCache, `/demos/crossteach/attention/${imageId}.png`, decodeGrayscale)
              .then((sprite) => {
                const row0 = Math.floor(activePatch / GRID);
                const col0 = activePatch % GRID;
                const tile = new Uint8Array(GRID * GRID);
                for (let r = 0; r < GRID; r++) {
                  for (let c = 0; c < GRID; c++) {
                    tile[r * GRID + c] = sprite.data[(row0 * GRID + r) * sprite.w + (col0 * GRID + c)];
                  }
                }
                overlayAndOutline({ data: tile, w: GRID, h: GRID }, GRID, GRID, activePatch);
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    },
    [imageId, animT, activePatch, showCls, imgCache, spriteCache, clsCache]
  );

  const { canvasRef, wrapRef } = useFitCanvasSquare(draw);

  const patchFromEvent = useCallback((e: ReactMouseEvent<HTMLCanvasElement>): number | null => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x >= rect.width || y >= rect.height || rect.width === 0) return null;
    const col = Math.min(GRID - 1, Math.max(0, Math.floor((x / rect.width) * GRID)));
    const row = Math.min(GRID - 1, Math.max(0, Math.floor((y / rect.height) * GRID)));
    return row * GRID + col;
  }, []);

  return (
    <div className="ctAHalf ctAVit">
      <div className="ctACanvasWrap ctAVitCanvasWrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="ctACanvas"
          onMouseMove={(e) => setHoveredPatch(patchFromEvent(e))}
          onMouseLeave={() => setHoveredPatch(null)}
          onClick={(e) => {
            const p = patchFromEvent(e);
            if (p === null) return;
            setPinnedPatch((prev) => (prev === p ? null : p));
          }}
        />
      </div>
      <div className="ctARow ctAVitControls">
        <span className="ctChip">
          {layers} layers x {heads} heads, rollout through all layers
        </span>
        <button type="button" className="ctBtn" data-active={showCls} onClick={() => setShowCls((v) => !v)}>
          CLS token
        </button>
      </div>
      <p className="ctNote">
        Real attention from the shipped cross-taught ViT checkpoint; hover (or tap) a patch to see where it looks.
      </p>
    </div>
  );
}
