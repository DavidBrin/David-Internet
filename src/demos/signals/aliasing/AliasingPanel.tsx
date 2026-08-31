"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playSamples, stopAudio } from "@/demos/signals/dsp/audio";
import {
  CHIRP_DURATION,
  FS,
  M_OPTIONS,
  type Spectrogram,
  aliasLines,
  apparentFrequency,
  computeSpectrogram,
  continuousSineAt,
  fs2Of,
  generateChirpUndersampled,
  generateUndersampled,
  sincReconstruct,
  t2Of,
} from "./model";
import "./aliasing.css";

const ACCENT = "#06B6D4";
const INK = "#16181c";
const MUTED = "#8a8f98";
const LINE = "#dde2e6";

const WINDOW_S = 0.025; // 25 ms visible window for the time-domain scope
const SCROLL_RATE = WINDOW_S / 6; // signal-seconds of scroll per real second — slow, subtle
const SINC_MARGIN = 60; // extra samples on each side of the window fed into the sinc sum

type Mode = "sinusoid" | "chirp";

/** Resize a canvas for its CSS box at the current devicePixelRatio; returns null if not ready. */
function prepCanvas(canvas: HTMLCanvasElement | null, wrap: HTMLElement | null, heightPx: number) {
  if (!canvas || !wrap) return null;
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(1, Math.floor(wrap.clientWidth));
  const H = heightPx;
  if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W, H };
}

