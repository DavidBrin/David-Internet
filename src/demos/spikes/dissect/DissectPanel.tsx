"use client";

/**
 * "The spike, dissected" — a real marmoset patch-clamp sweep (DANDI:001776)
 * with a scrub cursor; each detected spike snaps out into a big axis where
 * the spikeparam fit animates in the exact order the code computes it
 * (ramp -> inflection -> peak -> exponential decay), plus an optional
 * skewed-Gaussian model overlay and an "Auto" sequence that sweeps through
 * every spike, filling a feature table row by row (gen_df_features).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpikesData } from "../store";
import { decodeI16 } from "../core/data";
import { fitSweep, PROJECT_FIT, type FittedSpike, type SweepFit } from "../core/spike";
import { expFunc } from "../core/features";
import { simGaussianSpike, skgFromArray } from "../core/skg";
import "./dissect.css";

// ------------------------------------------------------------------ constants

/**
 * Skewed-Gaussian model params, fitted (at build time, offline) to the
 * *dataset mean spike* via spikeparam.skg.fit.sim_gaussian_spike — see
 * tests/fixtures/spikes-skg.json ("params", n=251, r2=0.9997). Inlined here
 * rather than fetched because it's a fixed, tiny, documented constant.
 * [a_ctr, a_std, a_alpha, a_scale, b_ctr, b_std, b_alpha, b_scale, scale, offset]
 */
const SKG_PARAMS = [
  0.473296, 0.059848, 1.495835, 1.08785, 0.613775, 0.688677, -3.487555, 0.217375, 52.458786, -53.272628,
] as const;
const SKG_R2 = 0.9997;
/** The window length (samples) the params above were fit against — the shape
 * itself is resolution-independent (fractional units), so it's re-sampled at
 * whatever length the caller asks for. */
const SKG_FIT_N = 251;

type StageN = 1 | 2 | 3 | 4;
const STAGE_MS = 700;
const AUTO_PAUSE_MS = 250;
const SELECT_TOL_MS = 12; // how close (ms) the scrub cursor must get to a peak to snap-select it

const STAGE_DEFS: { n: StageN; label: string; fn: string }[] = [
  { n: 1, label: "1. Ramp", fn: "spikeparam.patch.features.intra.compute_ramp_features" },
  { n: 2, label: "2. Inflection", fn: "spikeparam.patch.points.inflection" },
  { n: 3, label: "3. Peak", fn: "spikeparam.patch.features.intra.compute_peak_features" },
  { n: 4, label: "4. Decay", fn: "spikeparam.patch.features.intra.fit_exp_nonlinear" },
];

const RAMP_COLOR = "#f59e0b";
const INFL_COLOR = "#dc2626";
const PEAK_COLOR = "#0891b2";
const EXP_COLOR = "#7c3aed";
const TRACE_COLOR = "#4a3f20";
const GAUSS_A_COLOR = "#0891b2";
const GAUSS_B_COLOR = "#dc2626";
const GAUSS_SUM_COLOR = "#4a3f20";

// ------------------------------------------------------------------ canvas hook
// Same DPR-aware, resize-safe pattern used by the other sk* panels: callback
// refs so the effect notices the canvas attach, and a <2px-jitter guard on
// the wrap's measured size so a ResizeObserver can never feed a resize into
// itself. Draws are one-shot (triggered by prop/state changes), not a
// self-perpetuating rAF loop.

function useFitCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
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

  const renderOnce = useCallback(() => {
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
    renderOnce();
  }, [renderOnce, draw, ready]);

  useEffect(() => {
    const wrap = wrapElRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => renderOnce());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [renderOnce, ready]);

  return { canvasRef, wrapRef };
}

