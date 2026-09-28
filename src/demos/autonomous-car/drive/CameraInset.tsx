"use client";

import { useCallback, useEffect, useRef } from "react";
import { CAMERA, renderCamera, type CameraModel } from "../core/camera";
import type { LaneResult } from "../core/lane";
import type { CarSim } from "../core/sim";
import { makeCanvas } from "./geometry";
import type { DriveEngine } from "./useDriveSim";
import { useSizedCanvas } from "./useSizedCanvas";

interface Props {
  engine: DriveEngine;
}

/** Display copy of the OAK-D view at half resolution (the lane crop itself is the node's real input). */
const HALF: CameraModel = { ...CAMERA, W: CAMERA.W / 2, H: CAMERA.H / 2, f: CAMERA.f / 2 };
const REFRESH_MS = 200;
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export default function CameraInset({ engine }: Props) {
  const snap = useRef<{
    bg: HTMLCanvasElement;
    band: HTMLCanvasElement;
    lane: LaneResult | null;
    seq: number;
    sim: CarSim | null;
    at: number;
    hz: number;
  } | null>(null);
  const bgImg = useRef<ImageData | null>(null);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = "#111315";
    ctx.fillRect(0, 0, w, h);
    const s = snap.current;
    if (!s) return;
    const k = w / CAMERA.W;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s.bg, 0, 0, w, h);
    const lane = s.lane;
    if (!lane) return;
    const c = lane.crop;
    // the node's own crop pixels on top of the half-res backdrop
    ctx.drawImage(s.band, c.x0 * k, c.y0 * k, (c.x1 - c.x0) * k, (c.y1 - c.y0) * k);
    // dim everything outside the crop band
    ctx.fillStyle = "rgba(10,11,12,0.38)";
    ctx.fillRect(0, 0, w, c.y0 * k);
    ctx.fillRect(0, c.y1 * k, w, h - c.y1 * k);
    ctx.fillRect(0, c.y0 * k, c.x0 * k, (c.y1 - c.y0) * k);
    ctx.fillRect(c.x1 * k, c.y0 * k, w - c.x1 * k, (c.y1 - c.y0) * k);

    const X = (x: number) => (c.x0 + x) * k;
    const Y = (y: number) => (c.y0 + y) * k;
    // contours: green passed the width filter, red did not
    ctx.lineWidth = 1;
    for (const ct of lane.contours) {
      if (ct.pts.length < 2) continue;
      ctx.strokeStyle = ct.pass ? "rgba(74,222,128,0.9)" : "rgba(248,113,113,0.85)";
      ctx.beginPath();
      ct.pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
      ctx.closePath();
      ctx.stroke();
    }
    // crop band
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(c.x0 * k, c.y0 * k, (c.x1 - c.x0) * k, (c.y1 - c.y0) * k);
    // threshold lines (error_threshold of the lane node) and the 0.55 centre line
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const tx of lane.threshX) {
      ctx.moveTo(X(tx), Y(0));
      ctx.lineTo(X(tx), Y(lane.height));
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(X(lane.centerX), Y(-18));
    ctx.lineTo(X(lane.centerX), Y(lane.height + 18));
    ctx.stroke();
    ctx.setLineDash([]);

    // centroids and the tracked target with its error line
    for (const ct of lane.contours) {
      if (ct.cx === undefined || ct.cy === undefined) continue;
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(X(ct.cx), Y(ct.cy), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const d = lane.decision;
    if (d.kind !== "none") {
      const [tx, ty] = d.target;
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(X(lane.centerX), Y(ty));
      ctx.lineTo(X(tx), Y(ty));
      ctx.stroke();
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "#111315";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(X(tx), Y(ty), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // captions
    const fs = w < 360 ? 10.5 : 12;
    ctx.font = `${fs}px ${MONO}`;
    ctx.textBaseline = "top";
    const text =
      d.kind === "none" ? "/centroid: nothing detected, no message" : `/centroid e = ${d.error >= 0 ? "+" : ""}${d.error.toFixed(3)}  (${d.kind})`;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(17,19,21,0.78)";
    ctx.fillRect(6, 6, tw + 12, fs + 8);
    ctx.fillStyle = d.kind === "none" ? "#fca5a5" : "#facc15";
    ctx.fillText(text, 12, 10);
    const foot = `OAK-D ${CAMERA.W}x${CAMERA.H} · frame ${s.seq} · ${s.hz} Hz · shown at 5 Hz`;
    ctx.font = `${fs - 1}px ${MONO}`;
    const fw = ctx.measureText(foot).width;
    ctx.fillStyle = "rgba(17,19,21,0.7)";
    ctx.fillRect(6, h - fs - 12, fw + 12, fs + 6);
    ctx.fillStyle = "#cfd2d6";
    ctx.fillText(foot, 12, h - fs - 9);
  }, []);

  const { canvasRef, wrapRef, redraw } = useSizedCanvas(draw, (w) => (w * CAMERA.H) / CAMERA.W);

  /** Copy the last camera frame (pose-synchronised) into the display buffers. */
  const refresh = useCallback(
    (force: boolean) => {
      const sim = engine.simRef.current;
      const pose = engine.framePoseRef.current;
      if (!sim || !pose) return false;
      const now = performance.now();
      const s = snap.current;
      if (!force && s && s.sim === sim && (s.seq === sim.frameSeq || now - s.at < REFRESH_MS)) return false;
      const lane = sim.lastLane;
      const bg = s?.bg ?? makeCanvas(HALF.W, HALF.H);
      const img0 = bgImg.current ?? (bgImg.current = new ImageData(HALF.W, HALF.H));
      renderCamera(sim.world, pose, img0.data, HALF, { seed: sim.frameSeq });
      bg.getContext("2d")!.putImageData(img0, 0, 0);
      let band = s?.band ?? null;
      if (lane) {
        const c = lane.crop;
        const bw = c.x1 - c.x0,
          bh = c.y1 - c.y0;
        if (!band || band.width !== bw || band.height !== bh) band = makeCanvas(bw, bh);
        const img = new ImageData(bw, bh);
        for (let y = 0; y < bh; y++) {
          const src = ((c.y0 + y) * CAMERA.W + c.x0) * 4;
          img.data.set(sim.frame.subarray(src, src + bw * 4), y * bw * 4);
        }
        band.getContext("2d")!.putImageData(img, 0, 0);
      }
      snap.current = { bg, band: band ?? makeCanvas(1, 1), lane, seq: sim.frameSeq, sim, at: now, hz: sim.cameraHz };
      return true;
    },
    [engine],
  );

  useEffect(() => {
    const bus = engine.bus.current;
    const tick = () => {
      if (refresh(false)) redraw();
    };
    bus.add(tick);
    if (refresh(true)) redraw();
    return () => {
      bus.delete(tick);
    };
  }, [engine.bus, refresh, redraw]);

  return (
    <div ref={wrapRef} className="acDrCam acScreen">
      <canvas ref={canvasRef} role="img" aria-label="Onboard camera frame with the lane node's crop band, threshold lines and tracked centroid" />
    </div>
  );
}
