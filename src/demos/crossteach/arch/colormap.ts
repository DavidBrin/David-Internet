/** Teal -> amber colormap used for both the U-Net activation overlay and the ViT rollout overlay. */

const TEAL: [number, number, number] = [20, 184, 166]; // var(--demo-accent)
const AMBER: [number, number, number] = [245, 158, 11]; // shared boundary color (crossteach.css comment)

function tealAmber(t: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, t));
  return [
    Math.round(TEAL[0] + (AMBER[0] - TEAL[0]) * c),
    Math.round(TEAL[1] + (AMBER[1] - TEAL[1]) * c),
    Math.round(TEAL[2] + (AMBER[2] - TEAL[2]) * c),
  ];
}

/**
 * Build an ImageData from a grayscale byte array using the teal->amber map.
 * `proportionalAlpha`: alpha scales with value (bright = more opaque) instead of a flat alpha.
 */
export function colorizeGrayscale(
  gray: Uint8Array,
  w: number,
  h: number,
  opts: { alphaBase?: number; proportionalAlpha?: boolean } = {}
): ImageData {
  const alphaBase = opts.alphaBase ?? 0.65;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = gray[i] / 255;
    const [r, g, b] = tealAmber(v);
    const a = opts.proportionalAlpha ? v * alphaBase * 255 : alphaBase * 255;
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return new ImageData(data, w, h);
}
