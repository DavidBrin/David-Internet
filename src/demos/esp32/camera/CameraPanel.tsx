"use client";

/**
 * Stage 1 — the thermal camera. Draws the shared playhead's current frame as an 8x8
 * grid (nearest ↔ bicubic, the same toggle thermal_viewer.py exposes), with an
 * Ironbow/Gray colormap picker, transport controls over the shared frame stream, and
 * live readouts (label, contributor, max-pixel °C against the ~26-28 °C boundary from
 * ANALYSIS.md). A strip below reproduces the dataset-explorer's stats and figures.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrames } from "../core/frameStore";
import { bicubicUpsample, grayColor, thermalColor } from "../core/colormap";
import "./camera.css";

// ------------------------------------------------------------------ constants

const TEMP_MIN = 18; // °C — fixed color window so warmth reads consistently frame to frame
const TEMP_MAX = 34;
const THRESH_LO = 26; // ANALYSIS.md: "a max-temperature threshold around 26-28 °C separates the classes"
const THRESH_HI = 28;
const BICUBIC_N = 96;
const TICKS = [18, 22, 26, 30, 34];

type Interp = "nearest" | "bicubic";
type Cmap = "iron" | "gray";

const colorFns: Record<Cmap, (t: number) => [number, number, number]> = {
  iron: thermalColor,
  gray: grayColor,
};

function t01(v: number): number {
  return Math.max(0, Math.min(1, (v - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)));
}

function pctOf(v: number, min: number, max: number): number {
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
}

/** CSS linear-gradient string sampling a colormap function across [0,1]. */
function gradientCss(colorFn: (t: number) => [number, number, number]): string {
  const stops = 12;
  const parts: string[] = [];
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const [r, g, b] = colorFn(t);
    parts.push(`rgb(${r | 0},${g | 0},${b | 0}) ${((t * 100).toFixed(1))}%`);
  }
  return `linear-gradient(to right, ${parts.join(", ")})`;
}

// ------------------------------------------------------------------ canvas hook
// Same DPR-aware, mount-safe pattern used by the other ESP32/signals panels: callback
// refs so the effect notices the canvas attach, and a <2px-jitter guard on the wrap's
// measured size so a ResizeObserver can never feed a resize back into itself.

function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => boolean) {
  const [ready, setReady] = useState(false);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const wrapElRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const canvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasElRef.current = el;
    if (el) setReady(true);
  }, []);
  const wrapRef = useCallback((el: HTMLDivElement | null) => {
    wrapElRef.current = el;
    if (el) setReady(true);
  }, []);

  const lastAppliedRef = useRef<{ w: number; h: number } | null>(null);

  const render = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const canvas = canvasElRef.current;
      const wrap = wrapElRef.current;
      if (!canvas || !wrap) return;
      canvas.style.display = "block";
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const last = lastAppliedRef.current;
      const settled = last !== null && Math.abs(w - last.w) < 2 && Math.abs(h - last.h) < 2;
      if (!settled) {
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        }
        lastAppliedRef.current = { w, h };
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const again = drawRef.current(ctx, w, h, now);
      if (again) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    render();
  }, [render, draw, ready]);

  useEffect(() => {
    const wrap = wrapElRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => render());
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [render, ready]);

  return { canvasRef, wrapRef };
}

// ------------------------------------------------------------------ component

