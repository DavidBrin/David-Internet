"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./decrypt.css";
import { matlabRandperm } from "@/demos/signals/dsp/mt19937";
import { playSamples, stopAudio } from "@/demos/signals/dsp/audio";
import { fetchBinSignal, fetchJson, type BinSignalHeader } from "@/demos/signals/dsp/assets";
import { decodeAll, type DecodedChain } from "./model";

interface Lab1Json {
  fs: number;
  seed: number;
  nHalf: number;
  n: number;
  mag: BinSignalHeader;
  phase: BinSignalHeader;
}

const BASE = "/demos/signals";
const ACCENT = "#06B6D4"; // --demo-accent for this page
const INK = "#202124";
const HUE2 = "#F59E0B"; // second hue for the mag/phase, re/im pairs
const MUTED = "#5f6368";
const LINE = "#dadce0";

const DURATION = 1500; // ms, animation length for each step

const STEP_BUTTONS = ["Un-pack", "Re-form", "Un-permute", "Flip"] as const;
const STATE_LABEL = [
  "X — packed (magnitude / phase)",
  "W — unpacked (magnitude·e^{j·phase} → complex)",
  "Z — reformed (concat Re W, Im W)",
  "Y — un-permuted (Y[perm[i]] = Z[i])",
  "M — flipped (the message: M = flipud(Y))",
];
const ACTION_LABEL = ["", "Un-packing…", "Re-forming…", "Un-permuting…", "Flipping…"];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
}

/** Per-column [min,max] over `columns` buckets spanning indices [0,n), via a value function. */
function stripMinMax(getValue: (i: number) => number, n: number, columns: number): { min: Float32Array; max: Float32Array } {
  const min = new Float32Array(columns);
  const max = new Float32Array(columns);
  for (let c = 0; c < columns; c++) {
    const lo = Math.floor((c * n) / columns);
    const hi = Math.max(lo + 1, Math.floor(((c + 1) * n) / columns));
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = lo; i < hi; i++) {
      const v = getValue(i);
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    min[c] = mn;
    max[c] = mx;
  }
  return { min, max };
}

/** The "flip" animation: column c blends between Y's own range and its mirror range, sourced from y only. */
function mirrorMinMax(y: Float64Array, columns: number, t: number): { min: Float32Array; max: Float32Array } {
  const n = y.length;
  const min = new Float32Array(columns);
  const max = new Float32Array(columns);
  for (let c = 0; c < columns; c++) {
    const lo0 = (c * n) / columns;
    const hi0 = ((c + 1) * n) / columns;
    const mc = columns - 1 - c;
    const lo1 = (mc * n) / columns;
    const hi1 = ((mc + 1) * n) / columns;
    const lo = Math.floor(lo0 + (lo1 - lo0) * t);
    const hi = Math.max(lo + 1, Math.floor(hi0 + (hi1 - hi0) * t));
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = lo; i < hi && i < n; i++) {
      const v = y[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    min[c] = mn;
    max[c] = mx;
  }
  return { min, max };
}

function drawStrip(ctx: CanvasRenderingContext2D, rect: Rect, mm: { min: Float32Array; max: Float32Array }, color: string) {
  const columns = mm.min.length;
  let lo = Infinity;
  let hi = -Infinity;
  for (let c = 0; c < columns; c++) {
    if (mm.min[c] < lo) lo = mm.min[c];
    if (mm.max[c] > hi) hi = mm.max[c];
  }
  if (!isFinite(lo) || !isFinite(hi)) {
    lo = -1;
    hi = 1;
  }
  if (hi - lo < 1e-9) hi = lo + 1;
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const yOf = (v: number) => rect.y + rect.h * (1 - (v - lo) / (hi - lo));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const colW = rect.w / columns;
  for (let c = 0; c < columns; c++) {
    const x = rect.x + c * colW + colW / 2;
    const y0 = yOf(mm.max[c]);
    const y1 = yOf(mm.min[c]);
    ctx.moveTo(x, y0);
    ctx.lineTo(x, Math.max(y1, y0 + 0.6));
  }
  ctx.stroke();
}

function drawStripBox(ctx: CanvasRenderingContext2D, rect: Rect) {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(rect.x) + 0.5, Math.round(rect.y) + 0.5, Math.round(rect.w), Math.round(rect.h));
}

