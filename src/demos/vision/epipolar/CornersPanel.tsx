"use client";

/**
 * Sub-panel A — corners + edges. Runs David's Sobel corner_detect() live on
 * im0.jpg (~512x288) as the nCorners/smoothStd sliders move, plus a static
 * gradient-magnitude edge map of geisel.jpg.
 *
 * cornerDetect() is a synchronous port of the notebook's NumPy code (core/*
 * is off-limits here, so it can't be chunked internally) and can take the
 * better part of a second at the high end of the slider range. To keep the
 * "computing..." shimmer from being skipped by React's own render batching,
 * the call is deferred two animation frames past the state flip so the
 * shimmer actually paints before the main thread blocks, and slider drags
 * are debounced so a fast drag only triggers one detector run.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { cornerDetect, gradient, smooth, type CornerResult } from "@/demos/vision/core/features";
import type { Grid } from "@/demos/vision/core/stereo";
import { clamp, heatColor, setupImageCanvas } from "./canvasUtil";

const N_MIN = 25;
const N_MAX = 150;
const STD_MIN = 1;
const STD_MAX = 4;
const DEBOUNCE_MS = 260;
const BLOOM_MS = 650;

interface Props {
  im0Img: HTMLImageElement;
  im0Grid: Grid;
  im0Scale: number;
  geiselImg: HTMLImageElement;
  geiselGrid: Grid;
  geiselScale: number;
}

function buildHeatCanvas(minor: Grid, w: number, h: number): HTMLCanvasElement {
  // minor is (h+2) x (w+2) — David's convolve2d mode="full" quirk — so crop the
  // 1px border to line back up with the original w x h image.
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const imgData = ctx.createImageData(w, h);
  let max = 0;
  for (let p = 0; p < minor.data.length; p++) if (minor.data[p] > max) max = minor.data[p];
  const norm = max > 0 ? Math.log1p(max) : 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = minor.data[(y + 1) * minor.w + (x + 1)];
      // sqrt spreads the mid-low range out (minor-eigenvalue images are extremely
      // peaked) so texture reads as a visible heat gradient, not just a few dots.
      const t = v > 0 ? Math.sqrt(Math.log1p(v) / norm) : 0;
      const [r, g, b] = heatColor(t);
      const idx = (y * w + x) * 4;
      imgData.data[idx] = r;
      imgData.data[idx + 1] = g;
      imgData.data[idx + 2] = b;
      imgData.data[idx + 3] = Math.round(235 * clamp(t * 1.1, 0, 1));
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
}

function buildGrayCanvas(mag: Grid): HTMLCanvasElement {
  const { w, h } = mag;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const imgData = ctx.createImageData(w, h);
  let max = 0;
  for (let p = 0; p < mag.data.length; p++) if (mag.data[p] > max) max = mag.data[p];
  const inv = max > 0 ? 255 / max : 0;
  for (let p = 0; p < mag.data.length; p++) {
    const v = Math.round(mag.data[p] * inv);
    const idx = p * 4;
    imgData.data[idx] = v;
    imgData.data[idx + 1] = v;
    imgData.data[idx + 2] = v;
    imgData.data[idx + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
}

export default function CornersPanel({ im0Img, im0Grid, im0Scale, geiselImg, geiselGrid, geiselScale }: Props) {
  const [nCorners, setNCorners] = useState(60);
  const [smoothStd, setSmoothStd] = useState(1.5);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [computing, setComputing] = useState(true);
  const [result, setResult] = useState<CornerResult | null>(null);

  const heatCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tokenRef = useRef(0);
  const revealStartRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const token = ++tokenRef.current;
      setComputing(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (tokenRef.current !== token) return;
          const res = cornerDetect(im0Grid, Math.round(nCorners), smoothStd);
          if (tokenRef.current !== token) return;
          heatCanvasRef.current = buildHeatCanvas(res.minor, im0Grid.w, im0Grid.h);
          setResult(res);
          setComputing(false);
          revealStartRef.current = performance.now();
        });
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [im0Grid, nCorners, smoothStd]);

  const edgeCanvas = useMemo(() => buildGrayCanvas(gradient(smooth(geiselGrid)).mag), [geiselGrid]);

  const cornersCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = cornersCanvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const draw = () => {
      const { ctx } = setupImageCanvas(canvas, im0Grid.w, im0Grid.h, im0Scale);
      ctx.clearRect(0, 0, im0Grid.w, im0Grid.h);
      ctx.drawImage(im0Img, 0, 0, im0Grid.w, im0Grid.h);
      if (showHeatmap && heatCanvasRef.current) {
        ctx.globalAlpha = 0.62;
        ctx.drawImage(heatCanvasRef.current, 0, 0);
        ctx.globalAlpha = 1;
      }
      let again = false;
      if (result) {
        const total = result.corners.length;
        const elapsed = performance.now() - revealStartRef.current;
        const revealed = clamp(Math.floor((elapsed / BLOOM_MS) * total), 0, total);
        again = revealed < total;
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 1.3 / im0Scale;
        const s = 3.6;
        for (let i = 0; i < revealed; i++) {
          const [xm, ym] = result.corners[i];
          const x = xm - 1;
          const y = ym - 1;
          const newness = revealed - i; // 1 = just revealed
          ctx.globalAlpha = newness <= 3 ? 0.4 + 0.2 * (4 - newness) : 1;
          ctx.beginPath();
          ctx.moveTo(x - s, y);
          ctx.lineTo(x + s, y);
          ctx.moveTo(x, y - s);
          ctx.lineTo(x, y + s);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (again) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [result, showHeatmap, im0Img, im0Grid, im0Scale]);

  const edgeCanvasElRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = edgeCanvasElRef.current;
    if (!canvas) return;
    const { ctx } = setupImageCanvas(canvas, geiselGrid.w, geiselGrid.h, geiselScale);
    ctx.clearRect(0, 0, geiselGrid.w, geiselGrid.h);
    ctx.drawImage(edgeCanvas, 0, 0);
  }, [edgeCanvas, geiselGrid, geiselScale]);

  return (
    <div className="vsPanel vsEpPanel">
      <div className="vsRow" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 className="vsEpH3">A. Corners &amp; edges</h3>
        <span className="vsChip">mirrors corner_detect()</span>
      </div>

      <div className="vsRow" style={{ marginTop: 8 }}>
        <label className="vsSliderLabel">
          nCorners
          <input
            type="range"
            min={N_MIN}
            max={N_MAX}
            step={5}
            value={nCorners}
            onChange={(e) => setNCorners(Number(e.target.value))}
          />
          <span className="vsMono">{Math.round(nCorners)}</span>
        </label>
        <label className="vsSliderLabel">
          smoothStd
          <input
            type="range"
            min={STD_MIN}
            max={STD_MAX}
            step={0.1}
            value={smoothStd}
            onChange={(e) => setSmoothStd(Number(e.target.value))}
          />
          <span className="vsMono">{smoothStd.toFixed(1)}</span>
        </label>
        <button
          type="button"
          className="vsBtn"
          data-active={showHeatmap}
          onClick={() => setShowHeatmap((v) => !v)}
        >
          minor-eigenvalue heatmap
        </button>
      </div>

      <div className="vsEpRow">
        <div className="vsEpCanvasWrap">
          <canvas ref={cornersCanvasRef} className="vsEpCanvas" />
          {computing && (
            <div className="vsEpShimmer">
              <span>computing...</span>
            </div>
          )}
          <div className="vsEpCaption">
            im0.jpg &mdash; <span className="vsMono">{result ? result.corners.length : 0}</span> corners
          </div>
        </div>
        <div className="vsEpCanvasWrap vsEpCanvasWrapSmall">
          <canvas ref={edgeCanvasElRef} className="vsEpCanvas" />
          <div className="vsEpCaption">geisel.jpg &mdash; |&nabla;I| after smooth()</div>
        </div>
      </div>
      <p className="vsNote">
        The minor-eigenvalue image comes out (h+2)x(w+2) because David's <span className="vsMono">corner_detect</span>{" "}
        calls <span className="vsMono">convolve2d</span> with the default <span className="vsMono">mode=&quot;full&quot;</span>{" "}
        — corner coordinates are read from that offset frame and shifted back by one pixel for display.
      </p>
    </div>
  );
}
