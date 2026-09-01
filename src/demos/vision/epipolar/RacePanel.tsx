"use client";

/**
 * Sub-panel C — SSD vs NCC race. Pick a patch center on dino0; candidates are
 * sampled every 2 display-px along the epipolar line in dino1 and scored with
 * scanScores(). A "brightness shift" toggle adds +0.15 to every dino1 pixel
 * before scoring, which is invariant for NCC (its per-window mean subtraction
 * cancels a uniform offset exactly) but not for SSD.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { epipolarLine } from "@/demos/vision/core/fmatrix";
import { scanScores } from "@/demos/vision/core/match";
import type { Grid } from "@/demos/vision/core/stereo";
import type { Mat } from "@/demos/vision/core/linalg";
import { clamp, setupImageCanvas, toNaturalXY } from "./canvasUtil";
import { lineSegmentInRect, sampleAlongSegment, scaleLineToDisplay } from "./geom";

const R = 9;
const SWEEP_MS = 1400;
const SHIFT = 0.15;

interface Props {
  F: Mat;
  dino0Img: HTMLImageElement;
  dino1Img: HTMLImageElement;
  dino0Grid: Grid;
  dino1Grid: Grid;
  dino0Scale: number;
  dino1Scale: number;
  defaultC1: [number, number];
}

function shiftGrid(g: Grid, delta: number): Grid {
  const data = new Float64Array(g.data.length);
  for (let i = 0; i < data.length; i++) data[i] = clamp(g.data[i] + delta, 0, 1);
  return { data, w: g.w, h: g.h };
}

export default function RacePanel({ F, dino0Img, dino1Img, dino0Grid, dino1Grid, dino0Scale, dino1Scale, defaultC1 }: Props) {
  const [c1, setC1] = useState<[number, number]>(defaultC1);
  const [shiftOn, setShiftOn] = useState(false);
  const [revealIdx, setRevealIdx] = useState(0);

  const shiftedGrid = useMemo(() => shiftGrid(dino1Grid, SHIFT), [dino1Grid]);

  const candidates = useMemo(() => {
    // c1 is display px (it indexes dino0Grid directly); F/epipolarLine want the
    // correspondences' ORIGINAL coords, so divide by dino0's scale going in, and
    // rescale the resulting line's constant term into dino1's display px going out
    // (data.json: display_px = original_px * scale).
    const line = epipolarLine(F, c1[0] / dino0Scale, c1[1] / dino0Scale);
    const dispLine = scaleLineToDisplay(line, dino1Scale);
    const seg = lineSegmentInRect(dispLine, dino1Grid.w, dino1Grid.h);
    if (!seg) return [] as [number, number][];
    return sampleAlongSegment(seg, 2); // every 2 display px, per spec
  }, [F, c1, dino0Scale, dino1Scale, dino1Grid.w, dino1Grid.h]);

  const scoresBase = useMemo(
    () => scanScores(dino0Grid, dino1Grid, c1, candidates, R),
    [dino0Grid, dino1Grid, c1, candidates]
  );
  const scoresShift = useMemo(
    () => scanScores(dino0Grid, shiftedGrid, c1, candidates, R),
    [dino0Grid, shiftedGrid, c1, candidates]
  );
  const scores = shiftOn ? scoresShift : scoresBase;

  const runIdRef = useRef(0);
  const sweepStartRef = useRef(0);
  useEffect(() => {
    runIdRef.current++;
    const id = runIdRef.current;
    setRevealIdx(0);
    sweepStartRef.current = performance.now();
    let raf = 0;
    const tick = () => {
      if (runIdRef.current !== id) return;
      const t = Math.min(1, (performance.now() - sweepStartRef.current) / SWEEP_MS);
      const idx = Math.floor(t * candidates.length);
      setRevealIdx(idx);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [candidates, shiftOn]);

  const done = revealIdx >= candidates.length;

  const canvas0Ref = useRef<HTMLCanvasElement | null>(null);
  const canvas1Ref = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<HTMLCanvasElement | null>(null);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvas0Ref.current;
    if (!canvas) return;
    const [x, y] = toNaturalXY(canvas, e.clientX, e.clientY, dino0Grid.w);
    const xi = Math.round(clamp(x, R + 1, dino0Grid.w - R - 2));
    const yi = Math.round(clamp(y, R + 1, dino0Grid.h - R - 2));
    setC1([xi, yi]);
  }

  // dino0: base image + patch outline
  useEffect(() => {
    const canvas = canvas0Ref.current;
    if (!canvas) return;
    const { ctx } = setupImageCanvas(canvas, dino0Grid.w, dino0Grid.h, dino0Scale);
    ctx.clearRect(0, 0, dino0Grid.w, dino0Grid.h);
    ctx.drawImage(dino0Img, 0, 0, dino0Grid.w, dino0Grid.h);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2 / dino0Scale;
    ctx.strokeRect(c1[0] - R, c1[1] - R, 2 * R + 1, 2 * R + 1);
  }, [dino0Img, dino0Grid, dino0Scale, c1]);

  // dino1: candidates, sweeping window, best markers
  useEffect(() => {
    const canvas = canvas1Ref.current;
    if (!canvas) return;
    let raf = 0;
    const draw = () => {
      const { ctx } = setupImageCanvas(canvas, dino1Grid.w, dino1Grid.h, dino1Scale);
      ctx.clearRect(0, 0, dino1Grid.w, dino1Grid.h);
      ctx.drawImage(dino1Img, 0, 0, dino1Grid.w, dino1Grid.h);
      ctx.fillStyle = "rgba(124,58,237,0.55)";
      for (let i = 0; i < revealIdx && i < candidates.length; i++) {
        const [cx, cy] = candidates[i];
        ctx.fillRect(cx - 1 / dino1Scale, cy - 1 / dino1Scale, 2 / dino1Scale, 2 / dino1Scale);
      }
      const isDone = revealIdx >= candidates.length && candidates.length > 0;
      if (!isDone && revealIdx < candidates.length && candidates.length > 0) {
        const [cx, cy] = candidates[revealIdx];
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2 / dino1Scale;
        ctx.strokeRect(cx - R, cy - R, 2 * R + 1, 2 * R + 1);
        raf = requestAnimationFrame(draw);
      }
      if (isDone) {
        const drawMark = (idx: number, color: string, label: string) => {
          if (idx < 0 || idx >= candidates.length) return;
          const [cx, cy] = candidates[idx];
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(cx, cy - 8 / dino1Scale);
          ctx.lineTo(cx + 8 / dino1Scale, cy);
          ctx.lineTo(cx, cy + 8 / dino1Scale);
          ctx.lineTo(cx - 8 / dino1Scale, cy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = color;
          ctx.font = `${11 / dino1Scale}px sans-serif`;
          ctx.fillText(label, cx + 10 / dino1Scale, cy - 10 / dino1Scale);
        };
        drawMark(scores.bestSsd, "#f97316", "SSD");
        drawMark(scores.bestNcc, "#22c55e", "NCC");
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [candidates, revealIdx, scores, dino1Img, dino1Grid, dino1Scale]);

  // score curves
  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || candidates.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.round(dino1Grid.w * dino1Scale);
    const cssH = 84;
    canvas.style.display = "block";
    const needW = Math.round(cssW * dpr);
    const needH = Math.round(cssH * dpr);
    if (canvas.width !== needW || canvas.height !== needH) {
      canvas.width = needW;
      canvas.height = needH;
    }
    canvas.style.width = `${cssW}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const n = candidates.length;
    const shown = Math.max(1, Math.min(n, revealIdx));
    const finite = (arr: number[]) => arr.filter((v) => Number.isFinite(v));
    const ssdVals = finite(scores.ssd);
    const nccVals = finite(scores.ncc);
    const ssdMin = ssdVals.length ? Math.min(...ssdVals) : 0;
    const ssdMax = ssdVals.length ? Math.max(...ssdVals) : 1;
    const nccMin = nccVals.length ? Math.min(...nccVals) : 0;
    const nccMax = nccVals.length ? Math.max(...nccVals) : 1;

    const plot = (getY: (i: number) => number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < shown; i++) {
        const y = getY(i);
        if (!Number.isFinite(y)) continue;
        const x = (i / Math.max(1, n - 1)) * cssW;
        const py = 6 + (1 - y) * (cssH - 12);
        if (!started) {
          ctx.moveTo(x, py);
          started = true;
        } else ctx.lineTo(x, py);
      }
      ctx.stroke();
    };
    // SSD, inverted so up = better
    plot((i) => (ssdMax > ssdMin ? 1 - (scores.ssd[i] - ssdMin) / (ssdMax - ssdMin) : 0.5), "#f97316");
    // NCC, raw (not inverted) — just autoscaled to fit the chart
    plot((i) => (nccMax > nccMin ? (scores.ncc[i] - nccMin) / (nccMax - nccMin) : 0.5), "#22c55e");
  }, [candidates, revealIdx, scores, dino1Grid.w, dino1Scale]);

  const shiftCallout = useMemo(() => {
    if (!done || candidates.length === 0) return null;
    const sameSsd = scoresBase.bestSsd === scoresShift.bestSsd;
    const sameNcc = scoresBase.bestNcc === scoresShift.bestNcc;
    return { sameSsd, sameNcc };
  }, [done, candidates.length, scoresBase, scoresShift]);

  return (
    <div className="vsPanel vsEpPanel">
      <div className="vsRow" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 className="vsEpH3">C. SSD vs NCC race</h3>
        <span className="vsRow" style={{ gap: 8 }}>
          <span className="vsChip">mirrors ssd_match()</span>
          <span className="vsChip">mirrors ncc_match()</span>
        </span>
      </div>
      <div className="vsRow" style={{ marginTop: 8 }}>
        <button type="button" className="vsBtn" data-active={shiftOn} onClick={() => setShiftOn((v) => !v)}>
          brightness shift (+0.15 on dino1)
        </button>
        <span className="vsNote" style={{ margin: 0, flex: "1 1 260px" }}>
          Click a spot on dino0 to move the patch (R={R}); candidates walk the epipolar line in dino1.
        </span>
      </div>

      <div className="vsEpRow">
        <div className="vsEpCanvasWrap">
          <canvas ref={canvas0Ref} className="vsEpCanvas" onClick={handleClick} />
          <div className="vsEpCaption">dino0.jpg &mdash; click to place the patch</div>
        </div>
        <div className="vsEpCanvasWrap">
          <canvas ref={canvas1Ref} className="vsEpCanvas" />
          <canvas ref={chartRef} className="vsEpChart" />
          <div className="vsEpCaption">
            dino1.jpg &mdash; <span style={{ color: "#f97316" }}>SSD</span> (inverted, up=better) vs{" "}
            <span style={{ color: "#22c55e" }}>NCC</span> (raw)
          </div>
        </div>
      </div>

      {shiftOn && shiftCallout && (
        <p className="vsNote">
          With +0.15 added to every dino1 pixel: NCC&apos;s winner{" "}
          {shiftCallout.sameNcc ? "stayed on the same candidate" : "moved"} (its per-window mean subtraction cancels a
          uniform offset), while SSD&apos;s winner{" "}
          {shiftCallout.sameSsd ? "happened to hold" : "slid to a different candidate"} &mdash; raw squared-difference
          has no such invariance.
        </p>
      )}
    </div>
  );
}
