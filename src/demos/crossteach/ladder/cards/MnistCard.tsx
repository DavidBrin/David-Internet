"use client";

/**
 * 3.4 FFN MNIST -- explanation card, not live. The notebook scales the 3.3
 * recipe to 784-10; here that is sketched, not run: a 28x28 digit rendered
 * procedurally (a bold glyph rasterized and thresholded, not a real MNIST
 * sample) plus a bar strip of ten output-probability bars that rises to a
 * peak once on mount via a CSS-driven height transition.
 */
import { useEffect, useRef, useState } from "react";
import { CardShell, Illustration } from "./CardShell";

const SIZE = 28;
const CELL = 5;
const DIGIT = "5";

function buildDigitGrid(digit: string, size: number): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;
  const octx = off.getContext("2d");
  if (!octx) return grid;
  octx.fillStyle = "#000";
  octx.fillRect(0, 0, size, size);
  octx.fillStyle = "#fff";
  octx.font = `bold ${Math.floor(size * 0.86)}px sans-serif`;
  octx.textAlign = "center";
  octx.textBaseline = "middle";
  octx.fillText(digit, size / 2, size / 2 + 1);
  const data = octx.getImageData(0, 0, size, size).data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      grid[y][x] = data[(y * size + x) * 4] > 120;
    }
  }
  return grid;
}

// Illustrative, hand-set: peaks at the "5" the digit sketch draws.
const PROBS = [0.02, 0.03, 0.03, 0.05, 0.04, 0.72, 0.03, 0.02, 0.04, 0.02];
const PEAK_IDX = PROBS.indexOf(Math.max(...PROBS));

export default function MnistCard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const px = SIZE * CELL;
    canvas.style.display = "block";
    canvas.width = Math.floor(px * dpr);
    canvas.height = Math.floor(px * dpr);
    canvas.style.width = `${px}px`;
    canvas.style.height = `${px}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grid = buildDigitGrid(DIGIT, SIZE);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        ctx.fillStyle = grid[y][x] ? "#0f766e" : "#eaf3f1";
        ctx.fillRect(x * CELL, y * CELL, CELL - 0.5, CELL - 0.5);
      }
    }
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <CardShell week="3.4" title="FFN MNIST">
      <p className="ctLBody">
        The same recipe as 3.3, scaled up: a 784-10 feed-forward net with two hidden
        layers, one input unit per pixel, softmax over the ten digit classes. This card
        does not run the network -- it sketches what one forward pass looks like.
      </p>
      <div className="ctRow ctLMnistRow">
        <canvas
          ref={canvasRef}
          className="ctLDigitCanvas"
          role="img"
          aria-label={`Procedurally rendered ${SIZE}x${SIZE} digit sketch`}
        />
        <div className="ctLBars">
          {PROBS.map((p, i) => (
            <div key={i} className="ctLBarCol">
              <div className="ctLBarTrack">
                <div
                  className={`ctLBar${i === PEAK_IDX ? " ctLBarPeak" : ""}`}
                  style={{ height: grown ? `${Math.round(p * 100)}%` : "0%", transitionDelay: `${i * 55}ms` }}
                />
              </div>
              <span className="ctLBarLabel">{i}</span>
            </div>
          ))}
        </div>
      </div>
      <Illustration>
        illustration -- a procedurally sketched digit and a hand-set probability bar, not
        a real inference
      </Illustration>
    </CardShell>
  );
}
