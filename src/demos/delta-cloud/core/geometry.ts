/**
 * Edge routing for the cloud map: straight segments from box border to box
 * border, so arrowheads land on the edge of a node rather than its centre.
 */
import type { CloudEdge, CloudNode } from "./model";

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  a: Point;
  b: Point;
  /** Label anchor: the edge's `labelAt` fraction along the route (default 0.5). */
  mid: Point;
  /** Full route, a → … → b. Two points for a straight edge, four for a side elbow. */
  points: Point[];
}

/** SVG path data for a segment (for `animateMotion`). */
export function pathData(seg: Segment): string {
  return seg.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

/** True when two nodes sit in the same column (same x and width): a straight edge between them would be a stub. */
function stacked(p: CloudNode, q: CloudNode): boolean {
  return p.x === q.x && p.w === q.w;
}

function center(n: CloudNode): Point {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

/** Where the ray from `n`'s centre toward `target` leaves `n`'s rectangle. */
export function borderPoint(n: CloudNode, target: Point): Point {
  const c = center(n);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = n.w / 2;
  const hh = n.h / 2;
  // Scale so the ray hits whichever side it reaches first.
  const sx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const sy = dy === 0 ? Infinity : hh / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

export function routeEdge(edge: CloudEdge, byId: (id: string) => CloudNode, gap = 3): Segment {
  const from = byId(edge.from);
  const to = byId(edge.to);
  if (stacked(from, to)) {
    // Elbow out of the column's right side: right-mid of `from`, out by `bulge`, down/up, into right-mid of `to`.
    const bulge = edge.bulge ?? 16;
    const x = from.x + from.w + gap;
    const ay = from.y + from.h / 2;
    const by = to.y + to.h / 2;
    const points = [
      { x, y: ay },
      { x: x + bulge, y: ay },
      { x: x + bulge, y: by },
      { x, y: by },
    ];
    return { a: points[0], b: points[3], mid: { x: x + bulge, y: (ay + by) / 2 }, points };
  }
  const a0 = borderPoint(from, center(to));
  const b0 = borderPoint(to, center(from));
  // Pull both ends back by `gap` so strokes never touch the box borders.
  const dx = b0.x - a0.x;
  const dy = b0.y - a0.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const a = { x: a0.x + ux * gap, y: a0.y + uy * gap };
  const b = { x: b0.x - ux * gap, y: b0.y - uy * gap };
  const t = edge.labelAt ?? 0.5;
  return { a, b, mid: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, points: [a, b] };
}

/** Axis-aligned overlap test between two nodes (used by tests to keep the map tidy). */
export function overlaps(p: CloudNode, q: CloudNode): boolean {
  return p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
}
