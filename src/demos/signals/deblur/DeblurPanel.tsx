"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { fetchJson } from "@/demos/signals/dsp/assets";
import {
  addNoise,
  blurImage,
  deblurRowInto,
  firstOrderFreqzMag,
  firstOrderImpulse,
  freqzMA,
  freqzNulls,
} from "./model";
import "./deblur.css";

// ------------------------------------------------------------------ constants

const ASSET_BASE = "/demos/signals";
const X_MIN = 2;
const X_MAX = 30;
const X_DEFAULT = 8;
const NOISE_SIGMA = 0.004; // ~0.4%
const NOISE_SEED = 20240831; // AUG 2024 plate, arbitrary fixed seed
const SWEEP_MS = 900; // deblur sweep animation duration
const STEM_MS = 1100; // recursive-filter impulse reveal duration
const FREQ_POINTS = 512; // resolution of the causal-MA freqz curve (plotted over [0, pi])
const REC_POLE = 0.8;
const REC_LENGTH = 24;

interface Lab3Json {
  file: string;
  trueN: number;
  model: string;
  crop: { row0: number; row1: number; col0: number; col1: number; downsample: number };
  imageShape: [number, number];
  shipShape: [number, number];
}

interface ImageData64 {
  rows: Float64Array[];
  cols: number;
  rowsN: number;
}

type Phase = "blurred" | "deblurring" | "deblurred";

interface DeblurAnim {
  source: Float64Array[];
  recovered: Float64Array[];
  startedAt: number;
  solved: number;
  N: number;
}

// ------------------------------------------------------------------ pure-ish helpers (DOM-facing, not core math)

async function loadImageRows(url: string): Promise<ImageData64> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const cols = img.naturalWidth;
  const rowsN = img.naturalHeight;
  const off = document.createElement("canvas");
  off.width = cols;
  off.height = rowsN;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, cols, rowsN).data;
  const rows: Float64Array[] = new Array(rowsN);
  for (let r = 0; r < rowsN; r++) {
    const row = new Float64Array(cols);
    const base = r * cols * 4;
    for (let c = 0; c < cols; c++) row[c] = data[base + c * 4] / 255;
    rows[r] = row;
  }
  return { rows, cols, rowsN };
}

