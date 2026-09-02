/** Shared types + constants for the #architectures panel (prefix ctA). */

export type StageInfo = { name: string; hw: number; ch: number };
export type ImageActivations = { id: string; stages: StageInfo[] };
export type ActivationsData = { images: ImageActivations[] };

export type AttentionImageMeta = { id: string; grid: number };
export type AttentionData = { images: AttentionImageMeta[]; layers: number; heads: number };

export const IMAGE_IDS = ["img00", "img03", "img06", "img09"] as const;
export type ImageId = (typeof IMAGE_IDS)[number];

export const DEFAULT_IMAGE_ID: ImageId = "img06";
