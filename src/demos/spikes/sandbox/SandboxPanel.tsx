"use client";

/**
 * Parameter → shape sandbox — the fit inverted. Two generative models turn
 * sliders into a waveform, drawn over a ghosted real spike:
 *
 *   - "ramp + exponential": the exact spikeparam pieces (resting → linear
 *     ramp → peak → bounded exponential decay), using `expFunc` from
 *     ../core/features for the decay. The peak itself is a cosine bridge —
 *     spikeparam never models the peak's shape, only its amplitude/width.
 *   - "two skewed Gaussians": the 10-parameter `simGaussianSpike` model from
 *     ../core/skg, defaulted to the params fitted (at build) to the dataset
 *     mean spike (tests/fixtures/spikes-skg.json, r² ≈ 0.9997).
 *
 * Ghosts are the first fitted spike of each shipped sweep (fitSweep run once
 * per sweep, memoized) plus the mean of ~200 decoded dataset waveforms. A
 * mini ISI train below reuses ../core/patchSim's `simPatch` to stitch the
 * current generated (or ghost) waveform into a short spike train.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpikesData } from "../store";
import { decodeI16 } from "../core/data";
import { fitSweep, PROJECT_FIT } from "../core/spike";
import { computeFeatures, expFunc } from "../core/features";
import { simGaussianSpike, skgFromArray, type SkgParams } from "../core/skg";
import { simPatch } from "../core/patchSim";
import "./sandbox.css";

// ------------------------------------------------------------------ constants

const ACCENT = "#F59E0B";
const GHOST_COLOR = "rgba(90,80,60,0.55)";
const COMP_A_COLOR = "#0891B2";
const COMP_B_COLOR = "#7C3AED";

/** Display grid for the main axis + the SKG model's native resolution: 251
 * points over ±5ms (matches PROJECT_FIT's windowLength and waveforms.json's
 * decimated windows), so every ghost — sweep-derived or dataset-mean — lines
 * up on the same time axis without resampling the drawn curve itself. */
const N_DISPLAY = 251;
const T_HALF_MS = 5;

type Mode = "rampExp" | "skg";

interface RampExpParams {
  rampAmp: number;
  inflectionAmp: number;
  peakAmp: number;
  peakWidth: number;
  expAmp: number;
  expLambda: number;
  expConst: number;
}

const RAMP_EXP_DEFAULT: RampExpParams = {
  rampAmp: 2.5,
  inflectionAmp: -46,
  peakAmp: 16,
  peakWidth: 0.7,
  expAmp: 32,
  expLambda: 3,
  expConst: -55,
};

const RAMP_EXP_SLIDERS: Array<{
  key: keyof RampExpParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}> = [
  { key: "rampAmp", label: "ramp_amp", min: 0.5, max: 20, step: 0.01, unit: "mV/ms" },
  { key: "inflectionAmp", label: "inflection_amp", min: -50, max: -20, step: 0.1, unit: "mV" },
  { key: "peakAmp", label: "peak_amp", min: 0, max: 55, step: 0.1, unit: "mV" },
  { key: "peakWidth", label: "peak_width", min: 0.3, max: 4, step: 0.01, unit: "ms" },
  { key: "expAmp", label: "exp_amp", min: 5, max: 200, step: 0.5, unit: "" },
  { key: "expLambda", label: "exp_lambda", min: 0.1, max: 8, step: 0.01, unit: "/ms" },
  { key: "expConst", label: "exp_const", min: -80, max: -40, step: 0.1, unit: "mV" },
];

/** skg.fit params fitted (at build time) to the dataset mean spike —
 * tests/fixtures/spikes-skg.json's `params` array, order = paramNames:
 * [a_ctr, a_std, a_alpha, a_scale, b_ctr, b_std, b_alpha, b_scale, scale, offset].
 * r² of that fit against the mean spike, from the same fixture. */
const SKG_DEFAULT_ARR = [
  0.473296, 0.059848, 1.495835, 1.08785, 0.613775, 0.688677, -3.487555, 0.217375, 52.458786, -53.272628,
];
const SKG_DEFAULT_R2 = 0.9996671290644136;
const SKG_DEFAULT: SkgParams = skgFromArray(SKG_DEFAULT_ARR);

