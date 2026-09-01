"use client";

/**
 * Chapter 2 — "What's in a spectrum" (Sep 2024, Plate A).
 *
 * Click any well on the (illustrative) 6x8 plate and its Welch power
 * spectrum draws in log-log, the FOOOF aperiodic 1/f fit slides underneath,
 * and each fitted Gaussian peak pops out — one at a time, tallest first —
 * before the full model draws over the data. A second, smaller axis mirrors
 * fooof's plot_annotated_peak_search: the flattened (data - aperiodic)
 * spectrum with peaks found and subtracted in the same order.
 *
 * All data is seeded synthetic (synthLfp / welch / fitSpecparam from
 * ../core), regenerated per well — illustrative only. The real Plate A
 * FOOOF figures ship in the strip at the bottom via figures.ts.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PLATE_D } from "../core/plate";
import { hashSeed, synthLfp, wellParams } from "../core/synth";
import { welch } from "../core/welch";
import { fitSpecparam, PROJECT_SETTINGS, type AperiodicMode, type SpecparamResult } from "../core/specparam";
import { figureUrl, useOrgFigures } from "../figures";
import "./spectrum.css";

// ------------------------------------------------------------------ constants

const ROW_LETTERS = ["A", "B", "C", "D", "E", "F"];
const N_COLS = 8;

const INK = "#222222"; // spectrum
const MODEL_RED = "#d62728"; // full model
const AP_BLUE = "#1f77b4"; // aperiodic fit (dashed)
const PEAK_GREEN = "#2ca02c"; // gaussian peaks
const GRID = "#e3c3d4";
const MUTED = "#86607a";

const FREQ_RANGE: [number, number] = [2, 50];
const FREQ_TICKS = [2, 5, 10, 20, 50];

// animation phase durations (ms) — sequential, cancel-safe (see useElapsedMs)
const PHASE_SPECTRUM = 750;
const PHASE_AP = 700;
const PHASE_PEAK = 700;
const PEAK_COUNT_MS = 400; // the CF/PW/BW readout counts up over the first ~400ms of a peak's phase
const PHASE_MODEL = 800;

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

// ------------------------------------------------------------------ fit cache
// A fit takes only a few ms, but there's no reason to redo it every time the
// same well/mode is revisited — cache per (well, mode) for the page session.

const fitCache = new Map<string, SpecparamResult>();

function getFit(row: number, col: number, mode: AperiodicMode): SpecparamResult {
  const key = `${mode}:${row}:${col}`;
  let fit = fitCache.get(key);
  if (!fit) {
    const sig = synthLfp(wellParams(PLATE_D, -1, row, col), hashSeed("ch2", row, col), 16384, 100);
    const { freqs, psd } = welch(sig, 100);
    fit = fitSpecparam(freqs, psd, FREQ_RANGE, { ...PROJECT_SETTINGS, aperiodicMode: mode });
    fitCache.set(key, fit);
  }
  return fit;
}

function subtractGaussian(arr: number[], freqs: number[], ctr: number, hgt: number, wid: number, frac: number): number[] {
  if (frac <= 0) return arr;
  return arr.map((v, i) => {
    const d = freqs[i] - ctr;
    return v - hgt * frac * Math.exp((-d * d) / (2 * wid * wid));
  });
}

function niceStep(range: number): number {
  if (!(range > 0)) return 1;
  const raw = range / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

// ------------------------------------------------------------------ animation phase math

interface Phase {
  specReveal: number;
  apProgress: number;
  peakProgress: number[]; // bump growth, per peak (display order), 0..1
  peakCount: number[]; // CF/PW/BW readout count-up, per peak, 0..1 (reaches 1 well before peakProgress)
  modelProgress: number;
  activeIdx: number; // index (into display order) of the peak currently animating, -1 if none
}

function computePhase(elapsed: number, nPeaks: number): Phase {
  let t = elapsed;
  const specReveal = ease(clamp01(t / PHASE_SPECTRUM));
  t -= PHASE_SPECTRUM;
  const apProgress = ease(clamp01(t / PHASE_AP));
  t -= PHASE_AP;
  const peakProgress: number[] = [];
  const peakCount: number[] = [];
  for (let i = 0; i < nPeaks; i++) {
    peakProgress.push(ease(clamp01(t / PHASE_PEAK)));
    peakCount.push(ease(clamp01(t / PEAK_COUNT_MS)));
    t -= PHASE_PEAK;
  }
  const modelProgress = ease(clamp01(t / PHASE_MODEL));
  const activeIdx = peakProgress.findIndex((p) => p < 1);
  return { specReveal, apProgress, peakProgress, peakCount, modelProgress, activeIdx };
}

/**
 * Elapsed ms since (row, col, mode) last changed, ticking via rAF while the
 * sequence plays and stopping once it reaches `totalMs`. The start time is
 * reset synchronously in the render body (not in an effect) so a well click
 * never shows one stale animated frame before the reset takes effect; the
 * rAF loop itself lives in an effect keyed on `seqKey`, so React's
 * cleanup-before-next-effect guarantee makes rapid well switching
 * cancel-safe — there is only ever one live loop.
 */