export default function AliasingPanel() {
  const [mode, setMode] = useState<Mode>("sinusoid");

  // --- Sinusoid mode state ---
  const [f0, setF0] = useState(1000);
  const [mIndex, setMIndex] = useState(0);
  const M = M_OPTIONS[mIndex];
  const fs2 = fs2Of(M);
  const T2 = t2Of(M);
  const alias = apparentFrequency(f0, fs2);
  const [scopeRunning, setScopeRunning] = useState(true);
  const [playingOrig, setPlayingOrig] = useState(false);
  const [playingRecon, setPlayingRecon] = useState(false);

  const timeCanvasRef = useRef<HTMLCanvasElement>(null);
  const timeWrapRef = useRef<HTMLDivElement>(null);
  const freqCanvasRef = useRef<HTMLCanvasElement>(null);
  const freqWrapRef = useRef<HTMLDivElement>(null);

  // --- Chirp mode state ---
  const [chirpMIndex, setChirpMIndex] = useState(1); // default M=2, the textbook bounce case
  const chirpM = M_OPTIONS[chirpMIndex];
  const [chirpPlaying, setChirpPlaying] = useState(false);
  const spectroCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectroWrapRef = useRef<HTMLDivElement>(null);
  const spectroCacheRef = useRef<Map<number, { spec: Spectrogram; img: HTMLCanvasElement }>>(new Map());
  const chirpStopRef = useRef<(() => void) | null>(null);
  const chirpStartRef = useRef<number>(0);
  const chirpElapsedRef = useRef<number>(0);

  // ---------------------------------------------------------------------
  // Sinusoid: time-domain scope (animated, DPR-aware)
  // ---------------------------------------------------------------------
  const scrollRef = useRef(0); // accumulated signal-time offset (seconds)
  const lastFrameRef = useRef<number | null>(null);

  const drawScope = useCallback(() => {
    const prep = prepCanvas(timeCanvasRef.current, timeWrapRef.current, 170);
    if (!prep) return;
    const { ctx, W, H } = prep;
    const t0 = scrollRef.current;
    const mid = H / 2;
    const ampPx = H * 0.38;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(W, mid);
    ctx.stroke();

    const xOf = (t: number) => ((t - t0) / WINDOW_S) * W;
    const yOf = (v: number) => mid - v * ampPx;

    // fine continuous original, computed at display resolution
    const nFine = 420;
    const fineT = new Float64Array(nFine);
    for (let i = 0; i < nFine; i++) fineT[i] = t0 + (i / (nFine - 1)) * WINDOW_S;
    const orig = continuousSineAt(f0, fineT);
    ctx.strokeStyle = MUTED;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < nFine; i++) {
      const x = xOf(fineT[i]);
      const y = yOf(orig[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // undersampled comb, with margin for the sinc sum
    const nVisStart = Math.floor(t0 / T2);
    const nVisEnd = Math.ceil((t0 + WINDOW_S) / T2);
    const nStart = nVisStart - SINC_MARGIN;
    const count = nVisEnd - nVisStart + 1 + 2 * SINC_MARGIN;
    const samples = generateUndersampled(f0, M, nStart, count);

    // sinc reconstruction, accent overlay
    const recon = sincReconstruct(samples, T2, nStart, fineT);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < nFine; i++) {
      const x = xOf(fineT[i]);
      const y = yOf(recon[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // stems for the samples actually inside the visible window
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 1.2;
    for (let n = nVisStart - 1; n <= nVisEnd + 1; n++) {
      const t = n * T2;
      if (t < t0 - T2 || t > t0 + WINDOW_S + T2) continue;
      const v = samples[n - nStart];
      const x = xOf(t);
      const y = yOf(v);
      ctx.beginPath();
      ctx.moveTo(x, mid);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [f0, M, T2]);

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      if (document.hidden) {
        raf = requestAnimationFrame(loop);
        return;
      }
      if (lastFrameRef.current === null) lastFrameRef.current = now;
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      if (scopeRunning) scrollRef.current += dt * SCROLL_RATE;
      drawScope();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [drawScope, scopeRunning]);

  useEffect(() => {
    const wrap = timeWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => drawScope());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [drawScope]);

  // ---------------------------------------------------------------------
  // Sinusoid: frequency-axis (DTFT folding) view
  // ---------------------------------------------------------------------
  const drawFreq = useCallback(() => {
    const prep = prepCanvas(freqCanvasRef.current, freqWrapRef.current, 170);
    if (!prep) return;
    const { ctx, W, H } = prep;
    const maxFreq = FS; // fixed axis so the replica spacing visibly shrinks as M grows
    const nyq = fs2 / 2;
    const xOf = (freq: number) => (freq / maxFreq) * W;
    const baseline = H - 22;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    // baseband shading [0, fs2/2]
    ctx.fillStyle = "rgba(6,182,212,0.08)";
    ctx.fillRect(xOf(0), 8, xOf(nyq) - xOf(0), baseline - 8);

    // Nyquist marker
    ctx.strokeStyle = MUTED;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xOf(nyq), 8);
    ctx.lineTo(xOf(nyq), baseline);
    ctx.stroke();
    ctx.setLineDash([]);

    // axis
    ctx.strokeStyle = LINE;
    ctx.beginPath();
    ctx.moveTo(0, baseline);
    ctx.lineTo(W, baseline);
    ctx.stroke();

    // spectral copies
    const lines = aliasLines(f0, fs2, maxFreq);
    ctx.font = "10px Arial, Helvetica, sans-serif";
    ctx.textAlign = "center";
    for (const ln of lines) {
      const x = xOf(ln.freq);
      ctx.strokeStyle = ln.isBaseband ? ACCENT : MUTED;
      ctx.lineWidth = ln.isBaseband ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.moveTo(x, baseline);
      ctx.lineTo(x, 8);
      ctx.stroke();
    }

    // tick labels
    ctx.fillStyle = MUTED;
    ctx.textAlign = "left";
    ctx.fillText("0", xOf(0) + 2, baseline + 12);
    ctx.textAlign = "center";
    ctx.fillText(`Nyquist ${nyq.toFixed(0)}`, xOf(nyq), baseline + 12);
    ctx.textAlign = "right";
    ctx.fillText(`${maxFreq} Hz`, W - 2, baseline + 12);
  }, [f0, fs2]);

  useEffect(() => {
    // `mode` is not read by drawFreq, but the canvas only exists in the DOM while
    // mode === "sinusoid" — re-run on mode changes so it's drawn as soon as it remounts.
    if (mode === "sinusoid") drawFreq();
  }, [drawFreq, mode]);

  useEffect(() => {
    if (mode !== "sinusoid") return;
    const wrap = freqWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => drawFreq());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [drawFreq, mode]);

  // ---------------------------------------------------------------------
  // Sinusoid: audio
  // ---------------------------------------------------------------------
  const playOriginal = () => {
    const n = FS; // 1 second
    const samples = new Float64Array(n);
    for (let i = 0; i < n; i++) samples[i] = Math.sin((2 * Math.PI * f0 * i) / FS);
    setPlayingOrig(true);
    setPlayingRecon(false);
    playSamples(samples, FS, { onEnded: () => setPlayingOrig(false) });
  };

  const playReconstructed = () => {
    const n = Math.round(fs2); // 1 second at fs2
    const samples = generateUndersampled(f0, M, 0, n);
    setPlayingRecon(true);
    setPlayingOrig(false);
    playSamples(samples, fs2, { onEnded: () => setPlayingRecon(false) });
  };

  // ---------------------------------------------------------------------
  // Chirp: spectrogram, computed + cached per M, drawn statically by default
  // ---------------------------------------------------------------------
  const getSpectroImage = useCallback((mVal: number) => {
    const cache = spectroCacheRef.current;
    const hit = cache.get(mVal);
    if (hit) return hit;
    const fs2v = fs2Of(mVal);
    const signal = generateChirpUndersampled(mVal, CHIRP_DURATION);
    const spec = computeSpectrogram(signal, fs2v, 256, 128);
    const nFrames = spec.frames.length;
    const nBins = spec.nfft / 2 + 1;
    let maxMag = 1e-9;
    for (const frame of spec.frames) for (const v of frame) if (v > maxMag) maxMag = v;
    const off = document.createElement("canvas");
    off.width = Math.max(1, nFrames);
    off.height = nBins;
    const octx = off.getContext("2d")!;
    const img = octx.createImageData(off.width, off.height);
    for (let x = 0; x < nFrames; x++) {
      const frame = spec.frames[x];
      for (let bin = 0; bin < nBins; bin++) {
        const db = 20 * Math.log10(frame[bin] / maxMag + 1e-9);
        const t = Math.max(0, Math.min(1, (db + 55) / 55)); // clip to [-55, 0] dB
        let r: number, g: number, b: number;
        if (t < 0.6) {
          const u = t / 0.6;
          r = 255 + u * (6 - 255);
          g = 255 + u * (182 - 255);
          b = 255 + u * (212 - 255);
        } else {
          const u = (t - 0.6) / 0.4;
          r = 6 + u * (10 - 6);
          g = 182 + u * (24 - 182);
          b = 212 + u * (44 - 212);
        }
        const y = nBins - 1 - bin; // low freq at bottom
        const idx = (y * off.width + x) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    const entry = { spec, img: off };
    cache.set(mVal, entry);
    return entry;
  }, []);

  const drawSpectro = useCallback(
    (cursorFrac: number | null) => {
      const prep = prepCanvas(spectroCanvasRef.current, spectroWrapRef.current, 220);
      if (!prep) return;
      const { ctx, W, H } = prep;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      const { img } = getSpectroImage(chirpM);
      ctx.imageSmoothingEnabled = false;
      const plotH = H - 18;
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, W, plotH);

      const nyq = fs2Of(chirpM) / 2;
      ctx.fillStyle = MUTED;
      ctx.font = "10px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("0 Hz", 2, plotH + 13);
      ctx.textAlign = "right";
      ctx.fillText(`${nyq.toFixed(0)} Hz (Nyquist)`, W - 2, plotH + 13);

      if (cursorFrac !== null) {
        const x = cursorFrac * W;
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, plotH);
        ctx.stroke();
      }
    },
    [chirpM, getSpectroImage],
  );

  useEffect(() => {
    // canvas only exists in the DOM while mode === "chirp" — re-run on mode changes
    // (and draw statically without needing playback) so it's never left blank.
    if (mode === "chirp") drawSpectro(chirpPlaying ? chirpElapsedRef.current / CHIRP_DURATION : null);
  }, [drawSpectro, chirpPlaying, mode]);

  useEffect(() => {
    if (mode !== "chirp") return;
    const wrap = spectroWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => drawSpectro(chirpPlaying ? chirpElapsedRef.current / CHIRP_DURATION : null));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [drawSpectro, chirpPlaying, mode]);

  useEffect(() => {
    if (!chirpPlaying) return;
    let raf = 0;
    const loop = () => {
      const elapsed = Math.min(CHIRP_DURATION, (performance.now() - chirpStartRef.current) / 1000);
      chirpElapsedRef.current = elapsed;
      drawSpectro(elapsed / CHIRP_DURATION);
      if (elapsed < CHIRP_DURATION) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [chirpPlaying, drawSpectro]);

  const playChirp = () => {
    const signal = generateChirpUndersampled(chirpM, CHIRP_DURATION);
    chirpStartRef.current = performance.now();
    chirpElapsedRef.current = 0;
    setChirpPlaying(true);
    const stop = playSamples(signal, fs2Of(chirpM), {
      onEnded: () => {
        setChirpPlaying(false);
        chirpElapsedRef.current = 0;
        chirpStopRef.current = null;
      },
    });
    chirpStopRef.current = stop;
  };

  const stopChirp = () => {
    chirpStopRef.current?.();
    chirpStopRef.current = null;
  };

  // stop any audio and animation when switching modes / unmounting
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  useEffect(() => {
    stopAudio();
    setPlayingOrig(false);
    setPlayingRecon(false);
    setChirpPlaying(false);
    chirpStopRef.current = null;
  }, [mode]);

  const mLabel = useMemo(() => M_OPTIONS.map((v) => String(v)).join("   "), []);

  return (
    <div className="sigAl">
      <div className="sigAlModeRow">
        <button type="button" className={`sigBtn ${mode === "sinusoid" ? "sigBtnOn" : ""}`} onClick={() => setMode("sinusoid")}>
          Sinusoid
        </button>
        <button type="button" className={`sigBtn ${mode === "chirp" ? "sigBtnOn" : ""}`} onClick={() => setMode("chirp")}>
          Chirp
        </button>
      </div>

      {mode === "sinusoid" ? (
        <>
          <div className="sigAlSliders">
            <label>
              f0
              <input
                type="range"
                min={100}
                max={4000}
                step={10}
                value={f0}
                onChange={(e) => setF0(Number(e.target.value))}
              />
              <span className="sigAlVal">{f0.toFixed(0)} Hz</span>
            </label>
            <label>
              M
              <input
                type="range"
                min={0}
                max={M_OPTIONS.length - 1}
                step={1}
                value={mIndex}
                onChange={(e) => setMIndex(Number(e.target.value))}
              />
              <span className="sigAlVal">
                &divide;{M} &middot; fs2={fs2} Hz
              </span>
            </label>
          </div>
          <div className="sigAlMTicks" aria-hidden="true">
            {M_OPTIONS.map((v) => (
              <span key={v}>{v}</span>
            ))}
          </div>

          <div className="sigAlReadout">
            f0 = {f0.toFixed(0)} Hz sampled at fs2 = {fs2} Hz &rarr; apparent frequency <b>{alias.toFixed(0)} Hz</b>
            {alias !== f0 ? " (folded)" : " (below Nyquist, no fold)"}
          </div>

          <div className="sigAlViews">
            <div>
              <div className="sigAlViewLabel">Time domain (25 ms window, scrolling)</div>
              <div className="sigCanvasWrap" ref={timeWrapRef}>
                <canvas ref={timeCanvasRef} role="img" aria-label="Time-domain waveform, samples, and sinc reconstruction" />
              </div>
              <div className="sigAlLegend">
                <span>
                  <span className="sigAlSwatch" style={{ background: MUTED }} /> original (8192 Hz)
                </span>
                <span>
                  <span className="sigAlSwatch" style={{ background: INK }} /> samples
                </span>
                <span>
                  <span className="sigAlSwatch" style={{ background: ACCENT }} /> sinc reconstruction
                </span>
              </div>
            </div>
            <div>
              <div className="sigAlViewLabel">Frequency axis (DTFT copies)</div>
              <div className="sigCanvasWrap" ref={freqWrapRef}>
                <canvas ref={freqCanvasRef} role="img" aria-label="Spectral copies folding into baseband" />
              </div>
              <div className="sigAlLegend">
                <span>
                  <span className="sigAlSwatch" style={{ background: ACCENT }} /> apparent (baseband) copy
                </span>
                <span>
                  <span className="sigAlSwatch" style={{ background: MUTED }} /> other copies (k&middot;fs2 &plusmn; f0)
                </span>
              </div>
            </div>
          </div>

          <div className="sigRow">
            <button type="button" className="sigBtn" onClick={() => setScopeRunning((r) => !r)}>
              {scopeRunning ? "Pause scope" : "Resume scope"}
            </button>
            <button type="button" className={`sigBtn ${playingOrig ? "sigBtnOn" : ""}`} onClick={playOriginal}>
              Play original (8192 Hz)
            </button>
            <button type="button" className={`sigBtn ${playingRecon ? "sigBtnOn" : ""}`} onClick={playReconstructed}>
              Play reconstructed (fs2 = {fs2} Hz)
            </button>
          </div>
          <p className="sigNote">
            The reconstructed tone is just the undersampled sequence played back at fs2 — that resampling by the
            browser&rsquo;s DAC is the bandlimited reconstruction. Above Nyquist the pitch you hear is the folded
            frequency, not f0.
          </p>
        </>
      ) : (
        <>
          <div className="sigAlSliders">
            <label>
              M
              <input
                type="range"
                min={0}
                max={M_OPTIONS.length - 1}
                step={1}
                value={chirpMIndex}
                onChange={(e) => setChirpMIndex(Number(e.target.value))}
              />
              <span className="sigAlVal">
                &divide;{chirpM} &middot; fs2={fs2Of(chirpM)} Hz
              </span>
            </label>
          </div>
          <div className="sigAlMTicks" aria-hidden="true">
            {M_OPTIONS.map((v) => (
              <span key={v}>{v}</span>
            ))}
          </div>

          <div className="sigAlViewLabel">Spectrogram of the reconstructed chirp</div>
          <div className="sigCanvasWrap sigAlSpectroWrap" ref={spectroWrapRef}>
            <canvas ref={spectroCanvasRef} role="img" aria-label="Spectrogram of the undersampled chirp, showing the Nyquist bounce" />
          </div>
          <div className="sigRow">
            {!chirpPlaying ? (
              <button type="button" className="sigBtn" onClick={playChirp}>
                Play reconstructed chirp
              </button>
            ) : (
              <button type="button" className="sigBtn sigBtnOn" onClick={stopChirp}>
                Stop
              </button>
            )}
          </div>
          <p className="sigAlChirpNote">
            x(t) = sin(&Omega;&#8320;t + &frac12;&beta;t&sup2;), instantaneous frequency sweeping ~0 &rarr; ~
            {(fs2Of(1) / 2 + 300).toFixed(0)} Hz over {CHIRP_DURATION} s at the base 8192 Hz, undersampled by M and
            played back at fs2 = {fs2Of(chirpM)} Hz. Every time the sweep would cross fs2/2 it folds and comes back
            down — that&rsquo;s the bounce, drawn straight from the aliased samples (M options: {mLabel}).
          </p>
        </>
      )}
    </div>
  );
}
