"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { LANE_PARAMS } from "../core/params";
import { VEHICLE } from "../core/sim";
import type { World } from "../core/world";
import { bakeRows, cropFootprint, cteColor, makeCanvas, VIEW, VIEW_ASPECT } from "./geometry";
import type { DriveEngine } from "./useDriveSim";
import { useSizedCanvas } from "./useSizedCanvas";

interface Props {
  world: World;
  engine: DriveEngine;
  follow: boolean;
}

/** metres of lot across the canvas in "Follow car" */
const FOLLOW_SPAN = 8;
const COARSE = 0.05;
const FINE = 0.025;
const MONO = "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export default function LotView({ world, engine, follow }: Props) {
  const texRef = useRef<{ canvas: HTMLCanvasElement; res: number } | null>(null);
  const followRef = useRef(follow);
  followRef.current = follow;
  const foot = useMemo(() => cropFootprint(LANE_PARAMS), []);
  const start = useMemo(() => world.pointAt(0), [world]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const sim = engine.simRef.current;
      ctx.fillStyle = "#6f8a45";
      ctx.fillRect(0, 0, w, h);

      // ---- view transform (north up)
      let vx0: number, vy1: number, k: number;
      if (followRef.current && sim) {
        k = w / FOLLOW_SPAN;
        // centre a little ahead of the car so the camera footprint is in view
        const cx = sim.pose.x + Math.cos(sim.pose.th) * 0.9;
        const cy = sim.pose.y + Math.sin(sim.pose.th) * 0.9;
        vx0 = cx - w / k / 2;
        vy1 = cy + h / k / 2;
      } else {
        k = Math.min(w / (VIEW.x1 - VIEW.x0), h / (VIEW.y1 - VIEW.y0));
        vx0 = VIEW.x0 - (w / k - (VIEW.x1 - VIEW.x0)) / 2;
        vy1 = VIEW.y1 + (h / k - (VIEW.y1 - VIEW.y0)) / 2;
      }
      const sx = (x: number) => (x - vx0) * k;
      const sy = (y: number) => (vy1 - y) * k;

      const tex = texRef.current;
      if (tex) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(tex.canvas, sx(VIEW.x0), sy(VIEW.y1), (VIEW.x1 - VIEW.x0) * k, (VIEW.y1 - VIEW.y0) * k);
      }

      // ---- start / finish line across the tape
      {
        const nx = -Math.sin(start.th),
          ny = Math.cos(start.th);
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = Math.max(2, 0.06 * k);
        ctx.setLineDash([Math.max(3, 0.08 * k), Math.max(3, 0.08 * k)]);
        ctx.beginPath();
        ctx.moveTo(sx(start.x + nx * 0.45), sy(start.y + ny * 0.45));
        ctx.lineTo(sx(start.x - nx * 0.45), sy(start.y - ny * 0.45));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (!sim) return;

      // ---- trail coloured by |CTE|, batched by colour bin
      const trail = engine.trailRef.current;
      ctx.lineWidth = followRef.current ? 3 : Math.max(1.6, 0.05 * k);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      let i = 1;
      while (i < trail.length) {
        const bin = Math.min(10, Math.round(trail[i].c / 0.02));
        ctx.strokeStyle = cteColor(bin * 0.02);
        ctx.beginPath();
        ctx.moveTo(sx(trail[i - 1].x), sy(trail[i - 1].y));
        while (i < trail.length && Math.min(10, Math.round(trail[i].c / 0.02)) === bin) {
          const a = trail[i - 1],
            b = trail[i];
          if (Math.hypot(b.x - a.x, b.y - a.y) > 0.5) ctx.moveTo(sx(b.x), sy(b.y));
          else ctx.lineTo(sx(b.x), sy(b.y));
          i++;
        }
        ctx.stroke();
      }

      // ---- car frame: x forward, y left, metres
      const p = sim.pose;
      // in the whole-lot view the 1/10-scale car would be ~4 px long; draw it at least 18 px
      const carK = followRef.current ? k : Math.max(k, 18 / 0.5);
      ctx.save();
      ctx.translate(sx(p.x), sy(p.y));
      ctx.scale(carK, -carK);
      ctx.rotate(p.th);

      if (followRef.current) {
        // camera's lane crop on the ground
        ctx.fillStyle = "rgba(234,179,8,0.26)";
        ctx.strokeStyle = "rgba(250,204,21,0.95)";
        ctx.lineWidth = 1.5 / carK;
        ctx.beginPath();
        foot.corners.forEach(([fx, fy], j) => (j ? ctx.lineTo(fx, fy) : ctx.moveTo(fx, fy)));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // camera_centerline (0.55) through the band
        ctx.setLineDash([4 / carK, 3 / carK]);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.moveTo(foot.center[0][0], foot.center[0][1]);
        ctx.lineTo(foot.center[1][0], foot.center[1][1]);
        ctx.stroke();
        ctx.setLineDash([]);
        // rays from the camera to the band's near corners
        ctx.strokeStyle = "rgba(250,204,21,0.45)";
        ctx.lineWidth = 1 / carK;
        ctx.beginPath();
        ctx.moveTo(0.12, 0);
        ctx.lineTo(foot.corners[2][0], foot.corners[2][1]);
        ctx.moveTo(0.12, 0);
        ctx.lineTo(foot.corners[3][0], foot.corners[3][1]);
        ctx.stroke();
      } else {
        // halo so the car can be found on the whole lot
        ctx.fillStyle = "rgba(250,204,21,0.28)";
        ctx.beginPath();
        ctx.arc(0.16, 0, 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      // wheels (rear axle at the reference point, front axle 0.33 m ahead)
      const delta = -sim.steer * VEHICLE.maxWheel;
      const wheel = (x: number, y: number, a: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = "#0b0c0d";
        ctx.fillRect(-0.055, -0.025, 0.11, 0.05);
        ctx.restore();
      };
      wheel(0, 0.125, 0);
      wheel(0, -0.125, 0);
      wheel(VEHICLE.wheelbase, 0.125, delta);
      wheel(VEHICLE.wheelbase, -0.125, delta);
      // body shell
      ctx.fillStyle = "#f4f4f1";
      ctx.strokeStyle = "#1f2328";
      ctx.lineWidth = 1.2 / carK;
      ctx.beginPath();
      ctx.roundRect(-0.08, -0.1, 0.5, 0.2, 0.05);
      ctx.fill();
      ctx.stroke();
      // safety-yellow stripe and dark cabin
      ctx.fillStyle = "#eab308";
      ctx.fillRect(-0.06, -0.018, 0.46, 0.036);
      ctx.fillStyle = "#26282b";
      ctx.beginPath();
      ctx.roundRect(0.02, -0.07, 0.17, 0.14, 0.03);
      ctx.fill();
      // OAK-D on the nose
      ctx.fillStyle = "#2563eb";
      ctx.fillRect(0.1, -0.035, 0.04, 0.07);
      ctx.restore();

      // ---- legend
      const lx = 10,
        ly = h - 12;
      ctx.font = MONO;
      ctx.textBaseline = "middle";
      const label = "trail |CTE|";
      ctx.fillStyle = "rgba(17,19,21,0.72)";
      ctx.beginPath();
      ctx.roundRect(lx - 6, ly - 11, 226, 22, 6);
      ctx.fill();
      ctx.fillStyle = "#e6e6e3";
      ctx.fillText(label, lx, ly);
      const gx = lx + 92;
      const grad = ctx.createLinearGradient(gx, 0, gx + 70, 0);
      grad.addColorStop(0, cteColor(0));
      grad.addColorStop(0.5, cteColor(0.1));
      grad.addColorStop(1, cteColor(0.2));
      ctx.fillStyle = grad;
      ctx.fillRect(gx, ly - 3, 70, 6);
      ctx.fillStyle = "#e6e6e3";
      ctx.fillText("0", gx - 11, ly);
      ctx.fillText("20+ cm", gx + 75, ly);
    },
    [engine, foot, start],
  );

  const { canvasRef, wrapRef, redraw } = useSizedCanvas(draw, (w) => w / VIEW_ASPECT);

  // bake the ground: 5 cm/px at once (~0.5 M samples), then 2.5 cm/px in idle-sized slices
  useEffect(() => {
    let cancelled = false;
    const cw = Math.round((VIEW.x1 - VIEW.x0) / COARSE),
      ch = Math.round((VIEW.y1 - VIEW.y0) / COARSE);
    const coarse = makeCanvas(cw, ch);
    const cctx = coarse.getContext("2d")!;
    const cimg = cctx.createImageData(cw, ch);
    bakeRows(world, cimg, COARSE, 0, ch);
    cctx.putImageData(cimg, 0, 0);
    texRef.current = { canvas: coarse, res: COARSE };
    redraw();

    const fw = Math.round((VIEW.x1 - VIEW.x0) / FINE),
      fh = Math.round((VIEW.y1 - VIEW.y0) / FINE);
    const fine = makeCanvas(fw, fh);
    const fctx = fine.getContext("2d")!;
    const fimg = fctx.createImageData(fw, fh);
    let row = 0;
    let timer = 0;
    const slice = () => {
      if (cancelled) return;
      const t0 = performance.now();
      while (row < fh && performance.now() - t0 < 8) {
        const next = Math.min(fh, row + 8);
        bakeRows(world, fimg, FINE, row, next);
        row = next;
      }
      if (row < fh) {
        timer = window.setTimeout(slice, 16);
      } else {
        fctx.putImageData(fimg, 0, 0);
        texRef.current = { canvas: fine, res: FINE };
        redraw();
      }
    };
    timer = window.setTimeout(slice, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [world, redraw]);

  useEffect(() => {
    const bus = engine.bus.current;
    bus.add(redraw);
    return () => {
      bus.delete(redraw);
    };
  }, [engine.bus, redraw]);

  useEffect(() => {
    redraw();
  }, [follow, redraw]);

  return (
    <div ref={wrapRef} className="acDrLot">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Top-down view of the taped lot with the simulated car, its trail and the camera's lane crop"
      />
    </div>
  );
}
