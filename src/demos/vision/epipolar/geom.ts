/** Epipolar-line-in-a-rectangle helpers shared by the lines + race sub-panels. */

export interface Line {
  a: number;
  b: number;
  c: number;
}

/**
 * F/epipolarLine/epipole all operate in the data.json correspondences' ORIGINAL
 * image coordinates, which are a larger frame than the shipped jpg pixel grid
 * (data.json's "display coordinates": display_px = original_px * scale). A line
 * a*X + b*Y + c = 0 in original coords, substituted with X = x/scale, Y = y/scale,
 * becomes a*x + b*y + (c*scale) = 0 — so rescaling just the constant term maps an
 * original-space line directly into display-space, usable with display-space
 * rectangles/points with no per-point conversion.
 */
export function scaleLineToDisplay(l: Line, scale: number): Line {
  return { a: l.a, b: l.b, c: l.c * scale };
}

/** Clip an implicit line ax+by+c=0 to the [0,w]x[0,h] rectangle border. */
export function lineSegmentInRect(l: Line, w: number, h: number): [number, number, number, number] | null {
  const { a, b, c } = l;
  const pts: [number, number][] = [];
  const push = (x: number, y: number) => {
    if (x >= -1e-6 && x <= w + 1e-6 && y >= -1e-6 && y <= h + 1e-6) {
      if (!pts.some((p) => Math.abs(p[0] - x) < 1e-6 && Math.abs(p[1] - y) < 1e-6)) pts.push([x, y]);
    }
  };
  if (Math.abs(b) > 1e-12) {
    push(0, -c / b);
    push(w, -(a * w + c) / b);
  }
  if (Math.abs(a) > 1e-12) {
    push(-c / a, 0);
    push(-(b * h + c) / a, h);
  }
  if (pts.length < 2) return null;
  // pick the two most-separated points (handles the 4-candidate corner case)
  let best: [number, number, number, number] | null = null;
  let bestD = -1;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
      if (d > bestD) {
        bestD = d;
        best = [pts[i][0], pts[i][1], pts[j][0], pts[j][1]];
      }
    }
  }
  return best;
}

/** Sample points every `step` px along a line segment (inclusive of both ends). */
export function sampleAlongSegment(seg: [number, number, number, number], step: number): [number, number][] {
  const [x0, y0, x1, y1] = seg;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.floor(len / step));
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t)]);
  }
  return out;
}

/** Where does an epipole land relative to the image? For an off-frame epipole,
 * a direction to draw a border arrow (from the image center, clipped to border). */
export function epipoleBorderArrow(ex: number, ey: number, w: number, h: number): [number, number] {
  const cx = w / 2,
    cy = h / 2;
  const dx = ex - cx,
    dy = ey - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const candidates: number[] = [];
  if (dx !== 0) {
    candidates.push((0 - cx) / dx, (w - cx) / dx);
  }
  if (dy !== 0) {
    candidates.push((0 - cy) / dy, (h - cy) / dy);
  }
  const t = Math.min(...candidates.filter((v) => v > 0));
  const margin = 14;
  const x = clampPx(cx + dx * t, margin, w - margin);
  const y = clampPx(cy + dy * t, margin, h - margin);
  return [x, y];
}

function clampPx(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