function useElapsedMs(seqKey: string, totalMs: number): number {
  const [, bump] = useState(0);
  const seqRef = useRef<string | null>(null);
  const startRef = useRef(performance.now());
  if (seqRef.current !== seqKey) {
    seqRef.current = seqKey;
    startRef.current = performance.now();
  }

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      bump((n) => n + 1);
      if (performance.now() - startRef.current < totalMs) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seqKey, totalMs]);

  return Math.min(totalMs, Math.max(0, performance.now() - startRef.current));
}

// ------------------------------------------------------------------ canvas hook
// DPR-aware; redraws on demand (when `draw`'s identity changes, i.e. its own
// deps changed) or on a real resize. No internal rAF loop of its own — the
// animation clock lives in useElapsedMs above, which is what makes `draw`'s
// identity change every frame while a sequence is playing.

function useSpecCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const [ready, setReady] = useState(false);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const wrapElRef = useRef<HTMLDivElement | null>(null);
  const lastAppliedRef = useRef<{ w: number; h: number } | null>(null);
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

  const render = useCallback(() => {
    const canvas = canvasElRef.current;
    const wrap = wrapElRef.current;
    if (!canvas || !wrap) return;
    canvas.style.display = "block";
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
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
    drawRef.current(ctx, w, h);
  }, []);

  useEffect(() => {
    render();
  }, [render, draw, ready]);

  useEffect(() => {
    const wrap = wrapElRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => render());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [render, ready]);

  return { canvasRef, wrapRef };
}

// ------------------------------------------------------------------ component

