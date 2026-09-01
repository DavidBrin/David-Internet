"use client";

/**
 * The Plate D grid — two view modes on ONE canvas (overlaying a DOM grid that
 * supplies the pale dose tints and hover targets, mirroring the esp32 camera
 * panel's canvas-over-wrap pattern):
 *  - "spectra": each well tinted by dose group, with a mini log-log FOOOF
 *    spectrum sparkline drawn on the shared canvas.
 *  - "heatmap": cells filled on a viridis ramp by offset / exponent / peak
 *    power (mirrors param_heatmap); scrubbing the day tweens every cell's
 *    color + printed value toward the new day over ~250ms.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PLATE_D, doseKey, groupColor } from "../core/plate";
import {
  ensureDayFits,
  getCachedFit,
  cachedCountForDay,
  paramValue,
  PARAM_DOMAIN,
  PARAM_LABEL,
  type HeatmapParam,
} from "./plateFits";
import { useDoseCanvas } from "./useDoseCanvas";
import { viridis, rgbCss, luminance, gradientCss, clamp01, hexAlpha, logLogPoints, strokePath } from "./viz";

const ROWS = 6;
const COLS = 8;
const TWEEN_ALPHA = 0.18;
const TWEEN_EPS = 0.0015;
const PARAMS: HeatmapParam[] = ["offset", "exponent", "peak"];

interface PlateViewProps {
  day: number;
}

export default function PlateView({ day }: PlateViewProps) {
  const [mode, setMode] = useState<"spectra" | "heatmap">("heatmap");
  const [param, setParam] = useState<HeatmapParam>("exponent");
  const [fitVersion, setFitVersion] = useState(0);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  useEffect(() => {
    const cancel = ensureDayFits(day, () => setFitVersion((v) => v + 1));
    return cancel;
  }, [day]);

  const cachedN = cachedCountForDay(day);
  const loadingDay = cachedN < ROWS * COLS;

  const displayedRef = useRef<Map<string, number>>(new Map());

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);
      const cw = w / COLS;
      const ch = h / ROWS;
      let stillMoving = false;

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = c * cw;
          const y = r * ch;
          const fit = getCachedFit(day, r, c);

          if (mode === "heatmap") {
            const [lo, hi] = PARAM_DOMAIN[param];
            const k = `${r}:${c}`;
            const target = fit ? paramValue(fit, param) : (displayedRef.current.get(k) ?? (lo + hi) / 2);
            const prev = displayedRef.current.get(k) ?? target;
            const next = prev + (target - prev) * TWEEN_ALPHA;
            displayedRef.current.set(k, next);
            if (Math.abs(target - next) > TWEEN_EPS) stillMoving = true;

            const t = clamp01((next - lo) / (hi - lo));
            const color = viridis(t);
            ctx.fillStyle = rgbCss(color);
            ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);

            ctx.fillStyle = luminance(color) > 0.55 ? "rgba(24,12,24,0.85)" : "rgba(255,255,255,0.94)";
            ctx.font = "11px var(--font-mono, ui-monospace, Consolas, monospace)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(next.toFixed(2), x + cw / 2, y + ch / 2 + 0.5);
          } else if (fit) {
            const dose = doseKey(PLATE_D, r, c);
            ctx.strokeStyle = groupColor(PLATE_D, dose);
            ctx.lineWidth = 1.2;
            const pad = Math.min(cw, ch) * 0.18;
            const pts = logLogPoints(
              fit.result.freqs,
              fit.result.logPower,
              x + pad,
              y + pad,
              cw - 2 * pad,
              ch - 2 * pad,
            );
            strokePath(ctx, pts);
          }

          ctx.strokeStyle = "rgba(255,255,255,0.55)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
        }
      }
      return mode === "heatmap" && stillMoving;
    },
    // fitVersion isn't read directly but a new value must recreate `draw` so the
    // render loop restarts and keeps tweening newly-arrived chunks toward target.
    [day, mode, param, fitVersion],
  );

  const { canvasRef, wrapRef } = useDoseCanvas(draw);

  const colorbarGradient = gradientCss(viridis);
  const [domainLo, domainHi] = PARAM_DOMAIN[param];

  const hoverFit = hover ? getCachedFit(day, hover.r, hover.c) : undefined;
  const hoverDose = hover ? doseKey(PLATE_D, hover.r, hover.c) : "";

  return (
    <div className="ogDosePlate">
      <div className="ogRow">
        <span className="ogLabel">Plate view</span>
        <button type="button" className="ogBtn" data-active={mode === "spectra"} onClick={() => setMode("spectra")}>
          Spectra
        </button>
        <button type="button" className="ogBtn" data-active={mode === "heatmap"} onClick={() => setMode("heatmap")}>
          Heatmap
        </button>
        {mode === "heatmap" ? (
          <>
            <span className="ogLabel" style={{ marginLeft: 8 }}>
              Parameter
            </span>
            {PARAMS.map((p) => (
              <button
                key={p}
                type="button"
                className="ogBtn"
                data-active={param === p}
                onClick={() => setParam(p)}
              >
                {PARAM_LABEL[p]}
              </button>
            ))}
            <span className="ogMirror">mirrors param_heatmap</span>
          </>
        ) : (
          <span className="ogNote">hover a well for its dose + fitted offset/exponent</span>
        )}
        {loadingDay && (
          <span className="ogNote ogDoseProgress">
            fitting D{day}&hellip; {cachedN}/{ROWS * COLS}
          </span>
        )}
      </div>

      <div className="ogDosePlateArea">
        <div className="ogDoseRowLabels">
          {PLATE_D.stim.map((row, r) => (
            <span key={r} className="ogChip ogDoseRowChip">
              {row[0] ? "stim" : "no-stim"}
            </span>
          ))}
        </div>

        <div className="ogDosePlateWrap ogCanvasWrap" ref={wrapRef}>
          <div className="ogDosePlateGrid">
            {PLATE_D.stim.map((row, r) =>
              row.map((_, c) => {
                const dose = doseKey(PLATE_D, r, c);
                const color = groupColor(PLATE_D, dose);
                return (
                  <div
                    key={`${r}-${c}`}
                    className="ogDoseWell"
                    style={{ background: mode === "spectra" ? hexAlpha(color, 0.16) : "transparent" }}
                    onMouseEnter={() => setHover({ r, c })}
                    onMouseLeave={() => setHover((h) => (h && h.r === r && h.c === c ? null : h))}
                  >
                    {hover && hover.r === r && hover.c === c && (
                      <div className="ogDoseTooltip">
                        <strong>{dose.replace(/_/g, " ")}</strong>
                        {PLATE_D.stim[r][c] ? " · stim" : " · no-stim"}
                        <br />
                        {hoverFit ? (
                          <span className="ogMono">
                            offset {hoverFit.offset.toFixed(2)} · exponent {hoverFit.exponent.toFixed(2)}
                          </span>
                        ) : (
                          <span className="ogMono">fitting&hellip;</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
          <canvas
            ref={canvasRef}
            className="ogDosePlateCanvas"
            role="img"
            aria-label={`Plate D, ${mode} view, day ${day}`}
          />
        </div>

        {mode === "heatmap" && (
          <div className="ogDoseColorbar">
            <span className="ogLabel">{PARAM_LABEL[param]}</span>
            <div className="ogDoseColorbarTrack" style={{ background: colorbarGradient }} />
            <div className="ogDoseColorbarTicks">
              <span>{domainLo.toFixed(1)}</span>
              <span>{domainHi.toFixed(1)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
