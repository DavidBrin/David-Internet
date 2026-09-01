/** Small color helpers for the graph canvas — HSL generation + RGB formatting. */

export type Rgb = [number, number, number]; // 0..1 floats

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}

const GOLDEN_ANGLE = 137.50776;

/** Deterministic, well-spread categorical hue for index `i`. */
export function categoricalColor(i: number, hueOffset = 0, s = 0.62, l = 0.56): Rgb {
  return hslToRgb(i * GOLDEN_ANGLE + hueOffset, s, l);
}

/** Muted grey for "everything else" buckets (tiny communities). */
export const GREY: Rgb = [0.78, 0.76, 0.84];

export function rgbToCss([r, g, b]: Rgb, alpha = 1): string {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
