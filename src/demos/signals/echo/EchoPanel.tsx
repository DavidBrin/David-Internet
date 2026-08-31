"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { autocorr } from "@/demos/signals/dsp/fft";
import { fetchJson, fetchBinSignal, type BinSignalHeader } from "@/demos/signals/dsp/assets";
import { playSamples, stopAudio } from "@/demos/signals/dsp/audio";
import {
  estimateEcho,
  inverseFilter,
  clampUnit,
  poleRadius,
  isStable,
  delayMs,
  alphaFromRatio,
  poleAngles,
  findPeak,
} from "./model";
import "./echo.css";

// ------------------------------------------------------------------ constants

const ASSET_BASE = "/demos/signals";
const MAX_LAG = 20000;
const N_MIN = 50;
const N_MAX = MAX_LAG;
const SNAP_WINDOW = 150;
const SNAP_PROMINENCE = 0.15; // R[lag]/R[0] must clear this to count as a "real" peak to snap to
const ALPHA_MIN = 0;
const ALPHA_MAX = 1.6;

// autocorrelation plot margins (shared by drawing and pointer hit-testing)
const AC_L = 46;
const AC_R = 12;
const AC_T = 16;
const AC_B = 22;

interface Lab2Json {
  fs: number;
  n: number;
  alpha: number;
  N: number;
  signal: BinSignalHeader;
}

interface EchoData {
  fs: number;
  y: Float64Array;
  R: Float64Array; // lags 0..MAX_LAG
  trueN: number;
  trueAlpha: number;
}

// ------------------------------------------------------------------ small canvas helpers

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function ptAt(p0: [number, number], p1: [number, number], t: number): [number, number] {
  return [lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t)];
}

function strokeArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const ah = 5;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ah * Math.cos(ang - Math.PI / 6), y2 - ah * Math.sin(ang - Math.PI / 6));
  ctx.lineTo(x2 - ah * Math.cos(ang + Math.PI / 6), y2 - ah * Math.sin(ang + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

/** DPR-aware canvas that redraws through draw(ctx, w, h, now); redraws when `draw` changes
 * identity (i.e. its deps changed) or the wrapper resizes, and keeps ticking while draw
 * returns true. */
function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const render = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
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
  }, [render, draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => render());
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [render]);

  return { canvasRef, wrapRef };
}

// ------------------------------------------------------------------ block-diagram layout

const BD: Record<"input" | "adder" | "output" | "fbDown" | "delay" | "gain" | "adderBottom", [number, number]> = {
  input: [0.05, 0.26],
  adder: [0.3, 0.26],
  output: [0.93, 0.26],
  fbDown: [0.93, 0.8],
  delay: [0.64, 0.8],
  gain: [0.4, 0.8],
  adderBottom: [0.3, 0.4],
};

function feedbackPose(
  tb: number,
  N: number,
  w: number,
  h: number,
): { x: number; y: number; countdown: number | null; visible: boolean } {
  const px = (k: keyof typeof BD): [number, number] => [BD[k][0] * w, BD[k][1] * h];
  const segs: Array<{ a: keyof typeof BD; b: keyof typeof BD; from: number; to: number; dwell?: boolean }> = [
    { a: "output", b: "fbDown", from: 0.0, to: 0.12 },
    { a: "fbDown", b: "delay", from: 0.12, to: 0.2 },
    { a: "delay", b: "delay", from: 0.2, to: 0.6, dwell: true },
    { a: "delay", b: "gain", from: 0.6, to: 0.68 },
    { a: "gain", b: "adderBottom", from: 0.68, to: 0.82 },
  ];
  for (const s of segs) {
    if (tb >= s.from && tb < s.to) {
      const lt = (tb - s.from) / (s.to - s.from);
      const [x, y] = ptAt(px(s.a), px(s.b), s.dwell ? 0 : lt);
      const countdown = s.dwell ? Math.max(0, Math.round(N * (1 - lt))) : null;
      return { x, y, countdown, visible: true };
    }
  }
  return { x: 0, y: 0, countdown: null, visible: false };
}

// ------------------------------------------------------------------ component