const SKG_SLIDERS: Array<{ key: keyof SkgParams; label: string; min: number; max: number; step: number }> = [
  { key: "aCtr", label: "a_ctr", min: 0, max: 1, step: 0.001 },
  { key: "aStd", label: "a_std", min: 0.01, max: 1, step: 0.001 },
  { key: "aAlpha", label: "a_alpha", min: -10, max: 10, step: 0.01 },
  { key: "aScale", label: "a_scale", min: 0, max: 3, step: 0.001 },
  { key: "bCtr", label: "b_ctr", min: 0, max: 1, step: 0.001 },
  { key: "bStd", label: "b_std", min: 0.01, max: 1, step: 0.001 },
  { key: "bAlpha", label: "b_alpha", min: -10, max: 10, step: 0.01 },
  { key: "bScale", label: "b_scale", min: 0, max: 3, step: 0.001 },
  { key: "scale", label: "scale", min: 0, max: 150, step: 0.1 },
  { key: "offset", label: "offset", min: -100, max: 0, step: 0.1 },
];

// ---------------------------------------------------------------- generative

/** Mode A: resting → linear ramp → cosine peak bridge → bounded exp decay.
 * `t` is ms relative to the model's own peak (t=0), matching how ghosts are
 * addressed below (peakIdx is each ghost's t=0). */
function rampExpValue(p: RampExpParams, t: number): number {
  const halfPeak = Math.max(0.01, p.peakWidth / 2);
  const rampDur = Math.max(0.05, (p.inflectionAmp - p.expConst) / p.rampAmp);
  const inflectT = -halfPeak;
  const rampStartT = inflectT - rampDur;
  const decayStartT = halfPeak;
  const decayStartVal = expFunc(0, p.expAmp, p.expLambda, p.expConst);

  if (t <= rampStartT) return p.expConst;
  if (t <= inflectT) {
    const frac = (t - rampStartT) / rampDur;
    return p.expConst + (p.inflectionAmp - p.expConst) * frac;
  }
  if (t <= 0) {
    const frac = (t - inflectT) / halfPeak;
    return p.inflectionAmp + (p.peakAmp - p.inflectionAmp) * 0.5 * (1 - Math.cos(Math.PI * frac));
  }
  if (t <= decayStartT) {
    const frac = t / halfPeak;
    return p.peakAmp + (decayStartVal - p.peakAmp) * 0.5 * (1 - Math.cos(Math.PI * frac));
  }
  return expFunc(t - decayStartT, p.expAmp, p.expLambda, p.expConst);
}

// --------------------------------------------------------------------- ghost

interface Ghost {
  id: string;
  label: string;
  window: Float64Array;
  fs: number;
  peakIdx: number;
  rampExpFit: RampExpParams | null;
}