export default function DecryptPanel() {
  const [header, setHeader] = useState<Lab1Json | null>(null);
  const [mag, setMag] = useState<Float64Array | null>(null);
  const [phase, setPhase] = useState<Float64Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState(0); // settled step: 0..4
  const [anim, setAnim] = useState<{ to: number; start: number } | null>(null);
  const [playing, setPlaying] = useState(false);

  const timeoutRef = useRef<number | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await fetchJson<Lab1Json>(`${BASE}/lab1.json`);
        const [m, p] = await Promise.all([fetchBinSignal(BASE, h.mag), fetchBinSignal(BASE, h.phase)]);
        if (cancelled) return;
        setHeader(h);
        setMag(m);
        setPhase(p);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Regenerate the permutation from the seed once, and cache every decode step — the step
  // buttons only control what's revealed/animated in the UI, not what's computed.
  const perm = useMemo(() => (header ? matlabRandperm(header.n, header.seed) : null), [header]);
  const chain: DecodedChain | null = useMemo(() => {
    if (!mag || !phase || !perm) return null;
    return decodeAll(mag, phase, perm);
  }, [mag, phase, perm]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      stopAudio();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const goTo = useCallback(
    (to: number) => {
      if (anim || !chain || to !== step + 1) return;
      setAnim({ to, start: performance.now() });
      timeoutRef.current = window.setTimeout(() => {
        setStep(to);
        setAnim(null);
        timeoutRef.current = null;
      }, DURATION);
    },
    [anim, chain, step],
  );

  const reset = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setAnim(null);
    setStep(0);
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
    setPlaying(false);
  }, []);

  // ------------------------------------------------------------------ drawing

  const draw = useCallback(
    (now: number) => {
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
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);

      if (!chain || !mag || !phase) return;

      const PAD = 10;
      const labelH = 18;
      const y0 = labelH + PAD;
      const usableH = H - labelH - PAD * 2;
      const fullW = W - PAD * 2;
      const columns = Math.max(80, Math.min(1000, Math.floor(fullW)));

      const topRect: Rect = { x: PAD, y: y0, w: fullW, h: usableH / 2 - 4 };
      const botRect: Rect = { x: PAD, y: y0 + usableH / 2 + 4, w: fullW, h: usableH / 2 - 4 };
      const singleRect: Rect = { x: PAD, y: y0, w: fullW, h: usableH };
      const stripH = usableH * 0.72;
      const reformLeft: Rect = { x: PAD, y: y0 + (usableH - stripH) / 2, w: fullW / 2 - 2, h: stripH };
      const reformRight: Rect = { x: PAD + fullW / 2 + 2, y: y0 + (usableH - stripH) / 2, w: fullW / 2 - 2, h: stripH };

      ctx.font = "12px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      const label = (text: string) => {
        ctx.fillStyle = MUTED;
        ctx.fillText(text, PAD, 13);
      };

      const stripLabel = (text: string, rect: Rect, color: string) => {
        ctx.font = "10.5px ui-monospace, Menlo, Consolas, monospace";
        const w = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(rect.x + 2, rect.y + 2, w + 4, 12);
        ctx.fillStyle = color;
        ctx.fillText(text, rect.x + 4, rect.y + 12);
        ctx.font = "12px Arial, Helvetica, sans-serif";
      };

      if (!anim) {
        label(STATE_LABEL[step]);
        if (step === 0) {
          drawStripBox(ctx, topRect);
          drawStripBox(ctx, botRect);
          drawStrip(ctx, topRect, stripMinMax((i) => mag[i], mag.length, columns), ACCENT);
          drawStrip(ctx, botRect, stripMinMax((i) => phase[i], phase.length, columns), HUE2);
          stripLabel("magnitude", topRect, ACCENT);
          stripLabel("phase", botRect, HUE2);
        } else if (step === 1) {
          drawStripBox(ctx, topRect);
          drawStripBox(ctx, botRect);
          drawStrip(ctx, topRect, stripMinMax((i) => chain.re[i], chain.re.length, columns), ACCENT);
          drawStrip(ctx, botRect, stripMinMax((i) => chain.im[i], chain.im.length, columns), HUE2);
          stripLabel("Re(W)", topRect, ACCENT);
          stripLabel("Im(W)", botRect, HUE2);
        } else if (step === 2) {
          drawStripBox(ctx, singleRect);
          drawStrip(ctx, singleRect, stripMinMax((i) => chain.z[i], chain.z.length, columns), ACCENT);
        } else if (step === 3) {
          drawStripBox(ctx, singleRect);
          drawStrip(ctx, singleRect, stripMinMax((i) => chain.y[i], chain.y.length, columns), ACCENT);
        } else {
          drawStripBox(ctx, singleRect);
          drawStrip(ctx, singleRect, stripMinMax((i) => chain.m[i], chain.m.length, columns), INK);
        }
      } else {
        const t = Math.min(1, (now - anim.start) / DURATION);
        const e = ease(t);
        label(`${ACTION_LABEL[anim.to]} ${Math.round(e * 100)}%`);

        if (anim.to === 1) {
          // Un-pack: crossfade mag/phase -> Re/Im W, strips stay put.
          drawStripBox(ctx, topRect);
          drawStripBox(ctx, botRect);
          const topGet = (i: number) => (1 - e) * mag[i] + e * chain.re[i];
          const botGet = (i: number) => (1 - e) * phase[i] + e * chain.im[i];
          drawStrip(ctx, topRect, stripMinMax(topGet, mag.length, columns), ACCENT);
          drawStrip(ctx, botRect, stripMinMax(botGet, phase.length, columns), HUE2);
        } else if (anim.to === 2) {
          // Re-form: the two strips slide/resize into one row, Re on the left half, Im on the right.
          const leftRect = lerpRect(topRect, reformLeft, e);
          const rightRect = lerpRect(botRect, reformRight, e);
          drawStripBox(ctx, leftRect);
          drawStripBox(ctx, rightRect);
          drawStrip(ctx, leftRect, stripMinMax((i) => chain.re[i], chain.re.length, columns), ACCENT);
          drawStrip(ctx, rightRect, stripMinMax((i) => chain.im[i], chain.im.length, columns), HUE2);
        } else if (anim.to === 3) {
          // Un-permute: reveal the un-scrambled Y in a growing chunk from the left; the rest still shows Z.
          drawStripBox(ctx, singleRect);
          const n = chain.z.length;
          const cut = Math.floor(n * e);
          const getVal = (i: number) => (i < cut ? chain.y[i] : chain.z[i]);
          drawStrip(ctx, singleRect, stripMinMax(getVal, n, columns), ACCENT);
        } else {
          // Flip: mirror-morph Y into its reverse (M), sourced straight from Y.
          drawStripBox(ctx, singleRect);
          drawStrip(ctx, singleRect, mirrorMinMax(chain.y, columns, e), INK);
        }
      }
    },
    [anim, chain, mag, phase, step],
  );

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const loop = (now: number) => {
      draw(now);
      if (anim) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, anim]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw(performance.now()));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  // ------------------------------------------------------------------ playback

  const play = useCallback(() => {
    if (!chain || !header) return;
    if (playing) {
      if (stopRef.current) stopRef.current();
      stopRef.current = null;
      setPlaying(false);
      return;
    }
    const samples = step === 1 || step === 2 ? chain.z : step === 3 ? chain.y : step === 4 ? chain.m : null;
    if (!samples) return;
    let peak = 0;
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    const gain = peak > 0 ? 0.9 / peak : 1;
    setPlaying(true);
    stopRef.current = playSamples(samples, header.fs, {
      gain,
      onEnded: () => {
        setPlaying(false);
        stopRef.current = null;
      },
    });
  }, [chain, header, playing, step]);

  const canPlay = step >= 1 && !!chain && !anim;

  if (error) {
    return <p className="sigDeErr">Couldn&apos;t load Lab 1 assets: {error}</p>;
  }

  return (
    <div className="sigDeWrap">
      <div className="sigDeCanvasWrap sigCanvasWrap">
        <div ref={wrapRef} style={{ height: 220 }}>
          <canvas ref={canvasRef} role="img" aria-label={`Decrypt panel: ${STATE_LABEL[step]}`} />
        </div>
      </div>

      <div className="sigRow sigDeSteps">
        {STEP_BUTTONS.map((label, i) => {
          const idx = i + 1;
          const done = step >= idx;
          const isNext = step === idx - 1 && !anim;
          return (
            <button
              key={label}
              type="button"
              className={`sigBtn ${done ? "sigBtnOn" : ""}`}
              disabled={!isNext || !chain}
              onClick={() => goTo(idx)}
            >
              {idx}. {label}
            </button>
          );
        })}
        <button type="button" className="sigBtn" disabled={step === 0 && !anim} onClick={reset}>
          Reset
        </button>
      </div>

      <div className="sigRow sigDePlayRow">
        <button type="button" className={`sigBtn ${playing ? "sigBtnOn" : ""}`} disabled={!canPlay} onClick={play}>
          {playing ? "Stop" : "Play current state"}
        </button>
        {playing ? <span className="sigDePlaying">playing…</span> : null}
        {step === 0 ? <span className="sigNote" style={{ margin: 0 }}>apply Un-pack to hear anything</span> : null}
      </div>

      <div className="sigDeMeta">
        <span>
          seed <b>{header ? header.seed : "…"}</b>
        </span>
        <span>
          N <b>{header ? header.n.toLocaleString() : "…"}</b>
        </span>
        <span>
          Fs <b>{header ? `${header.fs.toLocaleString()} Hz` : "…"}</b>
        </span>
      </div>

      <p className="sigNote">
        The permutation isn&apos;t shipped as data — it&apos;s regenerated in your browser by running MATLAB&apos;s
        exact random number generator (MT19937, seeded 2023) and sorting, the same way <code>randperm</code> does.
        Un-permuting is then just indexing: <code>Y[perm[i]] = Z[i]</code>. The un-permuted signal Y is backwards
        speech (David&apos;s lab flips it before playing); the Flip step reverses it into the audible message.
      </p>
    </div>
  );
}