function paintRows(canvas: HTMLCanvasElement | null, rows: Float64Array[], cols: number): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rowsN = rows.length;
  if (canvas.width !== cols) canvas.width = cols;
  if (canvas.height !== rowsN) canvas.height = rowsN;
  const imgData = ctx.createImageData(cols, rowsN);
  const data = imgData.data;
  for (let r = 0; r < rowsN; r++) {
    const row = rows[r];
    const base = r * cols * 4;
    for (let c = 0; c < cols; c++) {
      const v = Math.max(0, Math.min(255, Math.round(row[c] * 255)));
      const idx = base + c * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * DPR-aware canvas that redraws through draw(ctx, w, h, now); redraws when `draw` changes
 * identity (i.e. its deps changed) or the wrapper resizes, and keeps ticking while draw
 * returns true.
 *
 * canvasRef/wrapRef are CALLBACK refs (not plain useRef objects): these canvases mount only
 * once their data has loaded (they live behind an `{original && meta && (...)}` guard), and a
 * plain useRef gives no signal when that attach happens. If none of `draw`'s own dependencies
 * change across that "just mounted" render (e.g. draw only depends on a slider value, not on
 * the loaded-data flag), a `useEffect(() => render(), [render, draw])` alone would only ever
 * fire once, on the pre-mount render, back when the refs were still null — leaving the canvas
 * permanently at its default 300x150 size and never drawn on. The callback refs flip a `ready`
 * bit the instant the DOM nodes actually attach, which is included in the effect deps below so
 * mounting reliably retriggers a render.
 */
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

  // Last (CSS-pixel) size actually applied to the canvas's backing store, so a sub-2px wobble
  // in the measured wrap size (see below) doesn't force a reallocation.
  const lastAppliedRef = useRef<{ w: number; h: number } | null>(null);

  const render = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const canvas = canvasElRef.current;
      const wrap = wrapElRef.current;
      if (!canvas || !wrap) return;
      // A <canvas> is display:inline by default (and effectively guaranteed to still be inline
      // if the stylesheet hasn't loaded yet), which leaves a few px of baseline descender gap
      // beneath it inside its containing block. If the wrap has no explicit height, that gap
      // inflates the wrap's own clientHeight, which the ResizeObserver below reads as "the wrap
      // resized" and reruns this same code with an even taller canvas — whose gap grows in
      // turn, feeding back into itself without bound. Forcing block layout here removes that
      // gap so a resize can never feed back into another resize this way.
      canvas.style.display = "block";
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) {
        // Layout not settled yet (e.g. mid-mount) — retry next frame instead of dead-ending.
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      // Belt-and-braces: skip the reallocation entirely when the measured size is within 2px of
      // what's already applied, so any residual jitter (rounding, a wobbling layout pass) can't
      // compound into a resize -> ResizeObserver -> resize loop either.
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

export default function DeblurPanel() {
  const [meta, setMeta] = useState<Lab3Json | null>(null);
  const [original, setOriginal] = useState<ImageData64 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [X, setX] = useState(X_DEFAULT);
  const [noiseOn, setNoiseOn] = useState(false);
  const [phase, setPhase] = useState<Phase>("blurred");
  const [recovered, setRecovered] = useState<Float64Array[] | null>(null);

  const [system, setSystem] = useState<1 | 2>(1);
  const [stemReplay, setStemReplay] = useState(0);

  const imgCanvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<DeblurAnim | null>(null);
  const sweepRafRef = useRef(0);
  const stemStart = useRef(performance.now());

  // ---- load the recovered-plate crop
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await fetchJson<Lab3Json>(`${ASSET_BASE}/lab3.json`);
        const img = await loadImageRows(`${ASSET_BASE}/${j.file}`);
        if (cancelled) return;
        setMeta(j);
        setOriginal(img);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => cancelAnimationFrame(sweepRafRef.current), []);

  // ---- derived: blurred image + (optionally) noisy version, the source the Deblur button solves
  const blurred = useMemo(() => (original ? blurImage(original.rows, X) : null), [original, X]);
  const source = useMemo(() => {
    if (!blurred) return null;
    return noiseOn ? addNoise(blurred, NOISE_SIGMA, NOISE_SEED) : blurred;
  }, [blurred, noiseOn]);

  // slider / noise-toggle changes cancel any in-flight sweep and drop back to the (new) blurred view
  useEffect(() => {
    cancelAnimationFrame(sweepRafRef.current);
    animRef.current = null;
    setPhase("blurred");
    setRecovered(null);
  }, [X, noiseOn, original]);

  // paint the static (non-animating) states directly
  useEffect(() => {
    if (!original) return;
    if (phase === "blurred" && source) paintRows(imgCanvasRef.current, source, original.cols);
    else if (phase === "deblurred" && recovered) paintRows(imgCanvasRef.current, recovered, original.cols);
  }, [phase, source, recovered, original]);

  const startDeblur = useCallback(() => {
    if (!original || !source || phase === "deblurring") return;
    const rec = source.map((row) => new Float64Array(row.length));
    const anim: DeblurAnim = { source, recovered: rec, startedAt: performance.now(), solved: 0, N: X };
    animRef.current = anim;
    setPhase("deblurring");

    const step = (now: number) => {
      const a = animRef.current;
      if (!a) return;
      const rowsN = a.source.length;
      const t = Math.min(1, (now - a.startedAt) / SWEEP_MS);
      const target = Math.floor(t * rowsN);
      while (a.solved < target) {
        deblurRowInto(a.source[a.solved], a.N, a.recovered[a.solved]);
        a.solved++;
      }
      const display: Float64Array[] = new Array(rowsN);
      for (let r = 0; r < rowsN; r++) display[r] = r < a.solved ? a.recovered[r] : a.source[r];
      paintRows(imgCanvasRef.current, display, original.cols);

      if (t < 1) {
        sweepRafRef.current = requestAnimationFrame(step);
      } else {
        setRecovered(a.recovered);
        setPhase("deblurred");
        animRef.current = null;
      }
    };
    sweepRafRef.current = requestAnimationFrame(step);
  }, [original, source, phase, X]);

  const handleXChange = (e: ChangeEvent<HTMLInputElement>) => setX(Number(e.target.value));

  // ---- draw: Toeplitz schematic
  const drawToeplitz = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      const size = Math.min(w, h) - 30;
      const x0 = (w - size) / 2;
      const y0 = (h - size) / 2 - 4;
      const L = 40; // schematic matrix dimension (independent of the real L, so the band stays legible)

      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, size, size);
      ctx.clip();
      ctx.fillStyle = "rgba(6,182,212,0.55)";
      const cellH = size / L;
      for (let row = 0; row < L; row++) {
        const kMin = Math.max(0, row - X + 1);
        const kMax = row;
        const xs = x0 + (kMin / L) * size;
        const xe = x0 + ((kMax + 1) / L) * size;
        ctx.fillRect(xs, y0 + row * cellH, Math.max(0.6, xe - xs), cellH + 0.6);
      }
      ctx.restore();

      ctx.strokeStyle = "#9aa0a6";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x0, y0, size, size);

      ctx.fillStyle = "#5f6368";
      ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("k →", x0, y0 + size + 4);
      ctx.save();
      ctx.translate(x0 - 4, y0 + size);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("j →", 0, 0);
      ctx.restore();

      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "11px Arial, Helvetica, sans-serif";
      ctx.fillText(`band width ∝ X = ${X}`, x0 + size / 2, y0 - 4);

      return false;
    },
    [X],
  );

  // ---- draw: frequency response of the length-X causal MA
  const drawFreq = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      const L = 40;
      const R = 12;
      const T = 14;
      const B = 20;
      const pw = w - L - R;
      const ph = h - T - B;
      const { w: wAll, mag: magAll } = freqzMA(X, FREQ_POINTS);
      const half = Math.floor(FREQ_POINTS / 2) + 1; // 0..pi inclusive
      const xOf = (wi: number) => L + (wi / Math.PI) * pw;
      const yOf = (m: number) => T + (1 - m) * ph;

      ctx.strokeStyle = "#dadce0";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#5f6368";
      ctx.font = "9.5px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const frac of [0, 0.5, 1]) {
        const x = Math.round(L + frac * pw) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, T);
        ctx.lineTo(x, T + ph);
        ctx.stroke();
      }
      ctx.fillText("0", L, T + ph + 3);
      ctx.fillText("π/2", L + 0.5 * pw, T + ph + 3);
      ctx.fillText("π", L + pw, T + ph + 3);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const frac of [0, 0.5, 1]) {
        const y = Math.round(yOf(frac)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(L, y);
        ctx.lineTo(L + pw, y);
        ctx.stroke();
        ctx.fillText(frac.toFixed(1), L - 4, y);
      }

      // nulls at omega = 2*pi*k/X, k = 1..floor(X/2)
      const nulls = freqzNulls(X).filter((wn) => wn <= Math.PI + 1e-9);
      for (const wn of nulls) {
        const x = xOf(wn);
        if (noiseOn) {
          ctx.fillStyle = "rgba(245,158,11,0.18)";
          ctx.fillRect(x - 3, T, 6, ph);
        }
        ctx.strokeStyle = noiseOn ? "#d97706" : "#c8cdd3";
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, T);
        ctx.lineTo(x, T + ph);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.strokeStyle = "#06B6D4";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < half; i++) {
        const x = xOf(wAll[i]);
        const y = yOf(magAll[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = "#5f6368";
      ctx.font = "10px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("|H(e^jω)|, linear", L, 2);

      return false;
    },
    [X, noiseOn],
  );

  // ---- draw: recursive-filter impulse response (stem plot, revealed stem by stem)
  useEffect(() => {
    stemStart.current = performance.now();
  }, [system, stemReplay]);

  const drawStem = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      const pole = system === 1 ? REC_POLE : -REC_POLE;
      const h_n = firstOrderImpulse(pole, REC_LENGTH);
      const L = 22;
      const R = 10;
      const T = 12;
      const B = 20;
      const pw = w - L - R;
      const ph = h - T - B;
      const mid = T + ph / 2;
      const xStep = pw / REC_LENGTH;

      const t = Math.min(1, (now - stemStart.current) / STEM_MS);
      const shown = Math.min(REC_LENGTH, Math.floor(t * (REC_LENGTH + 2)));

      ctx.strokeStyle = "#dadce0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L, mid);
      ctx.lineTo(L + pw, mid);
      ctx.stroke();

      const color = system === 1 ? "#06B6D4" : "#F59E0B";
      for (let n = 0; n < shown; n++) {
        const x = L + (n + 0.5) * xStep;
        const y = mid - h_n[n] * (ph / 2 - 6);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, mid);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#5f6368";
      ctx.font = "10px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(
        system === 1 ? "h[n] = 0.8ⁿ (System 1, lowpass)" : "h[n] = (−0.8)ⁿ (System 2, highpass)",
        L,
        2,
      );

      return shown < REC_LENGTH;
    },
    [system],
  );

  // ---- draw: recursive-filter frequency response
  const drawRecFreq = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      const pole = system === 1 ? REC_POLE : -REC_POLE;
      const L = 22;
      const R = 10;
      const T = 12;
      const B = 20;
      const pw = w - L - R;
      const ph = h - T - B;
      const N = 200;
      const wArr = new Float64Array(N);
      for (let i = 0; i < N; i++) wArr[i] = (i / (N - 1)) * Math.PI;
      const mag = firstOrderFreqzMag(pole, wArr);
      const maxMag = 1 / (1 - Math.abs(pole)); // peak, at omega=0 (System 1) or omega=pi (System 2)
      const xOf = (wi: number) => L + (wi / Math.PI) * pw;
      const yOf = (m: number) => T + (1 - m / maxMag) * ph;

      ctx.strokeStyle = "#dadce0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L, T + ph);
      ctx.lineTo(L + pw, T + ph);
      ctx.moveTo(L, T);
      ctx.lineTo(L, T + ph);
      ctx.stroke();

      const color = system === 1 ? "#06B6D4" : "#F59E0B";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = xOf(wArr[i]);
        const y = yOf(mag[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = "#5f6368";
      ctx.font = "10px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("|H(e^jω)|", L, 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("0", L, T + ph + 3);
      ctx.fillText("π", L + pw, T + ph + 3);

      return false;
    },
    [system],
  );

  const { canvasRef: toeplitzRef, wrapRef: toeplitzWrapRef } = useCanvas(drawToeplitz);
  const { canvasRef: freqRef, wrapRef: freqWrapRef } = useCanvas(drawFreq);
  const { canvasRef: stemRef, wrapRef: stemWrapRef } = useCanvas(drawStem);
  const { canvasRef: recFreqRef, wrapRef: recFreqWrapRef } = useCanvas(drawRecFreq);

  return (
    <div className="sigDb">
      {error && <p className="sigNote">Could not load the lab 3 crop: {error}</p>}
      {!original && !error && <div className="sigDbLoading">Loading the recovered plate crop…</div>}
      {original && meta && (
        <>
          <section className="sigDbSection">
            <div className="sigDbSectionHead">
              <h3>Blur / deblur</h3>
              <p>
                {phase === "deblurring"
                  ? "solving the triangular system, sweeping down the image…"
                  : phase === "deblurred"
                    ? "deblurred"
                    : "blurred — press Deblur"}
              </p>
            </div>
            <div className="sigCanvasWrap sigDbImageWrap">
              <canvas
                ref={imgCanvasRef}
                role="img"
                aria-label="The recovered license-plate crop, currently shown blurred or deblurred by the causal moving-average filter"
              />
            </div>
            <div className="sigDbControls">
              <label className="sigDbSlider">
                X (blur length)
                <input type="range" min={X_MIN} max={X_MAX} step={1} value={X} onChange={handleXChange} />
                <b>{X}</b>
              </label>
              <button
                type="button"
                className="sigBtn"
                disabled={phase === "deblurring"}
                onClick={startDeblur}
              >
                {phase === "deblurring" ? "solving…" : "Deblur"}
              </button>
              <label className="sigDbToggle">
                <input type="checkbox" checked={noiseOn} onChange={(e) => setNoiseOn(e.target.checked)} />
                add noise (σ≈0.4%) before deblurring
              </label>
            </div>
            {noiseOn && (
              <p className="sigDbNullNote">
                Near the blur&rsquo;s frequency-response nulls the inverse gain explodes — noise living
                there gets amplified into horizontal streaks. This fragility is why Wiener filters exist.
              </p>
            )}
          </section>

          <section className="sigDbSection sigDbTwoCol">
            <div>
              <div className="sigDbSectionHead">
                <h3>Toeplitz matrix</h3>
              </div>
              <div className="sigCanvasWrap sigDbToeplitzWrap" ref={toeplitzWrapRef}>
                <canvas
                  ref={toeplitzRef}
                  role="img"
                  aria-label="Schematic of the banded lower-triangular Toeplitz blur matrix H, band width proportional to X"
                />
              </div>
              <p className="sigNote" style={{ marginTop: 4 }}>
                y = H·x per row; H is Toeplitz
              </p>
            </div>
            <div>
              <div className="sigDbSectionHead">
                <h3>Frequency response</h3>
                <p>nulls at ω = 2πk/X</p>
              </div>
              <div className="sigCanvasWrap sigDbFreqWrap" ref={freqWrapRef}>
                <canvas
                  ref={freqRef}
                  role="img"
                  aria-label="Magnitude of the length-X moving average's frequency response, with nulls marked"
                />
              </div>
            </div>
          </section>

          <section className="sigDbSection">
            <div className="sigDbSectionHead">
              <h3>Recursive filters (Problem 2)</h3>
              <div className="sigDbSystemToggle">
                <button
                  type="button"
                  className={`sigBtn ${system === 1 ? "sigBtnOn" : ""}`}
                  onClick={() => setSystem(1)}
                >
                  System 1 (lowpass)
                </button>
                <button
                  type="button"
                  className={`sigBtn ${system === 2 ? "sigBtnOn" : ""}`}
                  onClick={() => setSystem(2)}
                >
                  System 2 (highpass)
                </button>
                <button type="button" className="sigBtn" onClick={() => setStemReplay((n) => n + 1)}>
                  replay
                </button>
              </div>
            </div>
            <p className="sigNote" style={{ marginTop: 4 }}>
              {system === 1
                ? "y[n] − 0.8·y[n−1] = x[n]"
                : "y[n] + 0.8·y[n−1] = x[n]"}
            </p>
            <div className="sigDbRecursive">
              <div className="sigCanvasWrap sigDbStemWrap" ref={stemWrapRef}>
                <canvas
                  ref={stemRef}
                  role="img"
                  aria-label="Impulse response of the selected first-order recursive system, revealed stem by stem"
                />
              </div>
              <div className="sigCanvasWrap sigDbRecFreqWrap" ref={recFreqWrapRef}>
                <canvas
                  ref={recFreqRef}
                  role="img"
                  aria-label="Magnitude frequency response of the selected first-order recursive system"
                />
              </div>
            </div>
          </section>

          <section className="sigDbSection">
            <div className="sigDbStats">
              <div className="sigDbStat">
                <span className="sigDbStatLabel">true N (lab image)</span>
                <span className="sigDbStatValue">{meta.trueN}</span>
              </div>
              <div className="sigDbStat">
                <span className="sigDbStatLabel">current X</span>
                <span className="sigDbStatValue">{X}</span>
              </div>
            </div>
            <p className="sigNote">
              The lab shipped a mystery image blurred by a horizontal moving average — a causal
              length-N filter, each row y = H·x with H the lower-triangular Toeplitz banded matrix
              above. Students found N by trial and error; rebuilding this demo found the true value,
              N = {meta.trueN}, the unique length whose inverse puts every pixel back in [0,1] —
              recovering a self-balancing robot with a California vanity plate &ldquo;I ♥
              ECE101&rdquo; (AUG 2024), shown above. Two fun facts: David&rsquo;s own deblur.m helper
              used MATLAB&rsquo;s one-argument toeplitz(), which builds a SYMMETRIC matrix — the
              lab&rsquo;s blur is causal, which is why his original reconstructions kept faint ghosts;
              and the faint double-exposure remaining in the recovered photo is real motion — the
              self-balancing robot rocking during the exposure.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
