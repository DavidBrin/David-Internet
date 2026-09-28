/**
 * object_detection_node (Code/camera_driver2.py): what it does with the detector's
 * predictions. The Roboflow model itself (garbage-dxrv3 v3, run on the OAK-D Lite's
 * Myriad X by RoboflowOak) can't run on this page, so `standInDetections` projects the
 * synthetic garbage into the virtual camera and reports its box the way RoboflowOak
 * does (center x/y, width, height, confidence). Everything downstream is the node's math.
 */
import { garbageBoxes, type CameraModel, CAMERA, type Pose } from "./camera";
import { DETECT_PARAMS } from "./params";
import type { World } from "./world";

export interface Prediction {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * Stand-in for rf.detect(): boxes for garbage in view, with a confidence that falls
 * off with distance and small size, filtered at the node's 0.60 confidence.
 */
export function standInDetections(world: World, pose: Pose, cam: CameraModel = CAMERA, minConf = DETECT_PARAMS.confidence): Prediction[] {
  return garbageBoxes(world, pose, cam)
    .map((b) => {
      const size = Math.min(1, Math.sqrt(b.width * b.height) / 60);
      const conf = Math.max(0, Math.min(0.99, 0.35 + 0.64 * size - 0.05 * Math.max(0, b.range - 2)));
      return { id: b.id, label: "garbage", x: b.x, y: b.y, width: b.width, height: b.height, confidence: conf };
    })
    .filter((p) => p.confidence >= minConf);
}

export type SelectionMethod = "closest" | "average" | "minimum_error";

/** calculate_centroid_error: steering error toward the detections, lane-style. */
export function centroidError(
  preds: Prediction[],
  imageWidth: number,
  opts: { camera_centerline?: number; error_threshold?: number; method?: SelectionMethod } = {},
): { error: number; targetIndex: number } {
  const centerline = opts.camera_centerline ?? DETECT_PARAMS.camera_centerline;
  const thr = opts.error_threshold ?? DETECT_PARAMS.error_threshold;
  const method = opts.method ?? DETECT_PARAMS.target_selection_method;
  if (preds.length === 0) return { error: 0, targetIndex: -1 };
  const cam = Math.trunc(imageWidth * centerline);
  const cx = preds.map((p) => Math.trunc(p.x));
  const errors = cx.map((c) => (c - cam) / cam);
  if (preds.length === 1) return { error: errors[0], targetIndex: 0 };
  if (method === "average") return { error: errors.reduce((a, b) => a + b, 0) / errors.length, targetIndex: 0 };
  if (method === "closest") {
    const dist = cx.map((c) => Math.abs(c - cam));
    const i = dist.indexOf(Math.min(...dist));
    return { error: errors[i], targetIndex: i };
  }
  const significant = errors.filter((e) => Math.abs(e) >= thr);
  const pool = significant.length ? significant : errors;
  let best = pool[0];
  for (const e of pool) if (Math.abs(e) < Math.abs(best)) best = e;
  return { error: best, targetIndex: errors.indexOf(best) };
}

/** calculate_representative_width: the largest box width (closest / most significant object). */
export function representativeWidth(preds: Prediction[]): number {
  return preds.length ? Math.max(...preds.map((p) => p.width)) : 0;
}

/** One run_model() tick: the four topics the node publishes. */
export interface DetectorOutput {
  preds: Prediction[];
  /** /object_detections/flag */
  flag: boolean;
  /** /object_detections/centroid, only published when something was detected */
  centroid: number | null;
  /** /object_detections/depth (really the max bbox width in px), only when detected */
  width: number | null;
  targetIndex: number;
}

export function runModel(preds: Prediction[], imageWidth: number, method: SelectionMethod = DETECT_PARAMS.target_selection_method): DetectorOutput {
  const valid = preds.filter((p) => p.width >= DETECT_PARAMS.min_width_for_detection);
  if (!valid.length) return { preds: valid, flag: false, centroid: null, width: null, targetIndex: -1 };
  const { error, targetIndex } = centroidError(valid, imageWidth, { method });
  return { preds: valid, flag: true, centroid: error, width: representativeWidth(valid), targetIndex };
}
