/**
 * Pure helpers for SpectralCard: shaping public/demos/arxiv/social.json into
 * SVG-ready points. Deliberately duplicated from gn/gnHelpers.ts (each card is
 * self-contained per the Stage.tsx panel contract) rather than shared.
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
