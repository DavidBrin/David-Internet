"use client";

/**
 * 3.3 FFN Half Moon -- LIVE. Trains the tiny 2-8-8-1 net from ../ffn.ts on the
 * fetched half-moon points with plain full-batch SGD. The decision-boundary
 * grid is redrawn every ~10 steps; points stay overlaid. Auto-starts on data
 * load (guarded by a run id so a retrain click cleanly supersedes the loop
 * instead of running two in parallel).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CardShell, LiveBadge } from "./CardShell";
import { createNet, predict, trainStep, type Net } from "../ffn";

interface HalfMoonData {
  x: [number, number][];
  y: number[];
}

const STEPS = 300;
const REDRAW_EVERY = 10;
const GRID = 60;
const LR = 1.5;
const CANVAS_W = 280;
const CANVAS_H = 200;

function boundaryColor(p: number): string {
  const r = Math.round(245 + (20 - 245) * p);
  const g = Math.round(158 + (184 - 158) * p);
  const bch = Math.round(11 + (166 - 11) * p);
  return `rgba(${r},${g},${bch},0.32)`;
}

export default function HalfMoonCard() {
  const [data, setData] = useState<HalfMoonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [acc, setAcc] = useState(0);
  const netRef = useRef<Net>(createNet());
  const stepRef = useRef(0);
  const boundsRef = useRef({ minX: -3, maxX: 3, minY: -3, maxY: 3 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const runIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/demos/crossteach/ladder/halfmoon.json")
      .then((r) => {
        if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
        return r.json();
      })
      .then((d: HalfMoonData) => {
        if (cancelled) return;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const [px, py] of d.x) {
          minX = Math.min(minX, px);
          maxX = Math.max(maxX, px);
          minY = Math.min(minY, py);
          maxY = Math.max(maxY, py);
        }
        const padX = (maxX - minX) * 0.15 || 0.5;
        const padY = (maxY - minY) * 0.15 || 0.5;
        boundsRef.current = { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
        setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const drawFrame = useCallback((data0: HalfMoonData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const net = netRef.current;
    const { minX, maxX, minY, maxY } = boundsRef.current;
    const w = CANVAS_W;
    const h = CANVAS_H;
    const cw = w / GRID;
    const ch = h / GRID;
    ctx.clearRect(0, 0, w, h);
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const px = minX + ((gx + 0.5) / GRID) * (maxX - minX);
        const py = maxY - ((gy + 0.5) / GRID) * (maxY - minY);
        const p = predict(net, [px, py]);
        ctx.fillStyle = boundaryColor(p);
        ctx.fillRect(gx * cw, gy * ch, cw + 0.6, ch + 0.6);
      }
    }
    for (let i = 0; i < data0.x.length; i++) {
      const [px, py] = data0.x[i];
      const sx = ((px - minX) / (maxX - minX)) * w;
      const sy = h - ((py - minY) / (maxY - minY)) * h;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = data0.y[i] === 1 ? "#0f766e" : "#b45309";
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.stroke();
    }
  }, []);

  const runTraining = useCallback(
    (data0: HalfMoonData, myRunId: number) => {
      const dpr = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.display = "block";
        canvas.width = Math.floor(CANVAS_W * dpr);
        canvas.height = Math.floor(CANVAS_H * dpr);
        canvas.style.width = `${CANVAS_W}px`;
        canvas.style.height = `${CANVAS_H}px`;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      drawFrame(data0);

      const tick = () => {
        if (runIdRef.current !== myRunId) return;
        if (!document.hidden && stepRef.current < STEPS) {
          trainStep(netRef.current, data0.x, data0.y, LR);
          stepRef.current += 1;
          if (stepRef.current % REDRAW_EVERY === 0 || stepRef.current === STEPS) {
            drawFrame(data0);
            let correct = 0;
            for (let i = 0; i < data0.x.length; i++) {
              const pred = predict(netRef.current, data0.x[i]) >= 0.5 ? 1 : 0;
              if (pred === data0.y[i]) correct++;
            }
            setStep(stepRef.current);
            setAcc(correct / data0.x.length);
          }
        }
        if (stepRef.current < STEPS) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [drawFrame],
  );

  useEffect(() => {
    if (!data) return;
    cancelAnimationFrame(rafRef.current);
    runIdRef.current += 1;
    runTraining(data, runIdRef.current);
    return () => cancelAnimationFrame(rafRef.current);
  }, [data, runTraining]);

  const handleRetrain = useCallback(() => {
    if (!data) return;
    netRef.current = createNet();
    stepRef.current = 0;
    setStep(0);
    setAcc(0);
    cancelAnimationFrame(rafRef.current);
    runIdRef.current += 1;
    runTraining(data, runIdRef.current);
  }, [data, runTraining]);

  return (
    <CardShell week="3.3" title="FFN Half Moon">
      <LiveBadge />
      <p className="ctLBody">
        A 2-8-8-1 network (tanh hidden layers, sigmoid output) trains by plain stochastic
        gradient descent -- no ML library, forward pass and the backward chain rule are
        both written out in TypeScript -- on the standardized two-moons set (240 points,
        noise 0.25).
      </p>
      {error && <p className="ctNote">could not load halfmoon.json: {error}</p>}
      {!data && !error && <p className="ctNote">loading half-moon points&hellip;</p>}
      {data && (
        <>
          <div className="ctLCanvasWrap">
            <canvas
              ref={canvasRef}
              className="ctLCanvas"
              role="img"
              aria-label="Decision boundary and half-moon points"
            />
          </div>
          <div className="ctRow">
            <button type="button" className="ctBtn" onClick={handleRetrain}>
              retrain
            </button>
            <span className="ctNote ctMono">
              step {step}/{STEPS} &middot; accuracy {(acc * 100).toFixed(0)}%
            </span>
          </div>
        </>
      )}
    </CardShell>
  );
}
