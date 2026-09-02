/** Shapes for /demos/crossteach/predictions.json. Prefix ctX (exchange panel). */

export type ModelKey = "unet_sup" | "unet_ct" | "vit_sup" | "vit_ct";
export type EnsembleKey = "sup" | "ct";
export type Arch = "unet" | "vit";

export interface ModelMetrics {
  dice: number;
  iou: number;
  pixelAccuracy: number;
  imageConfidence: number;
  gatePasses: boolean;
}

export interface EnsembleMetrics {
  dice: number;
  iou: number;
  pixelAccuracy: number;
}

export interface ImageEntry {
  id: string;
  tfdsIndex: number;
  breed: string;
  models: Record<ModelKey, ModelMetrics>;
  ensembles: Record<EnsembleKey, EnsembleMetrics>;
}

export interface PredictionsData {
  confThreshold: number;
  unetSize: number;
  vitSize: number;
  note: string;
  images: ImageEntry[];
}

export function modelKeyFor(arch: Arch, mode: EnsembleKey): ModelKey {
  return `${arch}_${mode}` as ModelKey;
}

export type TeachPhase = "idle" | "vit-to-unet" | "vit-skip" | "unet-to-vit" | "unet-skip";

