/**
 * data.json loader for the epipolar panel — images metadata (display scale,
 * original w/h), the dino/warrior correspondences (3xN homogeneous, ORIGINAL
 * image coordinates) and the notebook's stored fundamental matrices.
 */

export interface EpiImageMeta {
  /** shipped-display / original ratio: display_px = original_px * scale */
  scale: number;
  w: number;
  h: number;
}

export type EpiImageName = "dino0" | "dino1" | "warrior0" | "warrior1" | "im0" | "geisel";

export interface EpiCorrespondences {
  cor1: number[][]; // 3 x 13 (or 3 x 11 for warrior), rows [x, y, 1]
  cor2: number[][];
}

export interface EpiData {
  images: Record<EpiImageName, EpiImageMeta>;
  correspondences: { dino: EpiCorrespondences; warrior: EpiCorrespondences };
  F: { dino: number[][]; matrix: number[][]; warrior: number[][] };
  warriorCorners: [number[][], number[][]];
  note: string;
}

let cache: Promise<EpiData> | null = null;

export function loadEpiData(): Promise<EpiData> {
  cache ??= fetch("/demos/vision/epipolar/data.json").then((r) => r.json());
  return cache;
}

export const EPI_BASE = "/demos/vision/epipolar";