// ------------------------------------------------------------------ small helpers

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function fmt(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

/** min/max per pixel column, cached until the signal or width changes. */
interface ColCache {
  sig: Float64Array;
  w: number;
  mins: Float64Array;
  maxs: Float64Array;
}

function buildColumns(sig: Float64Array, w: number): ColCache {
  const n = sig.length;
  const mins = new Float64Array(w);
  const maxs = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    const lo = Math.floor((x / w) * n);
    const hi = Math.max(lo + 1, Math.floor(((x + 1) / w) * n));
    let mn = sig[lo];
    let mx = sig[lo];
    for (let i = lo + 1; i < hi && i < n; i++) {
      const v = sig[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    mins[x] = mn;
    maxs[x] = mx;
  }
  return { sig, w, mins, maxs };
}

// ------------------------------------------------------------------ component

export default function DissectPanel() {
  const { data, status } = useSpikesData();
  const sweeps = data?.sweeps.sweeps ?? [];

  const [sweepIdx, setSweepIdx] = useState(0);
  const [cursorSample, setCursorSample] = useState(0);
  const [selectedSpikeIdx, setSelectedSpikeIdx] = useState(0);
  const [stage, setStage] = useState<StageN>(1);
  const [animT, setAnimT] = useState(0);
  const [autoMode, setAutoMode] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [skgOn, setSkgOn] = useState(false);

  const sweep = sweeps[sweepIdx];

  // ---- decode + fit (once per sweep; ~50-200ms, fine in a memo) ----
  const sig = useMemo(() => (sweep ? decodeI16(sweep.mv_q) : null), [sweep]);
  const fit: SweepFit | null = useMemo(
    () => (sig && sweep ? fitSweep(sig, sweep.fs, PROJECT_FIT) : null),
    [sig, sweep],
  );

  const sigRange = useMemo(() => {
    if (!sig) return { min: -80, max: 40 };
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = 0; i < sig.length; i++) {
      if (sig[i] < mn) mn = sig[i];
      if (sig[i] > mx) mx = sig[i];
    }
    const pad = (mx - mn) * 0.08 || 5;
    return { min: mn - pad, max: mx + pad };
  }, [sig]);

  // ---- refs mirroring state for use inside the rAF chain / event handlers ----
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const selectedRef = useRef(selectedSpikeIdx);
  selectedRef.current = selectedSpikeIdx;
  const autoModeRef = useRef(autoMode);
  autoModeRef.current = autoMode;
  const runIdRef = useRef(0);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colCacheRef = useRef<ColCache | null>(null);

  const clearPending = useCallback(() => {
    runIdRef.current += 1;
    if (pauseTimerRef.current != null) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  // ---- stage animation chain ----
  const playStage = useCallback((spikeIdx: number, stageN: StageN, run: number) => {
    const start = performance.now();
    const tick = (now: number) => {
      if (runIdRef.current !== run) return;
      const t = clamp01((now - start) / STAGE_MS);
      setAnimT(t);
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      if (stageN < 4) {
        const next = (stageN + 1) as StageN;
        setStage(next);
        playStage(spikeIdx, next, run);
        return;
      }
      // stage 4 complete: reveal this spike's table row
      setRevealed((prev) => {
        if (prev.has(spikeIdx)) return prev;
        const n = new Set(prev);
        n.add(spikeIdx);
        return n;
      });
      if (autoModeRef.current) {
        const spikes = fitRef.current?.spikes ?? [];
        if (spikeIdx + 1 < spikes.length) {
          pauseTimerRef.current = setTimeout(() => {
            if (runIdRef.current !== run) return;
            beginSequence(spikeIdx + 1, run);
          }, AUTO_PAUSE_MS);
        } else {
          setAutoMode(false);
        }
      }
    };
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginSequence = useCallback(
    (idx: number, run: number) => {
      setSelectedSpikeIdx(idx);
      const spike = fitRef.current?.spikes[idx];
      if (!spike || !spike.features) {
        // nothing to animate — mark it revealed (so the table can show "fit failed")
        // and, if we're auto-playing, keep moving.
        setStage(1);
        setAnimT(1);
        setRevealed((prev) => {
          const n = new Set(prev);
          n.add(idx);
          return n;
        });
        if (autoModeRef.current) {
          const spikes = fitRef.current?.spikes ?? [];
          if (idx + 1 < spikes.length) {
            pauseTimerRef.current = setTimeout(() => {
              if (runIdRef.current !== run) return;
              beginSequence(idx + 1, run);
            }, AUTO_PAUSE_MS);
          } else {
            setAutoMode(false);
          }
        }
        return;
      }
      setStage(1);
      setAnimT(0);
      playStage(idx, 1, run);
    },
    [playStage],
  );

  /** User-initiated selection (scrub / tick / Next spike / table row): always interrupts. */
  const selectSpike = useCallback(
    (idx: number, keepAuto = false) => {
      const spikes = fitRef.current?.spikes ?? [];
      if (idx < 0 || idx >= spikes.length) return;
      if (idx === selectedRef.current && !keepAuto) return;
      clearPending();
      if (!keepAuto) setAutoMode(false);
      const run = runIdRef.current;
      beginSequence(idx, run);
    },
    [beginSequence, clearPending],
  );

  const jumpToStage = useCallback(
    (n: StageN) => {
      const spike = fitRef.current?.spikes[selectedRef.current];
      if (!spike || !spike.features) return;
      clearPending();
      setAutoMode(false);
      setStage(n);
      setAnimT(1);
    },
    [clearPending],
  );

  const toggleAuto = useCallback(() => {
    if (autoModeRef.current) {
      clearPending();
      setAutoMode(false);
      return;
    }
    clearPending();
    setAutoMode(true);
    setRevealed(new Set());
    const run = runIdRef.current;
    beginSequence(0, run);
  }, [beginSequence, clearPending]);

  const nextSpike = useCallback(() => {
    const spikes = fitRef.current?.spikes ?? [];
    if (spikes.length === 0) return;
    const idx = (selectedRef.current + 1) % spikes.length;
    selectSpike(idx);
  }, [selectSpike]);

  // ---- reset on sweep change ----
  useEffect(() => {
    clearPending();
    setAutoMode(false);
    setRevealed(new Set());
    setCursorSample(0);
    setSelectedSpikeIdx(0);
    setStage(1);
    setAnimT(0);
    colCacheRef.current = null;
    if (fit && fit.spikes.length > 0) {
      const run = runIdRef.current;
      // autoplay the intro sequence for spike 0 on load / sweep switch
      beginSequence(0, run);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweepIdx, sig]);

  useEffect(() => clearPending, [clearPending]);

  // ---- sweep strip pointer handling ----
  const draggingRef = useRef(false);

  const handleSweepPointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const s = fitRef.current;
      if (!sig || !s) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const w = rect.width || 1;
      const sample = Math.round(clamp01(x / w) * (sig.length - 1));
      setCursorSample(sample);
      if (s.spikes.length === 0) return;
      let nearest = 0;
      let bestD = Infinity;
      for (let i = 0; i < s.spikes.length; i++) {
        const d = Math.abs(s.spikes[i].peakInd - sample);
        if (d < bestD) {
          bestD = d;
          nearest = i;
        }
      }
      const tolSamples = (SELECT_TOL_MS / 1000) * s.fs;
      if (bestD <= tolSamples && nearest !== selectedRef.current) {
        selectSpike(nearest);
      }
    },
    [sig, selectSpike],
  );

  const onSweepPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    handleSweepPointer(e);
  };
  const onSweepPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingRef.current) handleSweepPointer(e);
  };
  const onSweepPointerUp = () => {
    draggingRef.current = false;
  };

  // ---- table auto-follow (container scrollTop only — never scrollIntoView) ----
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    const wrap = tableWrapRef.current;
    const row = activeRowRef.current;
    if (!wrap || !row) return;
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    if (rowTop < wrap.scrollTop) {
      wrap.scrollTop = rowTop;
    } else if (rowBottom > wrap.scrollTop + wrap.clientHeight) {
      wrap.scrollTop = rowBottom - wrap.clientHeight;
    }
  }, [selectedSpikeIdx]);

  // ------------------------------------------------------------------ sweep strip draw

  const drawSweep = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fffdf6";
      ctx.fillRect(0, 0, w, h);
      if (!sig || !fit) return;
      const n = sig.length;

      let cache = colCacheRef.current;
      if (!cache || cache.sig !== sig || Math.abs(cache.w - w) > 1) {
        cache = buildColumns(sig, Math.max(1, Math.round(w)));
        colCacheRef.current = cache;
      }

      const stimTrackH = sweep?.stim_pA ? 28 : 0;
      const traceH = h - stimTrackH - 6;
      const { min, max } = sigRange;
      const yOf = (v: number) => 4 + traceH - ((v - min) / (max - min)) * traceH;

      // voltage trace (min/max per column)
      ctx.strokeStyle = TRACE_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < cache.w; x++) {
        const y0 = yOf(cache.mins[x]);
        const y1 = yOf(cache.maxs[x]);
        ctx.moveTo(x + 0.5, y0);
        ctx.lineTo(x + 0.5, Math.max(y1, y0 + 0.6));
      }
      ctx.stroke();

      // stimulus trace (decimated x50), faint step under the voltage
      if (sweep?.stim_pA && sweep.stim_pA.length > 1) {
        const stim = sweep.stim_pA;
        let smin = Infinity;
        let smax = -Infinity;
        for (const v of stim) {
          if (v < smin) smin = v;
          if (v > smax) smax = v;
        }
        const srange = smax - smin || 1;
        const baseY = h - 2;
        const topY = h - stimTrackH + 4;
        ctx.strokeStyle = "rgba(245,158,11,0.55)";
        ctx.fillStyle = "rgba(245,158,11,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        for (let i = 0; i < stim.length; i++) {
          const x = (i / (stim.length - 1)) * w;
          const y = baseY - ((stim[i] - smin) / srange) * (baseY - topY);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, baseY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // spike ticks
      for (let i = 0; i < fit.spikes.length; i++) {
        const spk = fit.spikes[i];
        const x = (spk.peakInd / n) * w;
        const isSel = i === selectedSpikeIdx;
        ctx.strokeStyle = isSel ? RAMP_COLOR : "#b8a877";
        ctx.lineWidth = isSel ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, 2);
        ctx.lineTo(x, isSel ? 12 : 8);
        ctx.stroke();
        if (isSel) {
          ctx.fillStyle = RAMP_COLOR;
          ctx.beginPath();
          ctx.arc(x, 14, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // scrub cursor
      const cx = (cursorSample / n) * w;
      ctx.strokeStyle = "rgba(74,63,32,0.65)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, 0);
      ctx.lineTo(cx + 0.5, h);
      ctx.stroke();
    },
    [sig, fit, sweep, sigRange, selectedSpikeIdx, cursorSample],
  );

  const { canvasRef: sweepCanvasRef, wrapRef: sweepWrapRef } = useFitCanvas(drawSweep);

  // ------------------------------------------------------------------ big axis draw

  const selectedSpike: FittedSpike | undefined = fit?.spikes[selectedSpikeIdx];

  const drawBig = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fffdf6";
      ctx.fillRect(0, 0, w, h);
      const spk = selectedSpike;
      if (!spk || !sweep) return;
      const win = spk.window;
      const N = win.length;
      const peakIdxW = Math.floor((N - 1) / 2);
      const spMs = sweep.fs / 1000;
      const tMs = (i: number) => (i - peakIdxW) / spMs;
      const tMin = tMs(0);
      const tMax = tMs(N - 1);

      const padL = 8;
      const padR = 8;
      const padT = 14;
      const padB = 22;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const xOf = (t: number) => padL + ((t - tMin) / (tMax - tMin)) * plotW;
      const xOfIdx = (i: number) => xOf(tMs(i));

      let wmin = Infinity;
      let wmax = -Infinity;
      for (let i = 0; i < N; i++) {
        if (win[i] < wmin) wmin = win[i];
        if (win[i] > wmax) wmax = win[i];
      }
      const wpad = (wmax - wmin) * 0.12 || 2;
      wmin -= wpad;
      wmax += wpad;
      const yOf = (v: number) => padT + plotH - ((v - wmin) / (wmax - wmin)) * plotH;

      // axes: ms ticks + zero line at the peak
      ctx.strokeStyle = "#e7dcbb";
      ctx.lineWidth = 1;
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillStyle = "#8a7a4e";
      for (let t = Math.ceil(tMin); t <= Math.floor(tMax); t += 2) {
        const x = xOf(t);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        ctx.fillText(`${t}ms`, x + 2, h - 8);
      }
      ctx.strokeStyle = "#d9c89a";
      ctx.beginPath();
      ctx.moveTo(xOfIdx(peakIdxW), padT);
      ctx.lineTo(xOfIdx(peakIdxW), padT + plotH);
      ctx.stroke();

      const feat = spk.features;

      // stage 1: ramp region shading + growing fit line
      if (feat && stage >= 1) {
        const { rampStart, inflection } = feat.indices;
        const prog = stage === 1 ? animT : 1;
        ctx.fillStyle = "rgba(245,158,11,0.12)";
        ctx.fillRect(xOfIdx(rampStart), padT, xOfIdx(inflection) - xOfIdx(rampStart), plotH);

        const [slope, intercept] = feat.ramp.polyParams;
        const grown = rampStart + Math.max(1, Math.round((inflection - rampStart) * prog));
        ctx.strokeStyle = RAMP_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = rampStart; i < grown; i++) {
          const tRel = ((i - rampStart) * 1000) / sweep.fs;
          const v = slope * tRel + intercept;
          const x = xOfIdx(i);
          const y = yOf(v);
          if (i === rampStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // stage 2: inflection marker
      if (feat && stage >= 2) {
        const prog = stage === 2 ? animT : 1;
        const { inflection } = feat.indices;
        const x = xOfIdx(inflection);
        const y = yOf(win[inflection]);
        ctx.save();
        ctx.globalAlpha = prog;
        ctx.fillStyle = INFL_COLOR;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // stage 3: calipers (rise <- peak -> decay) + curvature arc
      if (feat && stage >= 3) {
        const prog = stage === 3 ? animT : 1;
        const { rise, peak, decay } = feat.indices;
        const px = xOfIdx(peak);
        const rx = px - (px - xOfIdx(rise)) * prog;
        const dx = px + (xOfIdx(decay) - px) * prog;
        const midY = yOf((win[rise] + win[decay]) / 2);
        ctx.strokeStyle = PEAK_COLOR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx, padT + 4);
        ctx.lineTo(rx, padT + plotH - 4);
        ctx.moveTo(dx, padT + 4);
        ctx.lineTo(dx, padT + plotH - 4);
        ctx.stroke();
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(rx, midY);
        ctx.lineTo(dx, midY);
        ctx.stroke();
        ctx.restore();

        // small curvature arc at the peak, for peak_sharpness
        ctx.save();
        ctx.globalAlpha = prog;
        ctx.strokeStyle = PEAK_COLOR;
        ctx.lineWidth = 1.5;
        const py = yOf(win[peak]);
        const r = 12;
        const bend = Math.max(-1, Math.min(1, feat.peak.peakSharpness / 20));
        ctx.beginPath();
        ctx.arc(px, py - r + bend * 4, r, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        ctx.restore();
      }

      // stage 4: exponential decay fit
      if (feat && stage >= 4) {
        const prog = animT; // stage stays 4 once complete; prog settles at 1
        const { expStart, expEnd } = feat.indices;
        const { expAmp, expLambda, expConst } = feat.exp;
        const grown = expStart + Math.max(1, Math.round((expEnd - expStart) * prog));
        ctx.strokeStyle = EXP_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = expStart; i < grown; i++) {
          const tRel = ((i - expStart) * 1000) / sweep.fs;
          const v = expFunc(tRel, expAmp, expLambda, expConst);
          const x = xOfIdx(i);
          const y = yOf(v);
          if (i === expStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // base spike trace, always on top so overlays read as annotations on it
      ctx.strokeStyle = TRACE_COLOR;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = xOfIdx(i);
        const y = yOf(win[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // skewed-gaussian model inset (stage 5 toggle) — dataset mean spike, not this spike;
      // drawn in its own self-scaled inset since the vertical scale won't generally match
      // this particular spike's amplitude (see comment near SKG_PARAMS).
      if (skgOn) {
        const insetW = Math.min(190, plotW * 0.42);
        const insetH = Math.min(110, plotH * 0.42);
        const insetX = w - padR - insetW - 4;
        const insetY = padT + 4;
        const { total, a, b } = simGaussianSpike(SKG_FIT_N, skgFromArray(SKG_PARAMS));
        let gmin = Infinity;
        let gmax = -Infinity;
        for (let i = 0; i < SKG_FIT_N; i++) {
          gmin = Math.min(gmin, a[i], b[i], total[i]);
          gmax = Math.max(gmax, a[i], b[i], total[i]);
        }
        const gpad = (gmax - gmin) * 0.08 || 1;
        gmin -= gpad;
        gmax += gpad;
        const gx = (i: number) => insetX + (i / (SKG_FIT_N - 1)) * insetW;
        const gy = (v: number) => insetY + insetH - ((v - gmin) / (gmax - gmin)) * insetH;

        ctx.save();
        ctx.fillStyle = "rgba(255,253,246,0.92)";
        ctx.strokeStyle = "#e7dcbb";
        ctx.lineWidth = 1;
        ctx.fillRect(insetX - 4, insetY - 4, insetW + 8, insetH + 20);
        ctx.strokeRect(insetX - 4, insetY - 4, insetW + 8, insetH + 20);

        const drawCurve = (arr: Float64Array, color: string, dashed: boolean, lw: number) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = lw;
          ctx.setLineDash(dashed ? [3, 3] : []);
          ctx.beginPath();
          for (let i = 0; i < SKG_FIT_N; i++) {
            const x = gx(i);
            const y = gy(arr[i]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        };
        drawCurve(a, GAUSS_A_COLOR, true, 1.2);
        drawCurve(b, GAUSS_B_COLOR, true, 1.2);
        drawCurve(total, GAUSS_SUM_COLOR, false, 1.8);

        ctx.font = "9px ui-monospace, monospace";
        ctx.fillStyle = "#6f6448";
        ctx.fillText(`skewed-Gaussian model of the dataset mean spike (r²=${SKG_R2})`, insetX - 2, insetY + insetH + 12);
        ctx.restore();
      }
    },
    [selectedSpike, sweep, stage, animT, skgOn],
  );

  const { canvasRef: bigCanvasRef, wrapRef: bigWrapRef } = useFitCanvas(drawBig);

  // ------------------------------------------------------------------ render

  if (status === "loading") {
    return <div className="skLoading">Loading the sweep data…</div>;
  }
  if (status === "error" || sweeps.length === 0) {
    return <div className="skNote">Could not load the spikes dataset for the dissect panel.</div>;
  }

  const feat = selectedSpike?.features ?? null;
  const cursorMs = sweep ? (cursorSample / sweep.fs) * 1000 : 0;
  const nSpikes = fit?.spikes.length ?? 0;

  return (
    <div className="skDis">
      <div className="skRow">
        <span className="skLabel">Sweep</span>
        {sweeps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className="skBtn"
            data-active={i === sweepIdx}
            onClick={() => setSweepIdx(i)}
          >
            {s.id} · {s.nSpikes} spikes
          </button>
        ))}
      </div>

      <div className="skCanvasWrap skDisSweepWrap" ref={sweepWrapRef}>
        <canvas
          ref={sweepCanvasRef}
          role="img"
          aria-label="Full sweep voltage trace with a scrub cursor and detected spike ticks"
          onPointerDown={onSweepPointerDown}
          onPointerMove={onSweepPointerMove}
          onPointerUp={onSweepPointerUp}
          onPointerCancel={onSweepPointerUp}
        />
      </div>
      <div className="skRow skDisSweepInfo">
        <span className="skMono">t = {cursorMs.toFixed(1)} ms</span>
        <span className="skNote">
          spike {nSpikes > 0 ? selectedSpikeIdx + 1 : 0} / {nSpikes}
        </span>
        <button type="button" className="skBtn" onClick={nextSpike} disabled={nSpikes === 0}>
          Next spike →
        </button>
        <button type="button" className="skBtn" data-active={autoMode} onClick={toggleAuto} disabled={nSpikes === 0}>
          {autoMode ? "Stop auto" : "Auto"}
        </button>
        {sweep?.stim_pA && <span className="skNote">amber trace below: stimulus current (pA, ×50 decimated)</span>}
      </div>

      <div className="skDisBigRow">
        <div className="skCanvasWrap skDisBigCanvasWrap" ref={bigWrapRef}>
          <canvas
            ref={bigCanvasRef}
            role="img"
            aria-label="Selected spike's ±5 ms window with the fit stages animating in"
          />
          {feat === null && selectedSpike && (
            <div className="skDisFail">fit failed for this spike (spikeparam raised on a degenerate control point)</div>
          )}
        </div>
        <div className="skDisReadouts">
          <div className={"skDisReadoutRow" + (stage < 1 ? " isPending" : "")}>
            <span className="skDisReadoutLabel">ramp_amp</span>
            <span className="skMono skDisReadoutVal">
              {feat ? fmt(feat.ramp.rampAmp * (stage === 1 ? animT : stage > 1 ? 1 : 0), 2) : "—"} mV/ms
            </span>
          </div>
          <div className={"skDisReadoutRow" + (stage < 2 ? " isPending" : "")}>
            <span className="skDisReadoutLabel">inflection_time</span>
            <span className="skMono skDisReadoutVal">{feat && stage >= 2 ? fmt(feat.ramp.inflectionTime, 2) : "—"} ms</span>
          </div>
          <div className={"skDisReadoutRow" + (stage < 2 ? " isPending" : "")}>
            <span className="skDisReadoutLabel">inflection_amp</span>
            <span className="skMono skDisReadoutVal">{feat && stage >= 2 ? fmt(feat.ramp.inflectionAmp, 2) : "—"} mV</span>
          </div>
          <div className={"skDisReadoutRow" + (stage < 3 ? " isPending" : "")}>
            <span className="skDisReadoutLabel">peak_amp</span>
            <span className="skMono skDisReadoutVal">{feat && stage >= 3 ? fmt(feat.peak.peakAmp, 2) : "—"} mV</span>
          </div>
          <div className={"skDisReadoutRow" + (stage < 3 ? " isPending" : "")}>
            <span className="skDisReadoutLabel">peak_width</span>
            <span className="skMono skDisReadoutVal">
              {feat ? fmt(feat.peak.peakWidth * (stage === 3 ? animT : stage > 3 ? 1 : 0), 2) : "—"} ms
            </span>
          </div>
          <div className={"skDisReadoutRow" + (stage < 3 ? " isPending" : "")}>
            <span className="skDisReadoutLabel">peak_sharpness</span>
            <span className="skMono skDisReadoutVal">{feat && stage >= 3 ? fmt(feat.peak.peakSharpness, 2) : "—"}</span>
          </div>
          <div className={"skDisReadoutRow" + (stage < 4 ? " isPending" : "")}>
            <span className="skDisReadoutLabel">exp_amp</span>
            <span className="skMono skDisReadoutVal">
              {feat ? fmt(feat.exp.expAmp * (stage === 4 ? animT : stage > 4 ? 1 : 0), 2) : "—"} mV
            </span>
          </div>
          <div className={"skDisReadoutRow" + (stage < 4 ? " isPending" : "")}>
            <span className="skDisReadoutLabel">exp_lambda</span>
            <span className="skMono skDisReadoutVal">
              {feat ? fmt(feat.exp.expLambda * (stage === 4 ? animT : stage > 4 ? 1 : 0), 3) : "—"} /ms
            </span>
          </div>
          <div className={"skDisReadoutRow" + (stage < 4 ? " isPending" : "")}>
            <span className="skDisReadoutLabel">exp_const</span>
            <span className="skMono skDisReadoutVal">
              {feat ? fmt(feat.exp.expConst * (stage === 4 ? animT : stage > 4 ? 1 : 0), 2) : "—"} mV
            </span>
          </div>
          <div className="skDisBadgeRow">
            {feat && stage === 4 && animT >= 1 && (
              <>
                <span className="skBadge">r²ramp {fmt(feat.r2Ramp, 3)}</span>
                <span className="skBadge">r²exp {fmt(feat.r2Exp, 3)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="skRow skDisStageStepper">
        {STAGE_DEFS.map((sd) => (
          <div className="skDisStageItem" key={sd.n}>
            <button
              type="button"
              className="skBtn"
              data-active={stage >= sd.n}
              disabled={!feat}
              onClick={() => jumpToStage(sd.n)}
            >
              {sd.label}
            </button>
            <span className="skChip">{sd.fn}</span>
          </div>
        ))}
        <div className="skDisStageItem">
          <button type="button" className="skBtn" data-active={skgOn} onClick={() => setSkgOn((v) => !v)}>
            5. Skewed-Gaussian model
          </button>
          <span className="skChip">spikeparam.skg.fit.sim_gaussian_spike</span>
        </div>
      </div>
      {skgOn && (
        <p className="skNote skDisSkgNote">
          The overlay above is two skewed Gaussians (dashed) summed (solid) — params fit once, offline, to the
          dataset&rsquo;s mean spike (r²={SKG_R2}), not to this individual spike, so it&rsquo;s drawn in its own
          self-scaled inset rather than rescaled onto this axis.
        </p>
      )}

      <div className="skDisTableWrap" ref={tableWrapRef}>
        <table className="skMono skDisTable">
          <thead>
            <tr>
              <th>#</th>
              <th>ramp_amp</th>
              <th>infl_t</th>
              <th>peak_amp</th>
              <th>width</th>
              <th>sharp</th>
              <th>λ</th>
              <th>r²ramp</th>
              <th>r²exp</th>
              <th>ISI</th>
            </tr>
          </thead>
          <tbody>
            {(fit?.spikes ?? []).map((s, i) => {
              const isActive = i === selectedSpikeIdx;
              const isRevealed = revealed.has(i);
              const rowFeat = s.features;
              const cls =
                "skDisRow" +
                (isActive ? " isActive" : "") +
                (!isRevealed ? " isPending" : "") +
                (isRevealed && !rowFeat ? " isFailed" : "");
              return (
                <tr key={i} className={cls} ref={isActive ? activeRowRef : undefined} onClick={() => selectSpike(i)}>
                  <td>{i + 1}</td>
                  {!isRevealed ? (
                    <td colSpan={9}>…</td>
                  ) : !rowFeat ? (
                    <td colSpan={9}>fit failed</td>
                  ) : (
                    <>
                      <td>{fmt(rowFeat.ramp.rampAmp, 2)}</td>
                      <td>{fmt(rowFeat.ramp.inflectionTime, 2)}</td>
                      <td>{fmt(rowFeat.peak.peakAmp, 2)}</td>
                      <td>{fmt(rowFeat.peak.peakWidth, 2)}</td>
                      <td>{fmt(rowFeat.peak.peakSharpness, 2)}</td>
                      <td>{fmt(rowFeat.exp.expLambda, 3)}</td>
                      <td>{fmt(rowFeat.r2Ramp, 3)}</td>
                      <td>{fmt(rowFeat.r2Exp, 3)}</td>
                      <td>{Number.isFinite(s.isi) ? fmt(s.isi, 1) : "—"}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="skNote">
        select a spike (scrub, click a tick, or a table row) to watch spikeparam&rsquo;s fit run stage by stage, or
        hit Auto to sweep the whole sweep and fill the table (gen_df_features).
      </p>
    </div>
  );
}
