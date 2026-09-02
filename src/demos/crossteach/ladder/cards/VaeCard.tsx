"use client";

/**
 * 7.2 Variational autoencoder -- explanation card. Left half of the SVG is a
 * static latent-point cloud plus a draggable probe; the right half is a
 * small blob whose wobble is a pure function of the probe's normalized
 * position, so dragging morphs it smoothly. Purely a geometric illustration
 * of "moving through latent space changes the decode" -- not a real decoder.
 */
import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CardShell, Illustration } from "./CardShell";

const PLOT_W = 130;
const PLOT_H = 150;
const MARGIN = 10;
const VIEW_W = 300;
const VIEW_H = 160;

function hash(i: number): number {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v); // 0..1
}

const CLOUD = Array.from({ length: 26 }, (_, i) => {
  const a = hash(i) * Math.PI * 2;
  const r = 20 + hash(i + 50) * 55;
  return {
    x: PLOT_W / 2 + Math.cos(a) * r * 0.9,
    y: PLOT_H / 2 + Math.sin(a) * r,
  };
});

function blobPath(nx: number, ny: number, cx: number, cy: number, baseR: number): string {
  const n = 20;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = baseR * (1 + 0.3 * Math.sin(a * 3 + nx * 5) + 0.22 * Math.cos(a * 2 + ny * 5));
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  let d = "";
  for (let i = 0; i <= n; i++) {
    const p0 = pts[i % n];
    const p1 = pts[(i + 1) % n];
    const mid: [number, number] = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    d += i === 0 ? `M ${mid[0]},${mid[1]} ` : `Q ${p0[0]},${p0[1]} ${mid[0]},${mid[1]} `;
  }
  return `${d}Z`;
}

export default function VaeCard() {
  const [probe, setProbe] = useState({ x: PLOT_W / 2, y: PLOT_H / 2 });
  const draggingRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const clientToPlot = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = VIEW_W / rect.width;
    const scaleY = VIEW_H / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    return {
      x: Math.min(PLOT_W - MARGIN, Math.max(MARGIN, x)),
      y: Math.min(PLOT_H - MARGIN, Math.max(MARGIN, y)),
    };
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<SVGCircleElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!draggingRef.current) return;
      const p = clientToPlot(e.clientX, e.clientY);
      if (p) setProbe(p);
    },
    [clientToPlot],
  );
  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const nx = (probe.x / PLOT_W) * 2 - 1;
  const ny = (probe.y / PLOT_H) * 2 - 1;
  const d = blobPath(nx, ny, VIEW_W - 75, 80, 42);

  return (
    <CardShell week="7.2" title="Variational autoencoder">
      <p className="ctLBody">
        A VAE encodes each input as a distribution over the latent space rather than a
        single point, then samples from it with the reparameterization trick so gradients
        can still flow back through the sampling step. Drag the point in the latent cloud
        to see roughly how moving through latent space changes what gets decoded.
      </p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="ctLVaeSvg"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="img"
        aria-label="Draggable latent-space point morphing an illustrative blob shape"
      >
        <line x1={140} y1={0} x2={140} y2={VIEW_H} className="ctLVaeDivider" />
        {CLOUD.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.2} className="ctLVaeDot" />
        ))}
        <path d={d} className="ctLVaeBlob" />
        <circle cx={probe.x} cy={probe.y} r={6} className="ctLVaeProbe" onPointerDown={onPointerDown} />
      </svg>
      <Illustration>
        illustration -- a purely geometric interpolation, not a trained decoder&apos;s output
      </Illustration>
    </CardShell>
  );
}
