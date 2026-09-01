"use client";

/**
 * Windowed analysis (mirrors ds_power_windows / fooof_on_windows): pick a well,
 * split its 600 s of synthetic LFP into `inc`-second windows, scrub the minimap
 * to pick one, and watch that slice's Welch spectrum + FOOOF params update.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PLATE_D, doseKey, groupColor } from "../core/plate";
import { getWindowFit, getWindowSignal, WINDOW_AXIS_SECONDS, WINDOW_FS } from "./windowFits";
import { useDoseCanvas } from "./useDoseCanvas";
import { hexAlpha, logLogPoints, strokePath } from "./viz";

const MIN_INC = 50;
const MAX_INC = 300;
const AXIS_SAMPLES = WINDOW_AXIS_SECONDS * WINDOW_FS; // 60000

function windowIndexFromClientX(el: HTMLElement, clientX: number, nWindows: number): number {
  const rect = el.getBoundingClientRect();
  const frac = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  return Math.max(0, Math.min(nWindows - 1, Math.floor(frac * nWindows)));
}

export default function WindowedAnalysis({ day }: { day: number }) {
  const [well, setWell] = useState<{ r: number; c: number }>({ r: 0, c: 4 });
  const [inc, setInc] = useState(100);
  const [selWindow, setSelWindow] = useState(0);
  const draggingRef = useRef(false);

  const nWindows = Math.max(1, Math.floor(WINDOW_AXIS_SECONDS / inc));
  useEffect(() => {
    setSelWindow((w) => Math.min(w, nWindows - 1));
  }, [nWindows]);

  const sig = useMemo(() => getWindowSignal(day, well.r, well.c), [day, well.r, well.c]);
  const fit = useMemo(
    () => getWindowFit(day, well.r, well.c, selWindow, inc),
    [day, well.r, well.c, selWindow, inc],
  );

  // ---------------------------------------------------------------- minimap
  const minimapDraw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fffafd";
      ctx.fillRect(0, 0, w, h);

      // waveform: per-pixel min/max over the visible 600s window
      const samplesPerPx = Math.max(1, Math.floor(AXIS_SAMPLES / w));
      let peak = 1e-6;
      for (let i = 0; i < AXIS_SAMPLES; i++) {
        const v = Math.abs(sig[i]);
        if (v > peak) peak = v;
      }
      const midY = h / 2;
      ctx.strokeStyle = "#c8759e";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const start = x * samplesPerPx;
        const end = Math.min(AXIS_SAMPLES, start + samplesPerPx);
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = start; i < end; i++) {
          const v = sig[i];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        if (lo > hi) continue;
        const y0 = midY - (hi / peak) * midY * 0.92;
        const y1 = midY - (lo / peak) * midY * 0.92;
        ctx.moveTo(x + 0.5, y0);
        ctx.lineTo(x + 0.5, y1);
      }
      ctx.stroke();

      // window boundaries + selected-window highlight
      const pxPerSec = w / WINDOW_AXIS_SECONDS;
      ctx.fillStyle = "rgba(219,39,119,0.14)";
      ctx.fillRect(selWindow * inc * pxPerSec, 0, inc * pxPerSec, h);
      ctx.strokeStyle = "rgba(219,39,119,0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(selWindow * inc * pxPerSec + 1, 1, inc * pxPerSec - 2, h - 2);

      ctx.strokeStyle = "rgba(157,20,77,0.28)";
      ctx.lineWidth = 1;
      for (let win = 0; win <= nWindows; win++) {
        const x = Math.round(win * inc * pxPerSec) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      return false;
    },
    [sig, selWindow, inc, nWindows],
  );
  const { canvasRef: mmCanvasRef, wrapRef: mmWrapRef } = useDoseCanvas(minimapDraw);

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const idx = windowIndexFromClientX(e.currentTarget, e.clientX, nWindows);
    setSelWindow(idx);
  };

  // ---------------------------------------------------------------- spectrum
  const specDraw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);
      const pad = 8;
      const lo = Math.min(...fit.logPower, ...fit.apFit) - 0.15;
      const hi = Math.max(...fit.logPower) + 0.15;

      ctx.strokeStyle = "rgba(157,20,77,0.18)";
      ctx.lineWidth = 1;
      for (const f of [2, 5, 10, 20, 50]) {
        const frac = (Math.log10(f) - Math.log10(2)) / (Math.log10(50) - Math.log10(2));
        const x = pad + frac * (w - 2 * pad);
        ctx.beginPath();
        ctx.moveTo(x, pad);
        ctx.lineTo(x, h - pad);
        ctx.stroke();
      }

      ctx.strokeStyle = "#94a3b8";
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      strokePath(ctx, logLogPoints(fit.freqs, fit.apFit, pad, pad, w - 2 * pad, h - 2 * pad, [lo, hi]));
      ctx.setLineDash([]);

      ctx.strokeStyle = groupColor(PLATE_D, doseKey(PLATE_D, well.r, well.c));
      ctx.lineWidth = 1.8;
      strokePath(ctx, logLogPoints(fit.freqs, fit.logPower, pad, pad, w - 2 * pad, h - 2 * pad, [lo, hi]));
      return false;
    },
    [fit, well.r, well.c],
  );
  const { canvasRef: specCanvasRef, wrapRef: specWrapRef } = useDoseCanvas(specDraw);

  const dose = doseKey(PLATE_D, well.r, well.c);

  return (
    <div className="ogDoseWindows">
      <div className="ogRow">
        <span className="ogLabel">Windowed analysis</span>
        <span className="ogMirror">mirrors ds_power_windows</span>
        <span className="ogNote">
          well {String.fromCharCode(65 + well.r)}
          {well.c + 1} &middot; {dose.replace(/_/g, " ")}
        </span>
      </div>

      <div className="ogDoseWindowsBody">
        <div className="ogDoseWellPicker">
          <span className="ogLabel">Well</span>
          <div className="ogDoseWellPickerGrid">
            {PLATE_D.stim.map((row, r) =>
              row.map((_, c) => {
                const d = doseKey(PLATE_D, r, c);
                const color = groupColor(PLATE_D, d);
                const active = r === well.r && c === well.c;
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    className="ogDoseWellPickBtn"
                    title={`${String.fromCharCode(65 + r)}${c + 1} — ${d.replace(/_/g, " ")}`}
                    style={{
                      background: active ? color : hexAlpha(color, 0.35),
                      outline: active ? "2px solid #6d2c4e" : "1px solid rgba(255,255,255,0.6)",
                    }}
                    onClick={() => setWell({ r, c })}
                  />
                );
              }),
            )}
          </div>
        </div>

        <div className="ogDoseWindowsMain">
          <div className="ogRow">
            <span className="ogLabel">Window size</span>
            <input
              type="range"
              className="ogSlider ogDoseIncSlider"
              min={MIN_INC}
              max={MAX_INC}
              step={10}
              value={inc}
              onChange={(e) => setInc(Number(e.target.value))}
            />
            <span className="ogMono">
              {inc}s &times; {nWindows} windows
            </span>
          </div>

          <div
            className="ogDoseMinimapWrap ogCanvasWrap"
            ref={mmWrapRef}
            onPointerDown={(e) => {
              draggingRef.current = true;
              handlePointer(e);
            }}
            onPointerMove={(e) => {
              if (draggingRef.current) handlePointer(e);
            }}
            onPointerUp={() => {
              draggingRef.current = false;
            }}
            onPointerLeave={() => {
              draggingRef.current = false;
            }}
          >
            <canvas ref={mmCanvasRef} role="img" aria-label="600 second LFP minimap with window scrubber" />
          </div>
          <p className="ogNote">click or drag to pick a {inc}s window of the well&rsquo;s synthetic LFP</p>

          <div className="ogDoseWindowSpecRow">
            <div>
              <div className="ogRow">
                <span className="ogLabel">Window spectrum</span>
                <span className="ogMirror">mirrors fooof_on_windows</span>
              </div>
              <div className="ogDoseSpecWrap ogCanvasWrap" ref={specWrapRef}>
                <canvas
                  ref={specCanvasRef}
                  role="img"
                  aria-label={`Welch spectrum and FOOOF fit for window ${selWindow}`}
                />
              </div>
            </div>
            <div className="ogDoseParamsCard">
              <span className="ogLabel">FOOOF fit, window {selWindow + 1}</span>
              <div className="ogDoseParamsGrid ogMono">
                <span>offset</span>
                <span>{fit.aperiodic[0].toFixed(3)}</span>
                <span>exponent</span>
                <span>{fit.aperiodic[fit.aperiodic.length - 1].toFixed(3)}</span>
                <span>r&sup2;</span>
                <span>{fit.rSquared.toFixed(3)}</span>
              </div>
              <span className="ogLabel" style={{ marginTop: 8, display: "block" }}>
                Peaks ({fit.peaks.length})
              </span>
              {fit.peaks.length === 0 ? (
                <p className="ogNote">no peaks above threshold in this window</p>
              ) : (
                <table className="ogDosePeakTable ogMono">
                  <thead>
                    <tr>
                      <th>CF</th>
                      <th>PW</th>
                      <th>BW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fit.peaks.map((p, i) => (
                      <tr key={i}>
                        <td>{p[0].toFixed(2)}</td>
                        <td>{p[1].toFixed(2)}</td>
                        <td>{p[2].toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
