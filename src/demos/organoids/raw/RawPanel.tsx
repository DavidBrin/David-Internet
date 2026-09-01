"use client";

/**
 * Chapter 1 — "Raw voltage" (Jul–Aug 2024).
 *
 * One well's LFP streaming left→right, with the MATLAB preprocessing chain
 * (lfp_processing.m / LFP_Preprocessing_broadband.m) drawn as a pipeline of
 * toggleable stages. Clicking a stage sets how much of the chain is "applied"
 * to the trace: raw shows a noisy stand-in for the 12.5 kHz broadband,
 * bandpass shows the filtered 100 Hz LFP, downsample overlays the sample
 * grid, and HDF5 adds the per-plate array shape.
 *
 * All data is seeded synthetic (synthLfp), regenerated per well from
 * ../core/synth — illustrative only, no lab recordings ship with this page.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hashSeed, mulberry32, synthLfp, wellParams } from "../core/synth";
import { PLATE_D } from "../core/plate";
import { figureUrl, useOrgFigures } from "../figures";
import "./raw.css";

// ------------------------------------------------------------------ constants

const FS = 100; // Hz — the downsampled LFP rate produced by the MATLAB chain
const N_SAMPLES = 16384; // ~163.84 s of signal, looped continuously
const STREAM_SEC_PER_SEC = 2; // "~2 s of signal per second of animation"
const DISPLAY_WINDOW_SEC = 2.5;
const DISPLAY_WINDOW_SAMPLES = Math.round(DISPLAY_WINDOW_SEC * FS);
// visual-only amplitude noise added to stand in for the un-filtered 12.5 kHz
// broadband in the "raw" stage — real broadband detail isn't in this dataset,
// this is seeded white noise scaled to look dense/jittery, nothing more.
const RAW_NOISE_SCALE = 0.35;

interface Stage {
  key: string;
  title: string;
  mono: string;
}

const STAGES: Stage[] = [
  { key: "raw", title: "Axion raw (12.5 kHz)", mono: "AxisFile(...).RawVoltageData" },
  { key: "bandpass", title: "bandpass", mono: "filtfilt(bpFilt, raw)" },
  { key: "downsample", title: "downsample ×125 (100 Hz)", mono: "broadband(1,2) = downsampled LFP" },
  { key: "hdf5", title: "HDF5 per plate", mono: "h5create /all_wells_data" },
];

const QUICK_WELLS: { row: number; col: number; label: string }[] = [
  { row: 0, col: 0, label: "A1" },
  { row: 2, col: 4, label: "C5" },
  { row: 4, col: 6, label: "E7" },
];

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

// ------------------------------------------------------------------ canvas hook
// Same DPR-aware, mount-safe pattern used elsewhere in the demos: callback refs
// so the effect notices the canvas attach, and a <2px-jitter guard on the wrap's
// measured size so a ResizeObserver can never feed a resize back into itself.

function useRawCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => boolean) {
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
    const tick = (now: number) => {
      const canvas = canvasElRef.current;
      const wrap = wrapElRef.current;
      if (!canvas || !wrap) return;
      canvas.style.display = "block";
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
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

export default function RawPanel() {
  const [activeStage, setActiveStage] = useState(0);
  const [selectedRow, setSelectedRow] = useState(0);
  const [selectedCol, setSelectedCol] = useState(0);
  const [playing, setPlaying] = useState(true);

  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // signal-time (seconds) streamed so far — persists across well/stage
  // switches and pauses so the trace never jumps discontinuously.
  const signalTimeRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);

  const baseSignal = useMemo(
    () => synthLfp(wellParams(PLATE_D, -1, selectedRow, selectedCol), hashSeed("ch1", selectedRow, selectedCol), N_SAMPLES, FS),
    [selectedRow, selectedCol],
  );

  const noiseSignal = useMemo(() => {
    const rng = mulberry32(hashSeed("ch1-noise", selectedRow, selectedCol));
    const arr = new Float64Array(N_SAMPLES);
    for (let i = 0; i < arr.length; i++) arr[i] = (rng() - 0.5) * 2 * RAW_NOISE_SCALE;
    return arr;
  }, [selectedRow, selectedCol]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => {
      if (playingRef.current) {
        if (lastTsRef.current !== null) {
          const dt = (now - lastTsRef.current) / 1000;
          signalTimeRef.current += dt * STREAM_SEC_PER_SEC;
        }
        lastTsRef.current = now;
      } else {
        lastTsRef.current = null;
      }

      ctx.clearRect(0, 0, w, h);

      const playheadSample = signalTimeRef.current * FS;
      const midY = h / 2;
      const ampPxPerUnit = (h / 2 - 20) / 3.4;

      // center gridline
      ctx.strokeStyle = "#e7cede";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      const addNoise = activeStage === 0; // "raw" stage: broadband stand-in, unfiltered
      ctx.strokeStyle = addNoise ? "#ff7f0e" : "#1f77b4"; // C1 orange (raw) vs C0 blue (filtered)
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (let x = 0; x <= w; x++) {
        const frac = playheadSample - DISPLAY_WINDOW_SAMPLES + (x / w) * DISPLAY_WINDOW_SAMPLES;
        const idx = Math.floor(mod(frac, N_SAMPLES));
        const v = baseSignal[idx] + (addNoise ? noiseSignal[idx] : 0);
        const y = midY - v * ampPxPerUnit;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // downsample stage (and everything after it): mark the 100 Hz sample grid
      if (activeStage >= 2) {
        ctx.fillStyle = "#1f77b4";
        const pxPerSample = w / DISPLAY_WINDOW_SAMPLES;
        for (let i = 0; i <= DISPLAY_WINDOW_SAMPLES; i++) {
          const frac = playheadSample - DISPLAY_WINDOW_SAMPLES + i;
          const idx = Math.floor(mod(frac, N_SAMPLES));
          const v = baseSignal[idx];
          const x = i * pxPerSample;
          const y = midY - v * ampPxPerUnit;
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // raw stage: a small calibration scale bar, since the added HF noise
      // has no real amplitude units of its own
      if (activeStage === 0) {
        const barX = 16;
        const barTop = midY - ampPxPerUnit * 1.2;
        const barBot = midY - ampPxPerUnit * 0.2;
        ctx.strokeStyle = "#82345d";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(barX, barTop);
        ctx.lineTo(barX, barBot);
        ctx.moveTo(barX - 3, barTop);
        ctx.lineTo(barX + 3, barTop);
        ctx.moveTo(barX - 3, barBot);
        ctx.lineTo(barX + 3, barBot);
        ctx.stroke();
        ctx.fillStyle = "#82345d";
        ctx.font = "10px ui-monospace, Consolas, monospace";
        ctx.fillText("µV ×5", barX + 7, (barTop + barBot) / 2 + 3);
      }

      return true;
    },
    [activeStage, baseSignal, noiseSignal],
  );

  const { canvasRef, wrapRef } = useRawCanvas(draw);

  const figs = useOrgFigures("raw");

  const rowLetter = String.fromCharCode(65 + selectedRow);
  const wellLabel = `${rowLetter}${selectedCol + 1}`;
  const wellDose = PLATE_D.doses[selectedRow][selectedCol];

  return (
    <div className="ogRaw">
      <div className="ogRow ogRawPipelineHead">
        <span className="ogLabel">Preprocessing chain</span>
        <span className="ogMirror">mirrors lfp_processing.m / LFP_Preprocessing_broadband.m</span>
      </div>

      <div className="ogRawPipeline">
        {STAGES.map((s, i) => (
          <Fragment key={s.key}>
            <div className="ogRawStageGroup">
              <button
                type="button"
                className="ogBtn ogRawStage"
                data-active={i <= activeStage}
                onClick={() => setActiveStage(i)}
              >
                {s.title}
              </button>
              <div className="ogMono ogRawStageMono">{s.mono}</div>
            </div>
            {i < STAGES.length - 1 && (
              <span className="ogRawArrow" aria-hidden="true">
                →
              </span>
            )}
          </Fragment>
        ))}
      </div>

      <div className="ogRow ogRawTraceRow">
        <span className="ogSynthBadge">illustrative data — no lab recordings ship with this page</span>
        <span className="ogLabel">
          well {wellLabel} · {wellDose}
        </span>
        <button type="button" className="ogBtn" data-active={playing} onClick={() => setPlaying((p) => !p)}>
          {playing ? "Pause" : "Play"}
        </button>
        {activeStage === 3 && <span className="ogChip ogRawHdfChip">6×8×60000 double</span>}
      </div>

      <div className="ogCanvasWrap ogRawCanvasWrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Streaming LFP trace, well ${wellLabel}, stage ${STAGES[activeStage].title}`}
        />
      </div>

      <div className="ogRawBelowCanvas">
        <div className="ogRawWellPicker">
          <span className="ogLabel">Quick wells</span>
          <div className="ogRow">
            {QUICK_WELLS.map((qw) => (
              <button
                key={qw.label}
                type="button"
                className="ogBtn"
                data-active={selectedRow === qw.row && selectedCol === qw.col}
                onClick={() => {
                  setSelectedRow(qw.row);
                  setSelectedCol(qw.col);
                }}
              >
                {qw.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ogRawPlate">
          <span className="ogLabel">Plate D — click a well</span>
          <div className="ogRawPlateGrid">
            <div className="ogRawPlateCorner" />
            {Array.from({ length: 8 }, (_, c) => (
              <div key={`col-${c}`} className="ogRawPlateColLabel">
                {c + 1}
              </div>
            ))}
            {Array.from({ length: 6 }, (_, r) => (
              <Fragment key={`row-${r}`}>
                <div className="ogRawPlateRowLabel">{String.fromCharCode(65 + r)}</div>
                {Array.from({ length: 8 }, (_, c) => (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    className="ogRawPlateCell"
                    data-active={selectedRow === r && selectedCol === c}
                    onClick={() => {
                      setSelectedRow(r);
                      setSelectedCol(c);
                    }}
                    aria-label={`well ${String.fromCharCode(65 + r)}${c + 1}`}
                  />
                ))}
              </Fragment>
            ))}
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
        MATLAB first, because Axion&rsquo;s MEA tooling only speaks MATLAB — lfp_processing.m and
        LFP_Preprocessing_broadband.m load the raw broadband and hand back the downsampled LFP,
        one well at a time. The pain of wrangling a 6×8 grid of per-well MATLAB cell arrays (and
        shuttling them around as .mat files) is what eventually motivated the move to a
        Python-first pipeline.
      </p>
    </div>
  );
}
