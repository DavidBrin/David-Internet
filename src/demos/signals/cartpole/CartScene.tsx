"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { fitCanvas } from "./canvasUtil";
import type { State4 } from "./model";

interface Props {
  stateRef: MutableRefObject<State4>;
  cameraRef: MutableRefObject<number>;
  fell: boolean;
  nonlinear: boolean;
}

const PX_PER_M = 90;
const GROUND_Y_FRAC = 0.74;
const CART_W = 62;
const CART_H = 24;
const WHEEL_R = 7;
const STICK_LEN_PX = 128;
const INK = "#202124";
const MUTED = "#5f6368";

export default function CartScene({ stateRef, cameraRef, fell, nonlinear }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fellRef = useRef(fell);
  fellRef.current = fell;
  const nonlinearRef = useRef(nonlinear);
  nonlinearRef.current = nonlinear;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const fit = fitCanvas(canvas, wrap.clientWidth, wrap.clientHeight);
    if (!fit) return;
    const { ctx, W, H } = fit;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#e8f5fb");
    sky.addColorStop(1, "#ffffff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const groundY = H * GROUND_Y_FRAC;
    const cx = W / 2;

    const [theta, , cartX] = stateRef.current;
    const cameraX = cameraRef.current;
    const cartPx = cx + (cartX - cameraX) * PX_PER_M;

    // ground
    ctx.strokeStyle = "#cdd7db";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
    // ground hatching
    ctx.strokeStyle = "#e1e9eb";
    ctx.lineWidth = 1;
    for (let gx = -10; gx < W + 10; gx += 14) {
      ctx.beginPath();
      ctx.moveTo(gx, groundY);
      ctx.lineTo(gx - 8, groundY + 9);
      ctx.stroke();
    }

    // cart body
    const cartTopY = groundY - WHEEL_R * 2 - CART_H;
    ctx.fillStyle = "#2b7f8c";
    ctx.strokeStyle = "#1c5860";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cartPx - CART_W / 2, cartTopY, CART_W, CART_H, 4);
    ctx.fill();
    ctx.stroke();
    // wheels
    ctx.fillStyle = "#333";
    for (const wx of [cartPx - CART_W / 2 + 14, cartPx + CART_W / 2 - 14]) {
      ctx.beginPath();
      ctx.arc(wx, cartTopY + CART_H, WHEEL_R, 0, Math.PI * 2);
      ctx.fill();
    }

    // pivot + stick
    const pivotX = cartPx;
    const pivotY = cartTopY;
    const tipX = pivotX + STICK_LEN_PX * Math.sin(theta);
    const tipY = pivotY - STICK_LEN_PX * Math.cos(theta);
    ctx.strokeStyle = fellRef.current ? "#b45309" : "#111827";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // hinge
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // tip mass
    ctx.fillStyle = fellRef.current ? "#b45309" : "#d93025";
    ctx.beginPath();
    ctx.arc(tipX, tipY, 7, 0, Math.PI * 2);
    ctx.fill();

    // mode badge
    ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillStyle = MUTED;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(nonlinearRef.current ? "nonlinear (sin/cos)" : "linearized", 8, 6);

    if (fellRef.current) {
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.fillRect(0, H / 2 - 16, W, 32);
      ctx.fillStyle = "#b45309";
      ctx.font = "bold 14px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("fell — reset to try again", W / 2, H / 2);
    } else {
      ctx.fillStyle = INK;
      ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(`θ = ${(theta * (180 / Math.PI)).toFixed(1)}°`, W - 8, 6);
    }
  }, [stateRef, cameraRef]);

  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (!document.hidden) drawRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => drawRef.current());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="sigCanvasWrap sigCpScene">
      <canvas ref={canvasRef} role="img" aria-label="Cart and stick animation" />
    </div>
  );
}