function buildGhosts(data: NonNullable<ReturnType<typeof useSpikesData>["data"]>): Ghost[] {
  const out: Ghost[] = [];
  for (const sweep of data.sweeps.sweeps) {
    try {
      const sig = decodeI16(sweep.mv_q);
      const fit = fitSweep(sig, sweep.fs, PROJECT_FIT);
      const first = fit.spikes.find((s) => s.features);
      if (!first || !first.features) continue;
      const f = first.features;
      out.push({
        id: sweep.id,
        label: sweep.id,
        window: first.window,
        fs: sweep.fs,
        peakIdx: f.indices.peak,
        rampExpFit: {
          rampAmp: f.ramp.rampAmp,
          inflectionAmp: f.ramp.inflectionAmp,
          peakAmp: f.peak.peakAmp,
          peakWidth: f.peak.peakWidth,
          expAmp: f.exp.expAmp,
          expLambda: f.exp.expLambda,
          expConst: f.exp.expConst,
        },
      });
    } catch {
      // sweep failed to fit — skip it as a ghost option
    }
  }

  try {
    const n = Math.min(200, data.waveforms.windows.length);
    const arrs: Float64Array[] = [];
    for (let i = 0; i < n; i++) arrs.push(decodeI16(data.waveforms.windows[i], data.waveforms.scale));
    const len = arrs[0]?.length ?? 0;
    const mean = new Float64Array(len);
    for (const a of arrs) for (let i = 0; i < len; i++) mean[i] += a[i] / arrs.length;
    let peakIdx = 0;
    for (let i = 1; i < len; i++) if (mean[i] > mean[peakIdx]) peakIdx = i;
    const fsEff = (data.sweeps.sweeps[0]?.fs ?? 50000) / data.waveforms.decim;
    let rampExpFit: RampExpParams | null = null;
    try {
      const feats = computeFeatures(mean, fsEff, { peakInd: peakIdx, smoothFrac: PROJECT_FIT.smoothFrac });
      rampExpFit = {
        rampAmp: feats.ramp.rampAmp,
        inflectionAmp: feats.ramp.inflectionAmp,
        peakAmp: feats.peak.peakAmp,
        peakWidth: feats.peak.peakWidth,
        expAmp: feats.exp.expAmp,
        expLambda: feats.exp.expLambda,
        expConst: feats.exp.expConst,
      };
    } catch {
      // dataset mean didn't fit cleanly — ghost still usable, just no snap target
    }
    if (len > 0) out.push({ id: "mean", label: "dataset mean", window: mean, fs: fsEff, peakIdx, rampExpFit });
  } catch {
    // waveforms unavailable — mean ghost just won't exist
  }

  return out;
}

/** Linear-interpolated sample of a ghost at `tMs` relative to its own peak. */
function sampleGhostAt(ghost: Ghost, tMs: number): number | null {
  const dtMs = 1000 / ghost.fs;
  const idx = ghost.peakIdx + tMs / dtMs;
  if (idx < 0 || idx > ghost.window.length - 1) return null;
  const lo = Math.floor(idx);
  const hi = Math.min(ghost.window.length - 1, lo + 1);
  const frac = idx - lo;
  return ghost.window[lo] * (1 - frac) + ghost.window[hi] * frac;
}

function computeR2(genArr: Float64Array, tGrid: Float64Array, ghost: Ghost | null): number | null {
  if (!ghost) return null;
  const gs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < tGrid.length; i++) {
    const gv = sampleGhostAt(ghost, tGrid[i]);
    if (gv === null) continue;
    gs.push(gv);
    ys.push(genArr[i]);
  }
  const n = gs.length;
  if (n < 3) return null;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += gs[i];
    mb += ys[i];
  }
  ma /= n;
  mb /= n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    const da = gs[i] - ma;
    const db = ys[i] - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  if (saa === 0 || sbb === 0) return null;
  const r = sab / Math.sqrt(saa * sbb);
  return r * r;
}

// --------------------------------------------------------------------- canvas

/** DPR-aware canvas that redraws through draw(ctx, w, h); redraws when `draw`
 * changes identity or the wrapper resizes. Callback refs so canvases that
 * mount only once data is ready still trigger the initial render. */
function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const [ready, setReady] = useState(false);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const wrapElRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const lastAppliedRef = useRef<{ w: number; h: number } | null>(null);

  const canvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasElRef.current = el;
    if (el) setReady(true);
  }, []);
  const wrapRef = useCallback((el: HTMLDivElement | null) => {
    wrapElRef.current = el;
    if (el) setReady(true);
  }, []);

  const render = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
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
    });
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

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// -------------------------------------------------------------------- panel