export default function SpectrumPanel() {
  const [selRow, setSelRow] = useState(0);
  const [selCol, setSelCol] = useState(4); // A5 — 20uM_5MeO-stim, usually shows a peak
  const [mode, setMode] = useState<AperiodicMode>("fixed");

  const currentFit = getFit(selRow, selCol, mode);

  // display order: peaks sorted tallest (PW) first — the order the animation pops them in
  const order = useMemo(() => {
    const idx = currentFit.peaks.map((_, i) => i);
    idx.sort((a, b) => currentFit.peaks[b][1] - currentFit.peaks[a][1]);
    return idx;
  }, [currentFit]);

  const seqKey = `${mode}:${selRow}:${selCol}`;
  const totalMs = PHASE_SPECTRUM + PHASE_AP + order.length * PHASE_PEAK + PHASE_MODEL;
  const elapsed = useElapsedMs(seqKey, totalMs);
  const phase = computePhase(elapsed, order.length);

  const yRange = useMemo((): [number, number] => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const arr of [currentFit.logPower, currentFit.model, currentFit.apFit]) {
      for (const v of arr) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    const pad = (hi - lo) * 0.14 || 0.5;
    return [lo - pad, hi + pad];
  }, [currentFit]);

  // ---- main spectrum axis: draws in phase order a -> b -> c -> d (see module doc)
  const drawMain = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fffdfb";
      ctx.fillRect(0, 0, w, h);

      const L = 44;
      const R = 14;
      const T = 16;
      const B = 26;
      const pw = w - L - R;
      const ph = h - T - B;
      const [yMin, yMax] = yRange;
      const [fMin, fMax] = FREQ_RANGE;
      const logSpan = Math.log10(fMax) - Math.log10(fMin);
      const xOf = (f: number) => L + ((Math.log10(f) - Math.log10(fMin)) / logSpan) * pw;
      const yOf = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * ph;

      // grid + axis ticks
      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillStyle = MUTED;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const f of FREQ_TICKS) {
        const x = Math.round(xOf(f)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, T);
        ctx.lineTo(x, T + ph);
        ctx.stroke();
        ctx.fillText(`${f}`, x, T + ph + 4);
      }
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const yStep = niceStep(yMax - yMin);
      for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax + 1e-9; v += yStep) {
        const y = Math.round(yOf(v)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(L, y);
        ctx.lineTo(L + pw, y);
        ctx.stroke();
        ctx.fillText(v.toFixed(1), L - 5, y);
      }

      const { freqs, logPower, apFit, model, gaussians } = currentFit;

      // b: aperiodic fit, dashed blue, sliding up from below into place
      if (phase.apProgress > 0) {
        const riseOffsetPx = (1 - phase.apProgress) * 34;
        ctx.save();
        ctx.globalAlpha = clamp01(phase.apProgress * 2.2);
        ctx.strokeStyle = AP_BLUE;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        for (let i = 0; i < freqs.length; i++) {
          const x = xOf(freqs[i]);
          const y = yOf(apFit[i]) + riseOffsetPx;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // c: gaussian peaks, tallest first — each pops out as a filled bump on the aperiodic baseline
      order.forEach((gi, i) => {
        const p = phase.peakProgress[i];
        if (p <= 0) return;
        const [ctr, hgt, wid] = gaussians[gi];
        const active = i === phase.activeIdx;
        ctx.save();
        ctx.fillStyle = active ? "rgba(44,160,44,0.30)" : "rgba(44,160,44,0.16)";
        ctx.beginPath();
        for (let k = 0; k < freqs.length; k++) {
          const f = freqs[k];
          const d = f - ctr;
          const g = hgt * p * Math.exp((-d * d) / (2 * wid * wid));
          const x = xOf(f);
          const y = yOf(apFit[k] + g);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let k = freqs.length - 1; k >= 0; k--) {
          ctx.lineTo(xOf(freqs[k]), yOf(apFit[k]));
        }
        ctx.closePath();
        ctx.fill();
        if (active) {
          const cx = xOf(ctr);
          const cy = yOf(apFit[Math.round(((ctr - fMin) / (fMax - fMin)) * (freqs.length - 1))] + hgt * p);
          ctx.fillStyle = PEAK_GREEN;
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // a: raw Welch spectrum, black, revealed left to right
      ctx.save();
      ctx.beginPath();
      ctx.rect(L, T - 4, pw * phase.specReveal + 1, ph + 8);
      ctx.clip();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < freqs.length; i++) {
        const x = xOf(freqs[i]);
        const y = yOf(logPower[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // d: full model, red, draws over the data once every peak has popped
      if (phase.modelProgress > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(L, T - 4, pw * phase.modelProgress + 1, ph + 8);
        ctx.clip();
        ctx.strokeStyle = MODEL_RED;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < freqs.length; i++) {
          const x = xOf(freqs[i]);
          const y = yOf(model[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = MUTED;
      ctx.font = "10.5px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("log10(power) vs frequency (Hz, log)", L, 1);
    },
    [currentFit, order, phase, yRange],
  );

  // ---- flattened axis: mirrors plot_annotated_peak_search — the data minus
  // the aperiodic fit, with peaks found and subtracted in display order
  const drawFlat = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fffdfb";
      ctx.fillRect(0, 0, w, h);
      const revealAlpha = clamp01(phase.apProgress * 1.6);
      if (revealAlpha <= 0) return;

      const L = 44;
      const R = 14;
      const T = 10;
      const B = 20;
      const pw = w - L - R;
      const ph = h - T - B;
      const { freqs, flat, gaussians } = currentFit;
      const [fMin, fMax] = FREQ_RANGE;
      const logSpan = Math.log10(fMax) - Math.log10(fMin);
      const xOf = (f: number) => L + ((Math.log10(f) - Math.log10(fMin)) / logSpan) * pw;

      let lo = Math.min(0, ...flat);
      let hi = Math.max(0.1, ...flat);
      const pad = (hi - lo) * 0.18 || 0.2;
      lo -= pad;
      hi += pad;
      const yOf = (v: number) => T + (1 - (v - lo) / (hi - lo)) * ph;

      ctx.save();
      ctx.globalAlpha = revealAlpha;

      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      const y0 = Math.round(yOf(0)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(L, y0);
      ctx.lineTo(L + pw, y0);
      ctx.stroke();

      // subtract every peak that's already fully popped, in display order
      let residual = flat;
      for (let i = 0; i < phase.peakProgress.length; i++) {
        if (phase.peakProgress[i] >= 1) {
          const [ctr, hgt, wid] = gaussians[order[i]];
          residual = subtractGaussian(residual, freqs, ctr, hgt, wid, 1);
        }
      }
      // the one currently animating: guide line at its CF, partially subtracted
      if (phase.activeIdx >= 0) {
        const [ctr, hgt, wid] = gaussians[order[phase.activeIdx]];
        const gx = Math.round(xOf(ctr)) + 0.5;
        ctx.strokeStyle = PEAK_GREEN;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(gx, T);
        ctx.lineTo(gx, T + ph);
        ctx.stroke();
        ctx.setLineDash([]);
        residual = subtractGaussian(residual, freqs, ctr, hgt, wid, phase.peakProgress[phase.activeIdx]);
      }

      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i < freqs.length; i++) {
        const x = xOf(freqs[i]);
        const y = yOf(residual[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = MUTED;
      ctx.font = "9.5px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("flattened (data − aperiodic)", L, 0);
    },
    [currentFit, order, phase],
  );

  const { canvasRef: mainCanvasRef, wrapRef: mainWrapRef } = useSpecCanvas(drawMain);
  const { canvasRef: flatCanvasRef, wrapRef: flatWrapRef } = useSpecCanvas(drawFlat);

  const figs = useOrgFigures("spectrum");
  const wellLabel = `${ROW_LETTERS[selRow]}${selCol + 1}`;
  const wellDose = PLATE_D.doses[selRow][selCol];
  const [offset, knee, exponent] =
    mode === "knee"
      ? [currentFit.aperiodic[0], currentFit.aperiodic[1], currentFit.aperiodic[2]]
      : [currentFit.aperiodic[0], null, currentFit.aperiodic[1]];

  return (
    <div className="ogSpec">
      <div className="ogRow ogSpecHeadRow">
        <span className="ogSynthBadge">illustrative signals — the real Plate A figures are on the right</span>
        <span className="ogLabel">
          well {wellLabel} · {wellDose}
        </span>
      </div>

      <div className="ogSpecMain">
        <div className="ogSpecPlateCol">
          <span className="ogLabel">Plate D — click a well</span>
          <div className="ogSpecPlateGrid" role="grid" aria-label="6 by 8 well plate">
            <div className="ogSpecPlateCorner" />
            {Array.from({ length: N_COLS }, (_, c) => (
              <div key={`col-${c}`} className="ogSpecPlateColLabel">
                {c + 1}
              </div>
            ))}
            {ROW_LETTERS.map((letter, r) => (
              <Fragment key={`row-${r}`}>
                <div className="ogSpecPlateRowLabel">{letter}</div>
                {Array.from({ length: N_COLS }, (_, c) => (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    className="ogSpecPlateCell"
                    data-active={selRow === r && selCol === c}
                    onClick={() => {
                      setSelRow(r);
                      setSelCol(c);
                    }}
                    aria-label={`well ${letter}${c + 1} — ${PLATE_D.doses[r][c]}`}
                  />
                ))}
              </Fragment>
            ))}
          </div>

          <div className="ogSpecModeRow">
            <span className="ogLabel">aperiodic mode</span>
            <div className="ogRow">
              <button type="button" className="ogBtn" data-active={mode === "fixed"} onClick={() => setMode("fixed")}>
                fixed
              </button>
              <button type="button" className="ogBtn" data-active={mode === "knee"} onClick={() => setMode("knee")}>
                knee
              </button>
            </div>
            <p className="ogNote">organoid spectra bend — knee mode follows the bend</p>
          </div>

          <span className="ogMirror">
            mirrors fooof_all_pspectra / set_fm_array (min_peak_height=0.6, peak_width_limits=(4,15),
            peak_threshold=0.6)
          </span>
        </div>

        <div className="ogSpecAxisCol">
          <div className="ogSpecLegend">
            <span className="ogSpecLegendItem">
              <i className="ogSpecSwatch ogSpecSwatchSpectrum" /> spectrum
            </span>
            <span className="ogSpecLegendItem">
              <i className="ogSpecSwatch ogSpecSwatchAp" /> aperiodic
            </span>
            <span className="ogSpecLegendItem">
              <i className="ogSpecSwatch ogSpecSwatchPeak" /> peaks
            </span>
            <span className="ogSpecLegendItem">
              <i className="ogSpecSwatch ogSpecSwatchModel" /> full model
            </span>
          </div>
          <div className="ogCanvasWrap ogSpecCanvasWrap" ref={mainWrapRef}>
            <canvas
              ref={mainCanvasRef}
              role="img"
              aria-label={`FOOOF decomposition of well ${wellLabel}: spectrum, aperiodic fit, peaks, and full model`}
            />
          </div>

          <div className="ogRow ogSpecFlatHead">
            <span className="ogLabel">flattened — peak search</span>
            <span className="ogMirror">mirrors plot_annotated_peak_search</span>
          </div>
          <div className="ogCanvasWrap ogSpecFlatCanvasWrap" ref={flatWrapRef}>
            <canvas
              ref={flatCanvasRef}
              role="img"
              aria-label={`Flattened spectrum for well ${wellLabel}, with peaks found and subtracted in order`}
            />
          </div>
        </div>

        <div className="ogSpecReadouts">
          <div className="ogSpecReadoutBlock">
            <span className="ogLabel">aperiodic ({mode})</span>
            <div className="ogSpecParamRow">
              <span>offset</span>
              <span className="ogMono">{(offset * phase.apProgress).toFixed(3)}</span>
            </div>
            {knee !== null && (
              <div className="ogSpecParamRow">
                <span>knee</span>
                <span className="ogMono">{(knee * phase.apProgress).toFixed(1)}</span>
              </div>
            )}
            <div className="ogSpecParamRow">
              <span>exponent</span>
              <span className="ogMono">{(exponent * phase.apProgress).toFixed(3)}</span>
            </div>
          </div>

          <div className="ogSpecReadoutBlock">
            <span className="ogLabel">peaks ({order.length})</span>
            {order.length === 0 ? (
              <p className="ogNote">no peaks above threshold</p>
            ) : (
              <table className="ogSpecPeakTable">
                <thead>
                  <tr>
                    <th>CF</th>
                    <th>PW</th>
                    <th>BW</th>
                  </tr>
                </thead>
                <tbody>
                  {order.map((gi, i) => {
                    const c = phase.peakCount[i];
                    if (c <= 0) return null;
                    const [cf, pw, bw] = currentFit.peaks[gi];
                    return (
                      <tr key={gi} className={i === phase.activeIdx ? "ogSpecPeakActive" : undefined}>
                        <td>{(cf * c).toFixed(1)}</td>
                        <td>{(pw * c).toFixed(2)}</td>
                        <td>{(bw * c).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className={`ogSpecReadoutBlock${phase.modelProgress > 0 ? " ogSpecFitShown" : " ogSpecFitHidden"}`}>
            <span className="ogLabel">fit</span>
            <div className="ogSpecParamRow">
              <span>r²</span>
              <span className="ogMono">{(currentFit.rSquared * clamp01(phase.modelProgress * 1.3)).toFixed(4)}</span>
            </div>
            <div className="ogSpecParamRow">
              <span>MAE</span>
              <span className="ogMono">{(currentFit.error * clamp01(phase.modelProgress * 1.3)).toFixed(4)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ogFigStrip">
        {figs.map((f) => (
          <figure key={f.file}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={figureUrl(f)} alt={f.caption} loading="lazy" width={f.w} height={f.h} />
            <figcaption>
              {f.caption} <span className="ogFigReal">real figure</span>
              <br />
              <span className="ogMono">{f.source}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="ogNote">
        Every well&rsquo;s spectrum is decomposed the way <span className="ogMono">set_fm_array</span> decomposes
        Plate A: a robust aperiodic (1/f) fit, then an iterative Gaussian peak search on the flattened residual,
        then a joint refit. The 6×8 plate and its FOOOF fits above are seeded synthetic stand-ins (Plate D
        parameters) so the animation is reproducible on every load — the real Plate A fits are the figures below.
      </p>
    </div>
  );
}
