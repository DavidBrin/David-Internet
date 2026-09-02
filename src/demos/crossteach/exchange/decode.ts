/**
 * Image decode + colorize helpers for the exchange panel.
 * Trimap colors (shared page convention): pet #14B8A6, background #1e293b,
 * boundary #f59e0b. Label/conf PNGs are decoded via an offscreen canvas and
 * the R channel (0/1/2 for labels, 0..255 for confidence).
 */

export interface DecodedChannel {
  width: number;
  height: number;
  data: Uint8Array; // R channel only
}

export interface DecodedRGBA {
  width: number;
  height: number;
  data: Uint8ClampedArray; // full RGBA
}

export const PALETTE: Record<number, [number, number, number]> = {
  0: [20, 184, 166], // pet
  1: [30, 41, 59], // background
  2: [245, 158, 11], // boundary
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

function toCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/** Decode a single-channel (label or confidence) PNG's R channel. */
export async function decodeChannel(url: string): Promise<DecodedChannel> {
  const img = await loadImage(url);
  const canvas = toCanvas(img);
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) data[i] = imageData.data[i * 4];
  return { width, height, data };
}

/** Decode a full-color (input) image to RGBA. */
export async function decodeRGBA(url: string): Promise<DecodedRGBA> {
  const img = await loadImage(url);
  const canvas = toCanvas(img);
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  return { width, height, data: imageData.data };
}

/** Dimmed grayscale copy of an RGBA image, used as the base under prediction overlays. */
export function buildDimmedGrayscale(rgba: DecodedRGBA): HTMLCanvasElement {
  const { width, height, data } = rgba;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const out = ctx.createImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const lum = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    const v = 38 + lum * 0.5;
    out.data[o] = v;
    out.data[o + 1] = v;
    out.data[o + 2] = v;
    out.data[o + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** Plain color copy of an RGBA image (for the input column canvas). */
export function buildColorCanvas(rgba: DecodedRGBA): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = rgba.width;
  canvas.height = rgba.height;
  const ctx = canvas.getContext("2d")!;
  const copy = new Uint8ClampedArray(rgba.data);
  ctx.putImageData(new ImageData(copy, rgba.width, rgba.height), 0, 0);
  return canvas;
}

export interface OverlayOptions {
  conf?: Uint8Array; // same length as label
  threshold?: number; // 0..1, pixels below fade
  alphaHigh?: number; // 0..255
  alphaLow?: number; // 0..255
  alpha?: number; // fixed alpha, overrides confidence fade when set and no conf given
}

/** Colorize a 0/1/2 label map into an RGBA canvas, optionally fading low-confidence pixels. */
export function buildOverlayCanvas(label: DecodedChannel, opts: OverlayOptions = {}): HTMLCanvasElement {
  const { width, height, data } = label;
  const { conf, threshold, alphaHigh = 209, alphaLow = 12, alpha } = opts;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const out = ctx.createImageData(width, height);
  const thresh255 = (threshold ?? 0) * 255;
  for (let i = 0; i < width * height; i++) {
    const cls = data[i];
    const rgb = PALETTE[cls] ?? PALETTE[1];
    let a = alpha ?? alphaHigh;
    if (conf && threshold !== undefined) {
      a = conf[i] >= thresh255 ? alphaHigh : alphaLow;
    }
    const o = i * 4;
    out.data[o] = rgb[0];
    out.data[o + 1] = rgb[1];
    out.data[o + 2] = rgb[2];
    out.data[o + 3] = a;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** Fraction of pixels whose confidence clears `threshold` (0..1). */
export function computeCoverage(conf: Uint8Array, threshold: number): number {
  if (conf.length === 0) return 0;
  const thresh255 = threshold * 255;
  let keep = 0;
  for (let i = 0; i < conf.length; i++) if (conf[i] >= thresh255) keep++;
  return keep / conf.length;
}

/** Draw `src` scaled to fill a `size` x `size` CSS-pixel square, nearest-neighbor by default
 * (crisp class regions when up/down-sampling label maps across the 224/512 gap). */
export function drawFitted(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  size: number,
  smooth = false,
  clear = true,
): void {
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = smooth;
  if (clear) ctx.clearRect(0, 0, size, size);
  ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, size, size);
  ctx.imageSmoothingEnabled = prev;
}

/** Async decode cache keyed by URL, deduping concurrent requests for the same asset. */
export class DecodeCache {
  private channels = new Map<string, Promise<DecodedChannel>>();
  private rgbas = new Map<string, Promise<DecodedRGBA>>();

  channel(url: string): Promise<DecodedChannel> {
    let p = this.channels.get(url);
    if (!p) {
      p = decodeChannel(url);
      this.channels.set(url, p);
    }
    return p;
  }

  rgba(url: string): Promise<DecodedRGBA> {
    let p = this.rgbas.get(url);
    if (!p) {
      p = decodeRGBA(url);
      this.rgbas.set(url, p);
    }
    return p;
  }
}
