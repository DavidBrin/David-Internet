"use client";

import { useCallback, useEffect, useRef } from "react";
import { BANDS, bandPeaks, type Spectrum } from "./coherence";

const INK = "#202124";
const MUTED = "#5f6368";
const LINE = "#dadce0";

/** Sets up a DPR-aware canvas that redraws through `draw(ctx, W, H, now)` on demand and while animating. */
function useCanvas(draw: (ctx: CanvasRenderingContext2D, W: number, H: number, now: number) => boolean) {
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
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const again = drawRef.current(ctx, W, H, now);
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

function toDb(p: Float64Array): Float64Array {
  const out = new Float64Array(p.length);
  for (let i = 0; i < p.length; i++) out[i] = 10 * Math.log10(Math.max(p[i], 1e-12));
  return out;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

// ------------------------------------------------------------------ PSD inset

interface PsdProps {
  channel: string;
  before: Spectrum;
  after: Spectrum;
  /** Top of the frequency axis (fs/2 of the pipeline output). */
  fMax: number;
}

/** "before → after" PSD of channel A. The new curve morphs in over ~400 ms; the old one fades. */
export function PsdInset({ channel, before, after, fMax }: PsdProps) {
  const prevRef = useRef<{ f: Float64Array; db: Float64Array } | null>(null);
  const curRef = useRef<{ f: Float64Array; db: Float64Array } | null>(null);
  const animStart = useRef(0);
  const beforeDb = useRef<{ f: Float64Array; db: Float64Array } | null>(null);

  // detect a new `after`: keep the previous curve for the cross-fade
  if (curRef.current === null || curRef.current.f !== after.f) {
    if (curRef.current && curRef.current.f !== after.f) {
      prevRef.current = curRef.current;
      animStart.current = performance.now();
    }
    curRef.current = { f: after.f, db: toDb(after.p) };
  }
  if (beforeDb.current === null || beforeDb.current.f !== before.f) beforeDb.current = { f: before.f, db: toDb(before.p) };

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number, now: number) => {
      const cur = curRef.current!;
      const bef = beforeDb.current!;
      const prev = prevRef.current;
      const t = prev ? Math.min(1, (now - animStart.current) / 400) : 1;
      const a = ease(t);

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      const L = 30;
      const R = 6;
      const T = 16;
      const B = 16;
      const pw = W - L - R;
      const ph = H - T - B;

      // y range from both curves, rounded to 10 dB
      let lo = Infinity;
      let hi = -Infinity;
      for (const c of [bef, cur]) {
        for (let i = 1; i < c.f.length; i++) {
          if (c.f[i] > fMax) break;
          lo = Math.min(lo, c.db[i]);
          hi = Math.max(hi, c.db[i]);
        }
      }
      lo = Math.floor(lo / 10) * 10;
      hi = Math.ceil(hi / 10) * 10;
      if (hi - lo < 20) hi = lo + 20;
      const xOf = (f: number) => L + (f / fMax) * pw;
      const yOf = (db: number) => T + (1 - (db - lo) / (hi - lo)) * ph;

      // grid
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.fillStyle = MUTED;
      ctx.font = "9px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let db = lo; db <= hi; db += 10) {
        const y = Math.round(yOf(db)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(L, y);
        ctx.lineTo(W - R, y);
        ctx.stroke();
        ctx.fillText(String(db), L - 3, y);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const fStep = fMax > 100 ? 25 : 12.5;
      for (let f = 0; f <= fMax + 1e-6; f += fStep) {
        const x = Math.round(xOf(f)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, T);
        ctx.lineTo(x, T + ph);
        ctx.stroke();
        ctx.fillText(String(f), x, T + ph + 3);
      }
      // 60 Hz marker
      if (fMax >= 60) {
        const x = Math.round(xOf(60)) + 0.5;
        ctx.strokeStyle = "#d93025";
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(x, T);
        ctx.lineTo(x, T + ph);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#d93025";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("60", x + 2, T + 2);
      }
      ctx.fillStyle = MUTED;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = "10px Arial, Helvetica, sans-serif";
      ctx.fillText(`PSD ${channel} · dB µV²/Hz`, L, 2);

      const line = (c: { f: Float64Array; db: Float64Array }, mix?: { f: Float64Array; db: Float64Array }) => {
        ctx.beginPath();
        for (let i = 1; i < c.f.length; i++) {
          if (c.f[i] > fMax + 1e-6) break;
          let db = c.db[i];
          if (mix) {
            // morph from the previous curve when both share the same bins
            const j = mix.f.length === c.f.length ? i : Math.round((c.f[i] / mix.f[mix.f.length - 1]) * (mix.f.length - 1));
            const pdb = mix.db[Math.min(j, mix.db.length - 1)];
            db = pdb + (db - pdb) * a;
          }
          const x = xOf(c.f[i]);
          const y = yOf(db);
          if (i === 1) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      // before: grey
      ctx.strokeStyle = "#9aa0a6";
      ctx.lineWidth = 1.2;
      line(bef);
      // old "after": fading out
      if (prev && t < 1) {
        ctx.globalAlpha = 0.5 * (1 - a);
        ctx.strokeStyle = "#6366F1";
        line(prev);
        ctx.globalAlpha = 1;
      }
      // new "after": indigo, morphing in
      ctx.strokeStyle = "#6366F1";
      ctx.lineWidth = 1.6;
      line(cur, prev && t < 1 ? prev : undefined);

      // legend
      ctx.font = "10px Arial, Helvetica, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#9aa0a6";
      ctx.fillText("raw", W - R - 44, 2);
      ctx.fillStyle = "#6366F1";
      ctx.fillText("pipeline", W - R, 2);
      return t < 1;
    },
    [channel, fMax, after, before],
  );

  const { canvasRef, wrapRef } = useCanvas(draw);
  return (
    <div ref={wrapRef} className="nnE-canvasWrap nnE-inset">
      <canvas ref={canvasRef} role="img" aria-label={`Power spectrum of ${channel}, before and after the pipeline`} />
    </div>
  );
}

// ------------------------------------------------------------------ coherence

interface CohProps {
  a: string;
  b: string;
  f: Float64Array;
  cxy: Float64Array;
  /** Bump to restart the left-to-right draw-in (pair change or a scrub jump). */
  drawKey: number;
}

const BAND_FILL = ["rgba(99,102,241,0.06)", "rgba(99,102,241,0.12)", "rgba(99,102,241,0.18)", "rgba(99,102,241,0.09)"];
const F_MAX = 60;

export function CoherencePanel({ a, b, f, cxy, drawKey }: CohProps) {
  const animStart = useRef(performance.now());
  const lastKey = useRef(drawKey);
  if (lastKey.current !== drawKey) {
    lastKey.current = drawKey;
    animStart.current = performance.now();
  }

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number, now: number) => {
      const t = Math.min(1, (now - animStart.current) / 600);
      const reveal = ease(t);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      const L = 34;
      const R = 10;
      const T = 24;
      const B = 22;
      const pw = W - L - R;
      const ph = H - T - B;
      const xOf = (hz: number) => L + (hz / F_MAX) * pw;
      const yOf = (c: number) => T + (1 - c) * ph;

      // bands
      const peaks = bandPeaks(f, cxy);
      BANDS.forEach((band, i) => {
        ctx.fillStyle = BAND_FILL[i];
        ctx.fillRect(xOf(band.lo), T, xOf(band.hi) - xOf(band.lo), ph);
        ctx.fillStyle = "#4f46e5";
        ctx.font = "12px Arial, Helvetica, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(band.label, (xOf(band.lo) + xOf(band.hi)) / 2, T - 18);
      });

      // grid
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.fillStyle = MUTED;
      ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let c = 0; c <= 1; c += 0.25) {
        const y = Math.round(yOf(c)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(L, y);
        ctx.lineTo(W - R, y);
        ctx.stroke();
        ctx.fillText(c.toFixed(2), L - 4, y);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let hz = 0; hz <= F_MAX; hz += 10) {
        const x = Math.round(xOf(hz)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, T);
        ctx.lineTo(x, T + ph);
        ctx.stroke();
        ctx.fillText(`${hz} Hz`, x, T + ph + 4);
      }

      // the coherence line, revealed left → right
      ctx.save();
      ctx.beginPath();
      ctx.rect(L, T - 20, pw * reveal + 1, ph + 20);
      ctx.clip();
      ctx.strokeStyle = "#6366F1";
      ctx.lineWidth = 1.8;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let k = 0; k < f.length; k++) {
        if (f[k] > F_MAX) break;
        const x = xOf(f[k]);
        const y = yOf(cxy[k]);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // fill under the line, faint
      ctx.lineTo(xOf(Math.min(F_MAX, f[f.length - 1])), yOf(0));
      ctx.lineTo(xOf(0), yOf(0));
      ctx.closePath();
      ctx.fillStyle = "rgba(99,102,241,0.08)";
      ctx.fill();

      // per-band peak markers: dot on the curve, value in a fixed slot under the band letter
      // (staggered on two rows so the narrow δ/θ/α labels never collide)
      ctx.font = "10px Arial, Helvetica, sans-serif";
      peaks.forEach((p, i) => {
        if (!p.peak) return;
        const x = xOf(p.peak.f);
        const y = yOf(p.peak.value);
        ctx.fillStyle = "#4f46e5";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const cx = Math.max(L + 38, (xOf(p.lo) + xOf(p.hi)) / 2);
        ctx.fillText(`${p.peak.value.toFixed(2)} @ ${p.peak.f.toFixed(1)} Hz`, cx, T + 3 + (i % 2) * 12);
      });
      ctx.restore();
      return t < 1;
    },
    [a, b, f, cxy],
  );

  const { canvasRef, wrapRef } = useCanvas(draw);
  return (
    <div ref={wrapRef} className="nnE-canvasWrap nnE-coh">
      <canvas ref={canvasRef} role="img" aria-label={`Coherence between ${a} and ${b}`} />
    </div>
  );
}
