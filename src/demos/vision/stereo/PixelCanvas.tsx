"use client";

/**
 * Renders a source-resolution ImageData scaled to fill its wrapper, DPR-aware.
 * Wrapper controls aspect ratio via CSS; this just blits whatever `data` is current.
 */
import { useEffect, useRef } from "react";
import { blitImageData, fitCanvas } from "./stereoUtils";

export default function PixelCanvas({
  data,
  className,
  label,
}: {
  data: ImageData | null;
  className?: string;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const lastSizeRef = useRef<{ w: number; h: number } | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const cssW = wrap.clientWidth;
      const cssH = wrap.clientHeight;
      const fit = fitCanvas(canvas, cssW, cssH, lastSizeRef.current);
      if (!fit) return;
      lastSizeRef.current = { w: fit.w, h: fit.h };
      const { ctx, w, h } = fit;
      if (dataRef.current) blitImageData(ctx, dataRef.current, w, h);
      else ctx.clearRect(0, 0, w, h);
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div ref={wrapRef} className={className} aria-label={label}>
      <canvas ref={canvasRef} />
    </div>
  );
}