export default function EchoPanel() {
  const [data, setData] = useState<EchoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [Nhat, setNhat] = useState(5000);
  const [alphaHat, setAlphaHat] = useState(0.9);
  const [playing, setPlaying] = useState<null | "echoed" | "recovered">(null);
  const [manualPhase, setManualPhase] = useState(0);

  const acRevealStart = useRef(performance.now());
  const animStart = useRef(performance.now());
  const draggingRef = useRef(false);

  // ---- load the recording, compute its autocorrelation once, and seed the estimate
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const header = await fetchJson<Lab2Json>(`${ASSET_BASE}/lab2.json`);
        const y = await fetchBinSignal(ASSET_BASE, header.signal);
        const R = autocorr(y, MAX_LAG);
        if (cancelled) return;
        const est = estimateEcho(R);
        acRevealStart.current = performance.now();
        setData({ fs: header.fs, y, R, trueN: header.N, trueAlpha: header.alpha });
        setNhat(est.N);
        setAlphaHat(est.alpha);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => stopAudio(), []);

  useEffect(() => {
    if (playing) animStart.current = performance.now();
  }, [playing]);

  // ---- derived
  const radius = useMemo(() => poleRadius(alphaHat, Nhat), [alphaHat, Nhat]);
  const stable = isStable(alphaHat);
  const delay = data ? delayMs(Nhat, data.fs) : 0;

  const echoedClamped = useMemo(() => (data ? clampUnit(data.y) : null), [data]);
  const recovered = useMemo(
    () => (data ? clampUnit(inverseFilter(data.y, Nhat, alphaHat)) : null),
    [data, Nhat, alphaHat],
  );

  // recovered audio auto-mutes once the current estimate goes unstable
  useEffect(() => {
    if (playing === "recovered" && !stable) {
      stopAudio();
      setPlaying(null);
    }
  }, [stable, playing]);

  const handlePlay = useCallback(
    (kind: "echoed" | "recovered") => {
      if (!data) return;
      if (playing === kind) {
        stopAudio();
        setPlaying(null);
        return;
      }
      if (kind === "recovered" && !stable) return;
      const samples = kind === "echoed" ? echoedClamped : recovered;
      if (!samples) return;
      setPlaying(kind);
      playSamples(samples, data.fs, { onEnded: () => setPlaying((p) => (p === kind ? null : p)) });
    },
    [data, playing, stable, echoedClamped, recovered],
  );

  const resetToEstimate = () => {
    if (!data) return;
    const est = estimateEcho(data.R);
    setNhat(est.N);
    setAlphaHat(est.alpha);
  };

  const updateNFromLag = useCallback(
    (rawLag: number) => {
      if (!data) return;
      const n0 = Math.max(N_MIN, Math.min(N_MAX, Math.round(rawLag)));
      const lo = Math.max(1, n0 - SNAP_WINDOW);
      const hi = Math.min(MAX_LAG, n0 + SNAP_WINDOW);
      const { N: peakN, Rpeak } = findPeak(data.R, lo, hi);
      const prominent = Rpeak / data.R[0] > SNAP_PROMINENCE;
      const n = prominent ? peakN : n0;
      setNhat(n);
      const r = data.R[n] / data.R[0];
      setAlphaHat(alphaFromRatio(r));
    },
    [data],
  );

  const handleAlphaSlider = (e: ChangeEvent<HTMLInputElement>) => {
    setAlphaHat(Number(e.target.value));
  };

  const lagFromClientX = (clientX: number, wrapEl: HTMLDivElement): number => {
    const rect = wrapEl.getBoundingClientRect();
    const w = rect.width;
    const frac = (clientX - rect.left - AC_L) / Math.max(1, w - AC_L - AC_R);
    return frac * MAX_LAG;
  };

  const onAcPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!data) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateNFromLag(lagFromClientX(e.clientX, e.currentTarget));
  };
  const onAcPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !data) return;
    updateNFromLag(lagFromClientX(e.clientX, e.currentTarget));
  };
  const onAcPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onAcKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!data) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      updateNFromLag(Nhat - (e.shiftKey ? 100 : 10));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      updateNFromLag(Nhat + (e.shiftKey ? 100 : 10));
    }
  };

  // ---- draw: autocorrelation
  const drawAutocorr = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      if (!data) return false;
      const t = Math.min(1, (now - acRevealStart.current) / 700);
      const reveal = 1 - Math.pow(1 - t, 3);
      const pw = w - AC_L - AC_R;
      const ph = h - AC_T - AC_B;
      const rMax = data.R[0];
      const xOf = (lag: number) => AC_L + (lag / MAX_LAG) * pw;
      const yOf = (v: number) => AC_T + (1 - v / rMax) * ph;

      ctx.strokeStyle = "#dadce0";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#5f6368";
      ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let lag = 0; lag <= MAX_LAG; lag += 5000) {
        const x = Math.round(xOf(lag)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, AC_T);
        ctx.lineTo(x, AC_T + ph);
        ctx.stroke();
        ctx.fillText(String(lag), x, AC_T + ph + 4);
      }
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let f = 0; f <= 1.001; f += 0.5) {
        const y = Math.round(yOf(f * rMax)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(AC_L, y);
        ctx.lineTo(AC_L + pw, y);
        ctx.stroke();
        ctx.fillText(f.toFixed(1), AC_L - 4, y);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(AC_L, AC_T - 4, pw * reveal + 1, ph + 8);
      ctx.clip();
      ctx.strokeStyle = "#06B6D4";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const step = Math.max(1, Math.floor(MAX_LAG / pw));
      for (let lag = 0; lag <= MAX_LAG; lag += step) {
        const x = xOf(lag);
        const y = yOf(data.R[lag]);
        if (lag === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      if (reveal >= 1) {
        // true-N reference (this lab's true delay — dashed, quiet)
        const xt = Math.round(xOf(data.trueN)) + 0.5;
        ctx.strokeStyle = "#c8cdd3";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xt, AC_T);
        ctx.lineTo(xt, AC_T + ph);
        ctx.stroke();
        ctx.setLineDash([]);

        // height ratio line at the current marker
        const RN = data.R[Math.max(0, Math.min(MAX_LAG, Nhat))];
        const yPeak = yOf(RN);
        ctx.strokeStyle = "rgba(6,182,212,0.55)";
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(AC_L, yPeak);
        ctx.lineTo(AC_L + pw, yPeak);
        ctx.stroke();
        ctx.setLineDash([]);

        // N marker (draggable)
        const xN = Math.round(xOf(Nhat)) + 0.5;
        ctx.strokeStyle = "#06B6D4";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xN, AC_T);
        ctx.lineTo(xN, AC_T + ph);
        ctx.stroke();
        ctx.fillStyle = "#06B6D4";
        ctx.beginPath();
        ctx.moveTo(xN - 5, AC_T - 2);
        ctx.lineTo(xN + 5, AC_T - 2);
        ctx.lineTo(xN, AC_T + 7);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#1a1a1a";
        ctx.font = "11px Arial, Helvetica, sans-serif";
        ctx.textAlign = xN > w - 70 ? "right" : "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(`N̂=${Nhat}`, xN + (xN > w - 70 ? -8 : 8), AC_T + 12);
      }

      return reveal < 1;
    },
    [data, Nhat],
  );

  // ---- draw: inverse-filter block diagram
  const drawBlock = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      if (!data) return false;
      const running = Boolean(playing);
      const PERIOD = 2600;
      const t = running ? (((now - animStart.current) / PERIOD) % 1 + 1) % 1 : manualPhase;
      const P = (k: keyof typeof BD): [number, number] => [BD[k][0] * w, BD[k][1] * h];

      ctx.strokeStyle = "#9aa0a6";
      ctx.fillStyle = "#9aa0a6";
      ctx.lineWidth = 1.4;
      strokeArrow(ctx, ...P("input"), ...P("adder"));
      strokeArrow(ctx, ...P("adder"), ...P("output"));
      strokeArrow(ctx, ...P("output"), ...P("fbDown"));
      strokeArrow(ctx, ...P("fbDown"), ...P("delay"));
      strokeArrow(ctx, ...P("delay"), ...P("gain"));
      strokeArrow(ctx, ...P("gain"), ...P("adderBottom"));

      const [ix, iy] = P("input");
      ctx.fillStyle = "#5f6368";
      ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText("y[n]", ix - 2, iy - 6);

      const [ax, ay] = P("adder");
      ctx.strokeStyle = "#1a1a1a";
      ctx.fillStyle = "#fff";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(ax, ay, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "700 12px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", ax, ay - 1);

      const [ox, oy] = P("output");
      ctx.fillStyle = "#5f6368";
      ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("ŷ[n]", ox + 2, oy - 6);

      const [dx, dy] = P("delay");
      ctx.strokeStyle = "#1a1a1a";
      ctx.fillStyle = "#fff";
      ctx.lineWidth = 1.2;
      ctx.fillRect(dx - 21, dy - 12, 42, 24);
      ctx.strokeRect(dx - 21, dy - 12, 42, 24);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("z⁻ᴺ", dx, dy - 3);
      ctx.font = "9px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillStyle = "#5f6368";
      ctx.fillText(`N̂=${Nhat}`, dx, dy + 9);

      const [gx, gy] = P("gain");
      ctx.strokeStyle = "#1a1a1a";
      ctx.fillStyle = "#fff";
      ctx.fillRect(gx - 24, gy - 11, 48, 22);
      ctx.strokeRect(gx - 24, gy - 11, 48, 22);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("×(−α̂)", gx, gy);

      let fpos: [number, number];
      if (t < 0.5) fpos = ptAt(P("input"), P("adder"), t / 0.5);
      else fpos = ptAt(P("adder"), P("output"), (t - 0.5) / 0.5);
      ctx.fillStyle = "#06B6D4";
      ctx.beginPath();
      ctx.arc(fpos[0], fpos[1], 4, 0, Math.PI * 2);
      ctx.fill();

      const tb = (t + 0.5) % 1;
      const fb = feedbackPose(tb, Nhat, w, h);
      if (fb.visible) {
        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.arc(fb.x, fb.y, 4, 0, Math.PI * 2);
        ctx.fill();
        if (fb.countdown !== null) {
          ctx.fillStyle = "#b45309";
          ctx.font = "700 10px ui-monospace, Menlo, Consolas, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(String(fb.countdown), dx, dy - 16);
        }
      }

      return running;
    },
    [data, playing, manualPhase, Nhat],
  );

  // ---- draw: pole-zero
  const drawPoleZero = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      if (!data) return false;
      const cx = w / 2;
      const cy = h / 2 - 4;
      const R_PLOT = Math.min(w, h) * 0.36;

      ctx.strokeStyle = "#9aa0a6";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, R_PLOT, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#5f6368";
      ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText("|z|=1", cx + R_PLOT * 0.66, cy - R_PLOT * 0.7);

      // A single zoom factor scales both rings, sized off whichever of the two deltas (the
      // current estimate's or the fixed true-parameter reference's) is larger, so neither can
      // be blown outside the plot — e.g. a clamped alpha-hat near 1 sits far closer to |z|=1
      // than the true alpha=0.9 does, so its delta alone would be much too small to size by.
      const targetDelta = 0.32;
      const rawDelta = radius - 1;
      const trueRadius = poleRadius(data.trueAlpha, data.trueN);
      const trueDelta = trueRadius - 1;
      const zoomBasis = Math.max(Math.abs(rawDelta), Math.abs(trueDelta));
      const zoom = zoomBasis === 0 ? 1 : Math.max(1, Math.min(2_000_000, targetDelta / zoomBasis));
      const clampPx = (units: number) => Math.max(0, Math.min(R_PLOT * 3, R_PLOT * units));
      const dispPx = clampPx(1 + rawDelta * zoom);
      const trueDispPx = clampPx(1 + trueDelta * zoom);
      ctx.strokeStyle = "#c8cdd3";
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, trueDispPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const angles = poleAngles(Nhat, 220);
      const poleColor = stable ? "#06B6D4" : "#d93025";
      ctx.strokeStyle = poleColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, dispPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = poleColor;
      for (let i = 0; i < angles.length; i++) {
        const a = angles[i];
        const x = cx + dispPx * Math.cos(a);
        const y = cy + dispPx * Math.sin(a);
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = "#5f6368";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 4);
      ctx.lineTo(cx + 4, cy + 4);
      ctx.moveTo(cx + 4, cy - 4);
      ctx.lineTo(cx - 4, cy + 4);
      ctx.stroke();

      ctx.fillStyle = "#5f6368";
      ctx.font = "10px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`radial axis zoomed ×${Math.round(zoom).toLocaleString()} around |z|=1`, 4, h - 14);

      if (!stable) {
        ctx.fillStyle = "#d93025";
        ctx.font = "700 12px Arial, Helvetica, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("UNSTABLE", cx, cy - R_PLOT - 6);
      }

      return false;
    },
    [data, Nhat, radius, stable],
  );

  // ---- draw: A/B waveforms
  const drawWave = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      if (!data || !echoedClamped || !recovered) return false;
      const n = echoedClamped.length;
      const laneH = h / 2;
      const mid1 = laneH / 2;
      const mid2 = laneH + laneH / 2;
      const ampScale = laneH / 2 - 4;
      const buckets = Math.max(1, Math.floor(w));
      const perBucket = n / buckets;

      ctx.fillStyle = "rgba(217,48,37,0.10)";
      for (let bx = 0; bx < buckets; bx++) {
        const s = Math.floor(bx * perBucket);
        const e = Math.max(s + 1, Math.floor((bx + 1) * perBucket));
        let maxDiff = 0;
        for (let i = s; i < e && i < n; i++) maxDiff = Math.max(maxDiff, Math.abs(echoedClamped[i] - recovered[i]));
        if (maxDiff > 0.08) ctx.fillRect(bx, 0, 1, h);
      }

      ctx.strokeStyle = "#dadce0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, laneH);
      ctx.lineTo(w, laneH);
      ctx.stroke();
      ctx.fillStyle = "#5f6368";
      ctx.font = "10px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("echoed y[n]", 4, 2);
      ctx.fillText(`recovered (N̂=${Nhat}, α̂=${alphaHat.toFixed(3)})`, 4, laneH + 2);

      const drawLane = (arr: Float64Array, mid: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let bx = 0; bx < buckets; bx++) {
          const s = Math.floor(bx * perBucket);
          const e = Math.max(s + 1, Math.floor((bx + 1) * perBucket));
          let mn = Infinity;
          let mx = -Infinity;
          for (let i = s; i < e && i < n; i++) {
            const v = arr[i];
            if (v < mn) mn = v;
            if (v > mx) mx = v;
          }
          if (mn === Infinity) continue;
          ctx.moveTo(bx, mid - mx * ampScale);
          ctx.lineTo(bx, mid - mn * ampScale);
        }
        ctx.stroke();
      };
      drawLane(echoedClamped, mid1, "#5f6368");
      drawLane(recovered, mid2, "#06B6D4");

      return false;
    },
    [data, echoedClamped, recovered, Nhat, alphaHat],
  );

  const { canvasRef: acCanvasRef, wrapRef: acWrapRef } = useCanvas(drawAutocorr);
  const { canvasRef: bdCanvasRef, wrapRef: bdWrapRef } = useCanvas(drawBlock);
  const { canvasRef: pzCanvasRef, wrapRef: pzWrapRef } = useCanvas(drawPoleZero);
  const { canvasRef: wfCanvasRef, wrapRef: wfWrapRef } = useCanvas(drawWave);

  return (
    <div className="sigEc">
      {error && <p className="sigNote">Could not load the lab 2 recording: {error}</p>}
      {!data && !error && <div className="sigEcLoading">Loading the lab 2 recording…</div>}
      {data && (
        <>
          <section className="sigEcSection">
            <div className="sigEcSectionHead">
              <h3>Autocorrelation</h3>
              <p>drag the marker (or click, or arrow keys) to set N̂ — it snaps onto a real peak when close</p>
            </div>
            <div
              className="sigCanvasWrap sigEcAutocorrWrap sigEcDraggable"
              ref={acWrapRef}
              tabIndex={0}
              onPointerDown={onAcPointerDown}
              onPointerMove={onAcPointerMove}
              onPointerUp={onAcPointerUp}
              onPointerCancel={onAcPointerUp}
              onKeyDown={onAcKeyDown}
            >
              <canvas
                ref={acCanvasRef}
                role="img"
                aria-label="Autocorrelation of the echoed recording, with a draggable marker at the estimated echo delay"
              />
            </div>
            <div className="sigEcStats">
              <div className="sigEcStat">
                <span className="sigEcStatLabel">N̂</span>
                <span className="sigEcStatValue">{Nhat}</span>
              </div>
              <div className="sigEcStat">
                <span className="sigEcStatLabel">α̂</span>
                <span className="sigEcStatValue">{alphaHat.toFixed(4)}</span>
              </div>
              <div className="sigEcStat">
                <span className="sigEcStatLabel">delay</span>
                <span className="sigEcStatValue">{delay.toFixed(1)} ms</span>
              </div>
            </div>
            <div className="sigEcControls">
              <label className="sigEcSlider">
                α̂
                <input
                  type="range"
                  min={ALPHA_MIN}
                  max={ALPHA_MAX}
                  step={0.001}
                  value={alphaHat}
                  onChange={handleAlphaSlider}
                />
                <b>{alphaHat.toFixed(3)}</b>
              </label>
              <button type="button" className="sigBtn" onClick={resetToEstimate}>
                reset to autocorrelation estimate
              </button>
            </div>
          </section>

          <section className="sigEcSection sigEcTwoCol">
            <div>
              <div className="sigEcSectionHead">
                <h3>Inverse filter</h3>
                <p>{playing ? "samples flowing (playing)" : "press step, or play audio below"}</p>
              </div>
              <div className="sigCanvasWrap sigEcBlockWrap" ref={bdWrapRef}>
                <canvas
                  ref={bdCanvasRef}
                  role="img"
                  aria-label="Block diagram of the inverse filter with animated sample flow through the N-sample delay and gain"
                />
              </div>
              <div className="sigEcControls">
                <button
                  type="button"
                  className="sigBtn"
                  disabled={Boolean(playing)}
                  onClick={() => setManualPhase((p) => (p + 1 / 6) % 1)}
                >
                  step
                </button>
              </div>
            </div>
            <div>
              <div className="sigEcSectionHead">
                <h3>Pole-zero</h3>
                <p>radial axis exaggerated near |z|=1</p>
              </div>
              <div className="sigCanvasWrap sigEcPoleWrap" ref={pzWrapRef}>
                <canvas
                  ref={pzCanvasRef}
                  role="img"
                  aria-label="Pole-zero plot of the inverse filter: unit circle and the ring of N poles, exaggerated near the unit circle"
                />
              </div>
              <div className="sigEcStats">
                <div className={`sigEcStat ${!stable ? "sigEcStatWarn" : ""}`}>
                  <span className="sigEcStatLabel">α̂^(1/N̂)</span>
                  <span className="sigEcStatValue">{radius.toFixed(6)}</span>
                </div>
                <div className={`sigEcStat ${!stable ? "sigEcStatWarn" : ""}`}>
                  <span className="sigEcStatLabel">status</span>
                  <span className="sigEcStatValue">{stable ? "stable" : "UNSTABLE"}</span>
                </div>
              </div>
              {!stable && (
                <p className="sigEcUnstable">
                  UNSTABLE — with |α̂| ≥ 1 the poles sit on or outside the unit circle, so the
                  recovered output grows by a factor of α̂ every N̂ samples (one echo round-trip)
                  instead of settling. Recovered playback auto-mutes while this holds.
                </p>
              )}
            </div>
          </section>

          <section className="sigEcSection">
            <div className="sigEcSectionHead">
              <h3>Listen</h3>
              <p>recovered is rebuilt live from the current N̂, α̂ — a wrong estimate stays audible</p>
            </div>
            <div className="sigEcControls">
              <button
                type="button"
                className={`sigBtn ${playing === "echoed" ? "sigBtnOn" : ""}`}
                onClick={() => handlePlay("echoed")}
              >
                {playing === "echoed" ? "■ stop" : "▶ play echoed"}
              </button>
              <button
                type="button"
                className={`sigBtn ${playing === "recovered" ? "sigBtnOn" : ""}`}
                onClick={() => handlePlay("recovered")}
                disabled={!stable}
                title={stable ? undefined : "unstable — muted"}
              >
                {playing === "recovered"
                  ? "■ stop"
                  : `▶ play recovered (N̂=${Nhat}, α̂=${alphaHat.toFixed(3)})`}
              </button>
            </div>
            <div className="sigCanvasWrap sigEcWaveWrap" ref={wfWrapRef}>
              <canvas
                ref={wfCanvasRef}
                role="img"
                aria-label="Echoed and recovered waveforms, stacked, with regions where they differ highlighted"
              />
            </div>
          </section>

          <p className="sigNote">
            y[n] = x[n] + α·x[n−N], true N={data.trueN} ({delayMs(data.trueN, data.fs).toFixed(0)} ms
            at {data.fs} Hz), true α={data.trueAlpha}. The estimate comes from the autocorrelation's side
            peak: r = R[N̂]/R[0], α̂ = (1−√(1−4r²))/(2r), with r clamped just under
            0.5 (quantization can push the true peak's ratio slightly past it). Removing the echo runs the same
            relation backwards: ŷ[n] = y[n] − α̂·ŷ[n−N̂].
          </p>
        </>
      )}
    </div>
  );
}
