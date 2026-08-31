/** DPR-aware canvas sizing shared by the cartpole panel's three canvases. */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
): { ctx: CanvasRenderingContext2D; W: number; H: number } | null {
  if (cssW <= 0 || cssH <= 0) return null;
  const dpr = window.devicePixelRatio || 1;
  const W = Math.round(cssW);
  const H = Math.round(cssH);
  const pxW = Math.floor(W * dpr);
  const pxH = Math.floor(H * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W, H };
}
