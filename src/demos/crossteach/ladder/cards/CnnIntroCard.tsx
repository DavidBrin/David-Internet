"use client";

/**
 * 4.1 CNN Introduction -- explanation card. Visualizes convolution as a
 * sliding kernel: a 3x3 window walks a fixed 8x8 input grid, each stop
 * lighting one cell of the 6x6 feature map beside it. Time-driven (no state
 * refs to manage), so it auto-loops slowly from mount with no button needed.
 */
import { useEffect, useRef } from "react";
import { CardShell, Illustration } from "./CardShell";

const IN = 8;
const OUT = IN - 2; // 3x3 kernel, stride 1, no padding
const CELL = 14;
const GAP = 26;
const STEP_MS = 550;

const KERNEL = [
  [-1, -1, -1],
  [-1, 8, -1],
  [-1, -1, -1],
];

const INPUT: number[][] = Array.from({ length: IN }, (_, y) =>
  Array.from({ length: IN }, (_, x) => (Math.sin(x * 1.3 + y * 0.9) + 1) / 2),
);

function convAt(oy: number, ox: number): number {
  let s = 0;
  for (let ky = 0; ky < 3; ky++) {
    for (let kx = 0; kx < 3; kx++) s += INPUT[oy + ky][ox + kx] * KERNEL[ky][kx];
  }
  return Math.min(1, Math.max(0, s * 0.14 + 0.5));
}

function shade(v: number): string {
  const c = Math.round(v * 255);
  return `rgb(${c},${c},${c})`;
}

export default function CnnIntroCard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = IN * CELL + GAP + OUT * CELL + 8;
    const h = IN * CELL + 8;
    canvas.style.display = "block";
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const outGrid: (number | null)[][] = Array.from({ length: OUT }, () => new Array<number | null>(OUT).fill(null));
    let lastLoop = -1;
    let raf = 0;

    const tick = (now: number) => {
      const total = OUT * OUT;
      const loopIdx = Math.floor(now / STEP_MS);
      const stepIdx = loopIdx % total;
      if (loopIdx !== lastLoop) {
        lastLoop = loopIdx;
        if (stepIdx === 0) {
          for (let y = 0; y < OUT; y++) outGrid[y].fill(null);
        }
        const oy0 = Math.floor(stepIdx / OUT);
        const ox0 = stepIdx % OUT;
        outGrid[oy0][ox0] = convAt(oy0, ox0);
      }
      const oy = Math.floor(stepIdx / OUT);
      const ox = stepIdx % OUT;

      ctx.clearRect(0, 0, w, h);

      for (let y = 0; y < IN; y++) {
        for (let x = 0; x < IN; x++) {
          ctx.fillStyle = shade(INPUT[y][x]);
          ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 1, CELL - 1);
        }
      }
      ctx.strokeStyle = "#14b8a6";
      ctx.lineWidth = 2;
      ctx.strokeRect(ox * CELL + 1, oy * CELL + 1, 3 * CELL, 3 * CELL);

      const offX = IN * CELL + GAP;
      for (let y = 0; y < OUT; y++) {
        for (let x = 0; x < OUT; x++) {
          const v = outGrid[y][x];
          ctx.fillStyle = v === null ? "#e4ede9" : shade(v);
          ctx.fillRect(offX + x * CELL + 2, y * CELL + 2, CELL - 1, CELL - 1);
          if (v === null) {
            ctx.strokeStyle = "#c9d9d3";
            ctx.lineWidth = 1;
            ctx.strokeRect(offX + x * CELL + 2, y * CELL + 2, CELL - 1, CELL - 1);
          }
        }
      }
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(offX + ox * CELL + 1, oy * CELL + 1, CELL, CELL);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <CardShell week="4.1" title="CNN Introduction">
      <p className="ctLBody">
        A convolution slides a small learned kernel across the image, taking a weighted
        sum of each 3x3 neighborhood to build one cell of the feature map. The
        highlighted window on the left is the kernel&apos;s current position; the cell it
        just produced lights up on the right.
      </p>
      <canvas
        ref={canvasRef}
        className="ctLKernelCanvas"
        role="img"
        aria-label="3x3 kernel sliding over an 8x8 grid producing a feature map"
      />
      <Illustration>
        illustration -- a fixed demo kernel and pattern, not weights from the notebook
      </Illustration>
    </CardShell>
  );
}
