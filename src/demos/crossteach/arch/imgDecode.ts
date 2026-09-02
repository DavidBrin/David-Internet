/**
 * Image loading + grayscale decoding helpers for the #architectures panel.
 * Callers keep their own `Map<string, Promise<T>>` (usually a useRef) and pass
 * it through `cached()` so decoded arrays survive re-renders without redoing
 * network + canvas work.
 */

export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${url}`));
    img.src = url;
  });
}

export type GrayscaleData = { data: Uint8Array; w: number; h: number };

/** Decode a grayscale PNG into its R-channel byte array via an offscreen canvas. */
export async function decodeGrayscale(url: string): Promise<GrayscaleData> {
  const img = await loadImageElement(url);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(img, 0, 0);
  const { data: rgba } = ctx.getImageData(0, 0, w, h);
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = rgba[i * 4];
  return { data, w, h };
}

/** Get-or-create a cached promise for `url`, stored in the caller-owned `cache` map. */
export function cached<T>(
  cache: Map<string, Promise<T>>,
  url: string,
  loader: (u: string) => Promise<T>
): Promise<T> {
  const hit = cache.get(url);
  if (hit) return hit;
  const p = loader(url);
  cache.set(url, p);
  return p;
}