export default function CameraPanel() {
  const { frames, sequences, stats, index, playing, frame, setIndex, setPlaying, status } = useFrames();
  const [interp, setInterp] = useState<Interp>("nearest");
  const [cmap, setCmap] = useState<Cmap>("iron");
  const offRef = useRef<HTMLCanvasElement | null>(null);

  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0b0f1a";
      ctx.fillRect(0, 0, w, h);
      if (!frame) return true;

      const colorFn = colorFns[cmap];
      const px = frame.px;

      if (interp === "nearest") {
        const cw = w / 8;
        const ch = h / 8;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const [rr, gg, bb] = colorFn(t01(px[r * 8 + c]));
            ctx.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`;
            ctx.fillRect(c * cw, r * ch, cw + 0.6, ch + 0.6);
          }
        }
      } else {
        const up = bicubicUpsample(px, BICUBIC_N);
        let off = offRef.current;
        if (!off) {
          off = document.createElement("canvas");
          offRef.current = off;
        }
        if (off.width !== BICUBIC_N || off.height !== BICUBIC_N) {
          off.width = BICUBIC_N;
          off.height = BICUBIC_N;
        }
        const octx = off.getContext("2d");
        if (octx) {
          const img = octx.createImageData(BICUBIC_N, BICUBIC_N);
          for (let i = 0; i < BICUBIC_N * BICUBIC_N; i++) {
            const [rr, gg, bb] = colorFn(t01(up[i]));
            img.data[i * 4] = rr;
            img.data[i * 4 + 1] = gg;
            img.data[i * 4 + 2] = bb;
            img.data[i * 4 + 3] = 255;
          }
          octx.putImageData(img, 0, 0);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(off, 0, 0, BICUBIC_N, BICUBIC_N, 0, 0, w, h);
      }

      // pulse an outline on the hottest cell
      let hottestIdx = 0;
      let hottestV = -Infinity;
      for (let i = 0; i < 64; i++) {
        if (px[i] > hottestV) {
          hottestV = px[i];
          hottestIdx = i;
        }
      }
      const hr = Math.floor(hottestIdx / 8);
      const hc = hottestIdx % 8;
      const cw = w / 8;
      const ch = h / 8;
      const pulse = 0.55 + 0.45 * Math.sin(now / 260);
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(hc * cw + 1.5, hr * ch + 1.5, cw - 3, ch - 3);
      ctx.strokeStyle = `rgba(249,115,22,${(pulse * 0.9).toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(hc * cw + 3, hr * ch + 3, cw - 6, ch - 6);
      ctx.restore();

      return true; // keep the pulse animating
    },
    [frame, interp, cmap],
  );

  const { canvasRef, wrapRef } = useCanvas(drawGrid);

  const maxTemp = useMemo(() => {
    if (!frame) return null;
    let m = -Infinity;
    for (const v of frame.px) if (v > m) m = v;
    return m;
  }, [frame]);

  const legendGradient = useMemo(() => gradientCss(colorFns[cmap]), [cmap]);

  const currentSeqIdx = useMemo(() => {
    return sequences.findIndex((s) => index >= s.start && index < s.end);
  }, [sequences, index]);

  const handleScrubStart = () => setPlaying(false);
  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => setIndex(Number(e.target.value));
  const jumpToSequence = (start: number) => setIndex(start);

  if (status === "loading") {
    return <div className="etCamLoading">Loading the thermal frame stream…</div>;
  }
  if (status === "error" || frames.length === 0) {
    return <div className="etNote">Could not load frames.json for the thermal camera panel.</div>;
  }

  return (
    <div className="etCam">
      <div className="etRow">
        <span className="etLabel">Interpolation</span>
        <button
          type="button"
          className="etBtn"
          data-active={interp === "nearest"}
          onClick={() => setInterp("nearest")}
        >
          Nearest
        </button>
        <button
          type="button"
          className="etBtn"
          data-active={interp === "bicubic"}
          onClick={() => setInterp("bicubic")}
        >
          Bicubic
        </button>
        <span className="etLabel" style={{ marginLeft: 12 }}>
          Colormap
        </span>
        <button type="button" className="etBtn" data-active={cmap === "iron"} onClick={() => setCmap("iron")}>
          Ironbow
        </button>
        <button type="button" className="etBtn" data-active={cmap === "gray"} onClick={() => setCmap("gray")}>
          Gray
        </button>
      </div>

      <div className="etCamGridArea">
        <div className="etCanvasWrap etCamCanvasWrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`8x8 thermal frame, ${frame?.label ?? "unknown"}, rendered with ${interp} interpolation`}
          />
        </div>
        <div className="etCamLegendCol">
          <span className="etCamLegendTitle">Color scale</span>
          <div className="etCamBar">
            <div className="etCamBarTrack" style={{ background: legendGradient }}>
              <div
                className="etCamBarBand"
                style={{
                  left: `${pctOf(THRESH_LO, TEMP_MIN, TEMP_MAX)}%`,
                  width: `${pctOf(THRESH_HI, TEMP_MIN, TEMP_MAX) - pctOf(THRESH_LO, TEMP_MIN, TEMP_MAX)}%`,
                }}
              />
              {maxTemp !== null && (
                <div className="etCamBarMarker" style={{ left: `${pctOf(maxTemp, TEMP_MIN, TEMP_MAX)}%` }} />
              )}
            </div>
            <div className="etCamBarTicks">
              {TICKS.map((t) => (
                <span key={t}>{t}°</span>
              ))}
            </div>
          </div>
          <p className="etNote">
            Fixed 18-34 °C window so warmth reads consistently across frames. Shaded band marks the
            26-28 °C class boundary; the tick marks the current frame&rsquo;s max pixel.
          </p>
        </div>
      </div>

      <div className="etRow etCamTransport">
        <button type="button" className="etBtn" data-active={playing} onClick={() => setPlaying(!playing)}>
          {playing ? "Pause" : "Play"}
        </button>
        <span className="etSlider">
          <input
            type="range"
            min={0}
            max={Math.max(0, frames.length - 1)}
            value={index}
            onPointerDown={handleScrubStart}
            onChange={handleScrub}
          />
        </span>
        <span className="etMono">
          {index + 1} / {frames.length}
        </span>
        <div className="etCamSeqPicker">
          <span className="etLabel">Sequence</span>
          {sequences.map((s, i) => (
            <button
              key={`${s.sid}-${s.start}`}
              type="button"
              className="etBtn etCamSeqBtn"
              data-active={i === currentSeqIdx}
              onClick={() => jumpToSequence(s.start)}
            >
              {s.sid}
            </button>
          ))}
        </div>
      </div>

      <div className="etCamReadouts">
        <div className="etCamReadout">
          <span className="etLabel">Label</span>
          <span className={`etBadge ${frame?.label === "present" ? "etBadgePresent" : "etBadgeEmpty"}`}>
            {frame?.label ?? "—"}
          </span>
        </div>
        <div className="etCamReadout">
          <span className="etLabel">Contributor</span>
          <span className="etMono">{frame?.sid ?? "—"}</span>
        </div>
        <div className="etCamMaxTemp">
          <span className="etLabel">Max pixel</span>
          <div className="etCamMaxTempValue">
            {maxTemp !== null ? maxTemp.toFixed(1) : "—"}
            <span>°C</span>
          </div>
          <div className="etCamBarTrack etCamBarTrackMini">
            <div
              className="etCamBarBand"
              style={{
                left: `${pctOf(THRESH_LO, TEMP_MIN, TEMP_MAX)}%`,
                width: `${pctOf(THRESH_HI, TEMP_MIN, TEMP_MAX) - pctOf(THRESH_LO, TEMP_MIN, TEMP_MAX)}%`,
              }}
            />
            {maxTemp !== null && (
              <div className="etCamBarMarker" style={{ left: `${pctOf(maxTemp, TEMP_MIN, TEMP_MAX)}%` }} />
            )}
          </div>
          <p className="etNote">
            The class dataset&rsquo;s analysis found a max-temperature threshold around 26-28 °C
            separates the classes&mdash;until the room warms up, which is why the feature pipeline
            uses a BFS blob instead.
          </p>
        </div>
      </div>

      <div className="etCamAnalysis">
        <div className="etCamChips">
          <span className="etCamChip">22,054 class-wide frames</span>
          <span className="etCamChip">50.6% empty / 49.4% present</span>
          <span className="etCamChip">
            this page ships {stats?.total ?? 550} anonymized frames ({stats?.present ?? 223} present /{" "}
            {stats?.empty ?? 327} empty)
          </span>
        </div>
        <div className="etCamFigGrid">
          <div className="etCanvasWrap etCamFigCard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/demos/esp32/figures/histogram.webp" alt="Histogram of max pixel temperature by label" loading="lazy" />
            <p className="etCamFigCaption">max pixel temperature by label (class dataset)</p>
          </div>
          {(["mislabeled_1", "mislabeled_2", "mislabeled_3"] as const).map((key) => (
            <div className="etCanvasWrap etCamFigCard" key={key}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/demos/esp32/figures/${key}.webp`}
                alt="Heatmap of a likely mislabeled 'present' frame with max temperature under 26 degrees C"
                loading="lazy"
              />
              <p className="etCamFigCaption">
                &lsquo;present&rsquo; frames with max temp &lt; 26 °C&mdash;likely mislabeled
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
