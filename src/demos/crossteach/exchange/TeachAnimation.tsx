"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { TeachPhase } from "./types";

interface Rect {
  x: number;
  y: number;
}

interface Props {
  wrapRef: RefObject<HTMLDivElement | null>;
  vitColRef: RefObject<HTMLDivElement | null>;
  unetColRef: RefObject<HTMLDivElement | null>;
  phase: TeachPhase;
  t: number; // 0..1 progress within the current phase
  vitOverlay: HTMLCanvasElement | null; // vit prediction masked by conf >= threshold
  unetOverlay: HTMLCanvasElement | null; // unet prediction masked by conf >= threshold
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Overlay animation for the pseudo-label exchange: a confident prediction
 * lifts off one column, floats to the other while re-scaling across the
 * 224/512 gap, and lands as a ghost overlay. Purely visual (absolutely
 * positioned inside the panel's own relative wrapper) - never touches page
 * scroll. Rendered inside ctXColumns (position: relative).
 */
export default function TeachAnimation({ wrapRef, vitColRef, unetColRef, phase, t, vitOverlay, unetOverlay }: Props) {
  const ghostCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const flightRef = useRef<{ src: Rect; dst: Rect } | null>(null);

  const isMove = phase === "vit-to-unet" || phase === "unet-to-vit";
  const isSkip = phase === "vit-skip" || phase === "unet-skip";
  const active = isMove || isSkip;
  const forward = phase === "vit-to-unet" || phase === "vit-skip"; // vit is the source

  // Measure column centers once per phase start (positions can change with layout).
  useEffect(() => {
    if (!active) {
      flightRef.current = null;
      return;
    }
    const wrap = wrapRef.current;
    const vitEl = vitColRef.current;
    const unetEl = unetColRef.current;
    if (!wrap || !vitEl || !unetEl) return;
    const wrapRect = wrap.getBoundingClientRect();
    const vitRect = vitEl.getBoundingClientRect();
    const unetRect = unetEl.getBoundingClientRect();
    const vit: Rect = { x: vitRect.left - wrapRect.left + vitRect.width / 2, y: vitRect.top - wrapRect.top + vitRect.height / 2 };
    const unet: Rect = { x: unetRect.left - wrapRect.left + unetRect.width / 2, y: unetRect.top - wrapRect.top + unetRect.height / 2 };
    flightRef.current = forward ? { src: vit, dst: unet } : { src: unet, dst: vit };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Draw the ghost's frozen content once per move-phase start.
  useEffect(() => {
    const canvas = ghostCanvasRef.current;
    if (!canvas || !isMove) return;
    const src = phase === "vit-to-unet" ? vitOverlay : unetOverlay;
    if (!src) return;
    const dpr = window.devicePixelRatio || 1;
    const size = 84;
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.style.display = "block";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, size, size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!active) return null;

  const flight = flightRef.current;

  if (isSkip) {
    const anchor = flight ? (forward ? flight.src : flight.dst) : null;
    const opacity = t < 0.15 ? t / 0.15 : t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1;
    return (
      <div className="ctXTeachLayer" aria-hidden="true">
        {anchor && (
          <div className="ctXFlash" style={{ left: anchor.x, top: anchor.y, opacity }}>
            below gate - no teaching
          </div>
        )}
      </div>
    );
  }

  if (!flight) return null;
  const ease = easeInOutQuad(t);
  const x = flight.src.x + (flight.dst.x - flight.src.x) * ease;
  const lift = Math.sin(Math.min(1, t) * Math.PI) * 30;
  const y = flight.src.y + (flight.dst.y - flight.src.y) * ease - lift;
  const scale = phase === "vit-to-unet" ? 1 + ease * 1.2 : 1 - ease * 0.55;
  const opacity = t < 0.08 ? t / 0.08 : t > 0.85 ? Math.max(0.15, (1 - t) / 0.15) : 1;
  const label = phase === "vit-to-unet" ? "upsample x2.3" : "downsample";
  const landingLabel = phase === "vit-to-unet" ? "pseudo-label for U-Net" : "pseudo-label for ViT";
  const showLanding = t > 0.8;
  const landingOpacity = t > 0.8 ? Math.min(1, (t - 0.8) / 0.15) : 0;
  const consistencyPct = Math.round(t * 100);

  return (
    <div className="ctXTeachLayer" aria-hidden="true">
      <div className="ctXGhost" style={{ left: x, top: y, opacity, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <canvas ref={ghostCanvasRef} className="ctXGhostCanvas" />
        <span className="ctXGhostLabel">{label}</span>
      </div>
      {showLanding && (
        <div className="ctXLanding" style={{ left: flight.dst.x, top: flight.dst.y, opacity: landingOpacity }}>
          {landingLabel}
        </div>
      )}
      <div className="ctXConsistency">
        <div className="ctXConsistencyTrack">
          <div className="ctXConsistencyFill" style={{ width: `${consistencyPct}%` }} />
        </div>
        <span className="ctXConsistencyLabel">x 0.05 consistency weight</span>
      </div>
    </div>
  );
}
