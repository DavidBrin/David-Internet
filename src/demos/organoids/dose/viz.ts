/** Small drawing/color helpers shared by the dose panel's canvases. */

const VIRIDIS_STOPS: [number, number, number, number][] = [
  [0.0, 68, 1, 84],
  [0.25, 59, 82, 139],
  [0.5, 33, 145, 140],
  [0.75, 94, 201, 98],
  [1.0, 253, 231, 37],
];

/** Viridis-like sequential colormap: t in [0,1] -> [r,g,b]. */
export function viridis(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < VIRIDIS_STOPS.length; i++) {
    if (x <= VIRIDIS_STOPS[i][0]) {
      const [t0, r0, g0, b0] = VIRIDIS_STOPS[i - 1];
      const [t1, r1, g1, b1] = VIRIDIS_STOPS[i];
      const f = (x - t0) / (t1 - t0);
      return [r0 + f * (r1 - r0), g0 + f * (g1 - g0), b0 + f * (b1 - b0)];
    }
  }
  return [253, 231, 37];
}

export function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/** Relative luminance (sRGB) so cell text can flip white/black for contrast. */
export function luminance([r, g, b]: [number, number, number]): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** CSS linear-gradient sampling a colormap across [0,1], for a colorbar. */
export function gradientCss(colorFn: (t: number) => [number, number, number]): string {
  const stops = 12;
  const parts: string[] = [];
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    parts.push(`${rgbCss(colorFn(t))} ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(to right, ${parts.join(", ")})`;
}

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/** "#rrggbb" -> "rgba(r,g,b,alpha)" for pale dose-group tints. */
export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Maps a trimmed FOOOF frequency axis (linear Hz, log-log display) + log10 power
 * onto pixel points within [x, x+w] x [y, y+h] (y grows down). Autoscales the
 * power axis to [min,max] unless yDomain is given.
 */
export function logLogPoints(
  freqs: ArrayLike<number>,
  values: ArrayLike<number>,
  x: number,
  y: number,
  w: number,
  h: number,
  yDomain?: [number, number],
): { x: number; y: number }[] {
  const n = freqs.length;
  if (n === 0) return [];
  const lf0 = Math.log10(freqs[0]);
  const lf1 = Math.log10(freqs[n - 1]);
  let lo: number, hi: number;
  if (yDomain) {
    [lo, hi] = yDomain;
  } else {
    lo = Infinity;
    hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = values[i] as number;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (hi - lo < 1e-6) {
      lo -= 0.5;
      hi += 0.5;
    }
  }
  const pts: { x: number; y: number }[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const fx = lf1 === lf0 ? 0 : (Math.log10(freqs[i] as number) - lf0) / (lf1 - lf0);
    const fy = clamp01(((values[i] as number) - lo) / (hi - lo));
    pts[i] = { x: x + fx * w, y: y + (1 - fy) * h };
  }
  return pts;
}

export function strokePath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}
