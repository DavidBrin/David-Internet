/** Image loading + grayscale Grid extraction for the epipolar panel. */
import type { Grid } from "@/demos/vision/core/stereo";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

/**
 * Grayscale Grid from a loaded image, at the image's natural (original)
 * resolution. "red" reuses the red channel for images that are already
 * grayscale JPEGs (im0, geisel); "luma" applies the standard weights for the
 * color dino/warrior pairs.
 */
export function imageToGrid(img: HTMLImageElement, mode: "red" | "luma" = "luma"): Grid {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  const data = new Float64Array(w * h);
  if (mode === "red") {
    for (let p = 0, i = 0; p < data.length; p++, i += 4) data[p] = px[i] / 255;
  } else {
    for (let p = 0, i = 0; p < data.length; p++, i += 4) {
      data[p] = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    }
  }
  return { data, w, h };
}
