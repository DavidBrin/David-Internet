"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFitCanvasSquare } from "./useFitCanvas";

const TEAL: [number, number, number] = [20, 184, 166]; // #14B8A6
const OVERLAY_ALPHA = 0.55;

export default function MicroctSlice({ id, poreFraction }: { id: string; poreFraction: number }) {
  const [overlayOn, setOverlayOn] = useState(true);
  const [loadedTick, setLoadedTick] = useState(0);
  const sliceImgRef = useRef<HTMLImageElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sliceImg = new Image();
    const maskImg = new Image();
    let loadedCount = 0;
    const onBothLoaded = () => {
      if (cancelled) return;
      sliceImgRef.current = sliceImg;
      const off = document.createElement("canvas");
      off.width = maskImg.naturalWidth;
      off.height = maskImg.naturalHeight;
      const octx = off.getContext("2d");
      if (octx) {
        octx.drawImage(maskImg, 0, 0);
        const imgData = octx.getImageData(0, 0, off.width, off.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const isPore = d[i] > 127; // L-mode mask: pore = 255
          if (isPore) {
            d[i] = TEAL[0];
            d[i + 1] = TEAL[1];
            d[i + 2] = TEAL[2];
            d[i + 3] = Math.round(255 * OVERLAY_ALPHA);
          } else {
            d[i + 3] = 0;
          }
        }
        octx.putImageData(imgData, 0, 0);
      }
      overlayCanvasRef.current = off;
      setLoadedTick((n) => n + 1);
    };
    sliceImg.onload = () => {
      loadedCount++;
      if (loadedCount === 2) onBothLoaded();
    };
    maskImg.onload = () => {
      loadedCount++;
      if (loadedCount === 2) onBothLoaded();
    };
    sliceImg.src = `/demos/crossteach/microct/slice${id}.webp`;
    maskImg.src = `/demos/crossteach/microct/mask${id}.png`;
    return () => {
      cancelled = true;
    };
  }, [id]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);
      const img = sliceImgRef.current;
      if (!img) return;
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, w, h);
      const overlay = overlayCanvasRef.current;
      if (overlayOn && overlay) {
        ctx.drawImage(overlay, 0, 0, overlay.width, overlay.height, 0, 0, w, h);
      }
    },
    [overlayOn, loadedTick],
  );

  const { canvasRef, wrapRef } = useFitCanvasSquare(draw);

  return (
    <div className="ctTSlice">
      <div className="ctTSliceCanvasWrap" ref={wrapRef}>
        <canvas ref={canvasRef} role="img" aria-label={`Micro-CT slice ${id} with pore mask overlay toggle`} />
      </div>
      <div className="ctTSliceRow">
        <span className="ctTSliceId ctMono">slice {id}</span>
        <span className="ctChip ctMono">pore {poreFraction.toFixed(3)}</span>
      </div>
      <button type="button" className="ctBtn ctTSliceToggle" data-active={overlayOn ? "true" : "false"} onClick={() => setOverlayOn((v) => !v)}>
        {overlayOn ? "Hide pore mask" : "Show pore mask"}
      </button>
    </div>
  );
}
