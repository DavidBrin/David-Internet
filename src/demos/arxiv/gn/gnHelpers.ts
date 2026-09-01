/**
 * Pure helpers for GnCard: shaping public/demos/arxiv/social.json (Zachary's
 * karate club) into SVG-ready points, plus the shared component palette.
 */

export interface SocialJson {
  n: number;
  edges: [number, number][];
  pos: Record<string, [number, number]>;
  note: string;
}

export interface Point {
  x: number;
  y: number;
}

/** Map the roughly [-1,1] spring layout into a viewBox, flipping y for screen coords. */
export function scalePositions(
  pos: Record<string, [number, number]>,
  n: number,
  width: number,
  height: number,
  pad: number
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = pos[String(i)] ?? [0, 0];
    pts.push({
      x: pad + ((x + 1) / 2) * (width - 2 * pad),
      y: pad + ((1 - y) / 2) * (height - 2 * pad),
    });
  }
  return pts;
}

/** Faction palette — index 0/1 are the famous two-way split. */
export const PALETTE = ["#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899"];

export function componentColor(node: number, comps: number[][]): string {
  if (comps.length <= 1) return PALETTE[0];
  const idx = comps.findIndex((c) => c.includes(node));
  return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
}

export const ekey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);
