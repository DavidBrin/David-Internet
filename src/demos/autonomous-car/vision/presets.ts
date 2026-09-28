/**
 * Calibration presets and the crop helper for the #vision panel.
 *
 * LAB_PARAMS: the slider values visible in the team's calibration GUI photo
 * (public/demos/autonomous-car/media/lane-debug.jpg): lowH 19, highH 29, lowS 56,
 * highS 161, lowV 139, highV 255, min_width 10, max_width 117, number_of_lines 100,
 * error_threshold 0.16, camera_centerline 0.50, frame_width (crop_width_decimal) 0.70,
 * rows_to_watch 0.62. The photo doesn't show kernal_size, the iteration counts,
 * gray_lower or rows_offset_decimal, so those stay at the yaml values.
 *
 * LAB_BAND: the photo's band, width filter and steering values with the yaml's HSV box.
 * The photo's S ceiling (161) was tuned on the real OAK-D feed; this synthetic tape
 * renders at S ~210, so the exact photo HSV only catches its anti-aliased edges. The
 * two-line scenes therefore use the photo's geometry and keep the yaml's colour box.
 */
import type { Mat } from "../core/cv";
import { cropFor, locateCentroid, type CropBox, type LaneResult } from "../core/lane";
import { LANE_PARAMS, type LaneParams } from "../core/params";

export const LAB_PARAMS: LaneParams = {
  ...LANE_PARAMS,
  Hue_low: 19,
  Hue_high: 29,
  Saturation_low: 56,
  Saturation_high: 161,
  Value_low: 139,
  Value_high: 255,
  Width_min: 10,
  Width_max: 117,
  number_of_lines: 100,
  error_threshold: 0.16,
  camera_centerline: 0.5,
  crop_width_decimal: 0.7,
  rows_to_watch_decimal: 0.62,
  rows_offset_decimal: 0.5,
};

export const LAB_BAND: LaneParams = {
  ...LANE_PARAMS,
  Width_min: LAB_PARAMS.Width_min,
  Width_max: LAB_PARAMS.Width_max,
  number_of_lines: LAB_PARAMS.number_of_lines,
  error_threshold: LAB_PARAMS.error_threshold,
  camera_centerline: LAB_PARAMS.camera_centerline,
  crop_width_decimal: LAB_PARAMS.crop_width_decimal,
  rows_to_watch_decimal: LAB_PARAMS.rows_to_watch_decimal,
  rows_offset_decimal: LAB_PARAMS.rows_offset_decimal,
};

export function sameParams(a: LaneParams, b: LaneParams): boolean {
  return (Object.keys(b) as (keyof LaneParams)[]).every((k) => a[k] === b[k]);
}

/**
 * camera_init's crop, clipped to the frame the way numpy slicing clips
 * frame[start:bottom]: rows_to_watch 0.62 from row 240 asks for rows 240 to 537 of a
 * 480-row frame and numpy hands back rows 240 to 480.
 */
export function clippedCrop(w: number, h: number, p: LaneParams): { box: CropBox; pyHeight: number } {
  const cb = cropFor(w, h, p);
  const y0 = Math.max(0, Math.min(h - 1, cb.y0));
  const box: CropBox = {
    x0: Math.max(0, Math.min(w - 1, cb.x0)),
    x1: Math.max(1, Math.min(w, cb.x1)),
    y0,
    y1: Math.max(y0 + 1, Math.min(h, cb.y1)),
  };
  if (box.x1 <= box.x0) box.x1 = box.x0 + 1;
  return { box, pyHeight: cb.y1 - cb.y0 };
}

/**
 * locate_centroid on the clipped crop. The node's image_height is
 * bottom_height - start_height (not clipped), which only matters for the straight
 * branch's target row int(image_height / 2), so that is patched back.
 */
export function runLane(frame: Mat, p: LaneParams): LaneResult {
  const { box, pyHeight } = clippedCrop(frame.w, frame.h, p);
  const r = locateCentroid(frame, p, box);
  if (r.decision.kind === "straight" && pyHeight !== r.height) {
    r.decision = { ...r.decision, target: [r.decision.target[0], Math.trunc(pyHeight / 2)] };
  }
  return r;
}