export default function SandboxPanel() {
  const { data, status } = useSpikesData();

  const ghosts = useMemo(() => (data ? buildGhosts(data) : []), [data]);
  const [ghostIdx, setGhostIdx] = useState(0);
  const ghost = ghosts[Math.min(ghostIdx, Math.max(0, ghosts.length - 1))] ?? null;

  const [mode, setMode] = useState<Mode>("rampExp");
  const [rp, setRp] = useState<RampExpParams>(RAMP_EXP_DEFAULT);
  const [skg, setSkg] = useState<SkgParams>(SKG_DEFAULT);

  const [trainSource, setTrainSource] = useState<"generated" | "ghost">("generated");
  const [isi, setIsi] = useState(180);
  const [tau, setTau] = useState(60);

  const snapRaf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(snapRaf.current), []);

  const animateParams = useCallback(<T extends object>(from: T, to: T, setter: (v: T) => void) => {
    cancelAnimationFrame(snapRaf.current);
    const start = performance.now();
    const durationMs = 400;
    const keys = Object.keys(to) as (keyof T)[];
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const e = easeInOutCubic(t);
      const next = { ...from };
      for (const k of keys) {
        const a = from[k] as unknown as number;
        const b = to[k] as unknown as number;
        next[k] = (a + (b - a) * e) as unknown as T[typeof k];
      }
      setter(next);
      if (t < 1) snapRaf.current = requestAnimationFrame(tick);
    };
    snapRaf.current = requestAnimationFrame(tick);
  }, []);

  const handleSnap = () => {
    if (mode === "rampExp") {
      if (!ghost?.rampExpFit) return;
      animateParams(rp, ghost.rampExpFit, setRp);
    } else {
      animateParams(skg, SKG_DEFAULT, setSkg);
    }
  };

  const tGrid = useMemo(() => {
    const arr = new Float64Array(N_DISPLAY);
    for (let i = 0; i < N_DISPLAY; i++) arr[i] = -T_HALF_MS + i * ((2 * T_HALF_MS) / (N_DISPLAY - 1));
    return arr;
  }, []);

  const skgComponents = useMemo(() => (mode === "skg" ? simGaussianSpike(N_DISPLAY, skg) : null), [mode, skg]);

  const genArr = useMemo(() => {
    if (mode === "rampExp") {
      const out = new Float64Array(tGrid.length);
      for (let i = 0; i < tGrid.length; i++) out[i] = rampExpValue(rp, tGrid[i]);
      return out;
    }
    return skgComponents!.total;
  }, [mode, rp, skgComponents, tGrid]);

  const r2 = useMemo(() => computeR2(genArr, tGrid, ghost), [genArr, tGrid, ghost]);

  const isAtSkgDefault = useMemo(
    () => SKG_SLIDERS.every((s) => Math.abs(skg[s.key] - SKG_DEFAULT[s.key]) < 1e-6),
    [skg],
  );

  // ---- mini ISI train
  const trainSpike = trainSource === "generated" ? genArr : ghost?.window ?? null;
  const trainSignal = useMemo(() => {
    if (!trainSpike || trainSpike.length === 0) return null;
    const reps = 4;
    const spikes = Array.from({ length: reps }, () => trainSpike);
    const isiArr = Array.from({ length: reps - 1 }, () => isi);
    try {
      return simPatch(spikes, isiArr, tau);
    } catch {
      return null;
    }
  }, [trainSpike, isi, tau]);

  // ---- drawing
  const drawMain = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#fffdf6";
      ctx.fillRect(0, 0, w, h);
      if (!ghost) return;

      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < genArr.length; i++) {
        if (genArr[i] < lo) lo = genArr[i];
        if (genArr[i] > hi) hi = genArr[i];
      }
      for (let i = 0; i < ghost.window.length; i++) {
        const v = ghost.window[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const pad = (hi - lo) * 0.12 || 1;
      lo -= pad;
      hi += pad;

      const marginL = 42;
      const marginR = 10;
      const marginT = 12;
      const marginB = 22;
      const pw = w - marginL - marginR;
      const ph = h - marginT - marginB;
      const xOf = (t: number) => marginL + ((t + T_HALF_MS) / (2 * T_HALF_MS)) * pw;
      const yOf = (v: number) => marginT + (1 - (v - lo) / (hi - lo)) * ph;

      ctx.strokeStyle = "#e7dcbb";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#8a7a4e";
      ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const t of [-5, -2.5, 0, 2.5, 5]) {
        const x = Math.round(xOf(t)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, marginT);
        ctx.lineTo(x, marginT + ph);
        ctx.stroke();
        ctx.fillText(`${t}ms`, x, marginT + ph + 4);
      }
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const yTicks = 4;
      for (let k = 0; k <= yTicks; k++) {
        const v = lo + ((hi - lo) * k) / yTicks;
        const y = Math.round(yOf(v)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(marginL, y);
        ctx.lineTo(marginL + pw, y);
        ctx.stroke();
        ctx.fillText(v.toFixed(0), marginL - 4, y);
      }

      // ghost — grey, semi-transparent, real data
      ctx.strokeStyle = GHOST_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      const dtMs = 1000 / ghost.fs;
      for (let i = 0; i < ghost.window.length; i++) {
        const t = (i - ghost.peakIdx) * dtMs;
        if (t < -T_HALF_MS - 0.001 || t > T_HALF_MS + 0.001) continue;
        const x = xOf(t);
        const y = yOf(ghost.window[i]);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // skg dashed components
      if (mode === "skg" && skgComponents) {
        const drawDashed = (arr: Float64Array, color: string) => {
          ctx.save();
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          for (let i = 0; i < arr.length; i++) {
            const x = xOf(tGrid[i]);
            const y = yOf(arr[i]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.restore();
        };
        drawDashed(skgComponents.a, COMP_A_COLOR);
        drawDashed(skgComponents.b, COMP_B_COLOR);
      }

      // generated — accent, "generated from parameters"
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i < genArr.length; i++) {
        const x = xOf(tGrid[i]);
        const y = yOf(genArr[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },
    [ghost, genArr, tGrid, mode, skgComponents],
  );

  const drawTrain = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#fffdf6";
      ctx.fillRect(0, 0, w, h);
      if (!trainSignal || trainSignal.length === 0) return;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < trainSignal.length; i++) {
        const v = trainSignal[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const pad = (hi - lo) * 0.08 || 1;
      lo -= pad;
      hi += pad;
      const marginL = 6;
      const marginR = 6;
      const marginT = 8;
      const marginB = 8;
      const pw = w - marginL - marginR;
      const ph = h - marginT - marginB;
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const n = trainSignal.length;
      for (let i = 0; i < n; i++) {
        const x = marginL + (i / (n - 1)) * pw;
        const y = marginT + (1 - (trainSignal[i] - lo) / (hi - lo)) * ph;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },
    [trainSignal],
  );

  const { canvasRef: mainCanvasRef, wrapRef: mainWrapRef } = useCanvas(drawMain);
  const { canvasRef: trainCanvasRef, wrapRef: trainWrapRef } = useCanvas(drawTrain);

  if (status !== "ready" || !data) {
    return <div className="skLoading">Sandbox panel — loading fitted spikes ({status}).</div>;
  }

  return (
    <div className="skSandWrap">
      <div className="skRow">
        <button type="button" className="skBtn" data-active={mode === "rampExp"} onClick={() => setMode("rampExp")}>
          ramp + exponential
        </button>
        <button type="button" className="skBtn" data-active={mode === "skg"} onClick={() => setMode("skg")}>
          two skewed Gaussians
        </button>
        <span className="skChip">
          {mode === "rampExp" ? "mirrors gen_fit_ramp + gen_fit_exp" : "mirrors skg.fit.sim_gaussian_spike"}
        </span>
      </div>

      <div className="skSandSection">
        <div className="skRow skSandGhostRow">
          <span className="skLabel">ghost</span>
          {ghosts.map((g, i) => (
            <button
              key={g.id}
              type="button"
              className="skBtn skSandGhostBtn"
              data-active={i === ghostIdx}
              onClick={() => setGhostIdx(i)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="skCanvasWrap skSandMainCanvas" ref={mainWrapRef}>
          <canvas
            ref={mainCanvasRef}
            role="img"
            aria-label="Generated spike waveform over a ghosted real spike, with a live r-squared readout"
          />
        </div>

        <div className="skSandLegend">
          <span>
            <span className="skSandSwatch" style={{ background: ACCENT }} /> generated from parameters
          </span>
          <span>
            <span className="skSandSwatch" style={{ background: "#5a5038" }} /> real spike (ghost)
          </span>
          {mode === "skg" && (
            <>
              <span>
                <span className="skSandSwatch" style={{ background: COMP_A_COLOR }} /> component A (dashed)
              </span>
              <span>
                <span className="skSandSwatch" style={{ background: COMP_B_COLOR }} /> component B (dashed)
              </span>
            </>
          )}
        </div>

        <div className="skRow skSandStatsRow">
          <span className="skSandR2 skMono">
            r² vs ghost: <b>{r2 !== null ? r2.toFixed(4) : "—"}</b>
          </span>
          <button
            type="button"
            className="skBtn"
            onClick={handleSnap}
            disabled={mode === "rampExp" && !ghost?.rampExpFit}
          >
            Snap to fit
          </button>
          {mode === "skg" && isAtSkgDefault && (
            <span className="skBadge">fit r² = {SKG_DEFAULT_R2.toFixed(4)} (vs dataset mean, at build)</span>
          )}
        </div>

        {mode === "rampExp" ? (
          <>
            <div className="skSandSliderGrid">
              {RAMP_EXP_SLIDERS.map((s) => (
                <label key={s.key} className="skSandSlider">
                  <span className="skSandSliderHead">
                    <span>{s.label}</span>
                    <span className="skMono">
                      {rp[s.key].toFixed(2)}
                      {s.unit ? ` ${s.unit}` : ""}
                    </span>
                  </span>
                  <input
                    className="skSlider"
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={rp[s.key]}
                    onChange={(e) => {
                      cancelAnimationFrame(snapRaf.current);
                      const v = Number(e.target.value);
                      setRp((prev) => ({ ...prev, [s.key]: v }));
                    }}
                  />
                </label>
              ))}
            </div>
            <p className="skNote">
              The peak between the ramp and the decay is drawn as a cosine bridge from inflection_amp through
              peak_amp back down to the decay&rsquo;s starting value — illustrative bridge, not part of the model;
              spikeparam fits the peak&rsquo;s amplitude and width, never its shape.
            </p>
          </>
        ) : (
          <div className="skSandSliderGrid">
            {SKG_SLIDERS.map((s) => (
              <label key={s.key} className="skSandSlider">
                <span className="skSandSliderHead">
                  <span>{s.label}</span>
                  <span className="skMono">{skg[s.key].toFixed(3)}</span>
                </span>
                <input
                  className="skSlider"
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={skg[s.key]}
                  onChange={(e) => {
                    cancelAnimationFrame(snapRaf.current);
                    const v = Number(e.target.value);
                    setSkg((prev) => ({ ...prev, [s.key]: v }));
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="skSandSection">
        <div className="skRow">
          <span className="skLabel">mini ISI train</span>
          <span className="skChip">mirrors spikeparam.patch.sim.sim_patch</span>
        </div>
        <div className="skRow skSandTrainControls">
          <button
            type="button"
            className="skBtn"
            data-active={trainSource === "generated"}
            onClick={() => setTrainSource("generated")}
          >
            generated
          </button>
          <button
            type="button"
            className="skBtn"
            data-active={trainSource === "ghost"}
            onClick={() => setTrainSource("ghost")}
          >
            ghost
          </button>
          <label className="skSandSlider">
            <span className="skSandSliderHead">
              <span>ISI</span>
              <span className="skMono">{isi} samples</span>
            </span>
            <input
              className="skSlider"
              type="range"
              min={20}
              max={500}
              step={1}
              value={isi}
              onChange={(e) => setIsi(Number(e.target.value))}
            />
          </label>
          <label className="skSandSlider">
            <span className="skSandSliderHead">
              <span>tau</span>
              <span className="skMono">{tau}</span>
            </span>
            <input
              className="skSlider"
              type="range"
              min={10}
              max={200}
              step={1}
              value={tau}
              onChange={(e) => setTau(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="skCanvasWrap skSandTrainCanvas" ref={trainWrapRef}>
          <canvas ref={trainCanvasRef} role="img" aria-label="Mini spike train stitched by sim_patch from the current waveform" />
        </div>
      </div>
    </div>
  );
}
