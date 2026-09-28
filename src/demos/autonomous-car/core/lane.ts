/**
 * lane_detection_node.locate_centroid, line for line: crop → HSV → inRange → mask →
 * BGR2GRAY (applied to the masked *HSV* image, as the node does) → threshold →
 * blur → erode → dilate → threshold → external contours → minAreaRect width filter
 * → contour-moment centroids → steering error. Returns every intermediate so the
 * page can show the stages; `error` is what the node would publish on /centroid
 * (null = "Nothing detected", nothing published).
 *
 * Quirks kept on purpose:
 *  - the gray conversion reads H,S,V as if they were B,G,R;
 *  - the crop is fixed from the first frame's size (camera_init): pass that `box` when
 *    streaming frames of changing size (every frame on this page is 640x480);
 *  - in the curve branch every line inside the threshold band is replaced by error 1,
 *    so a curve with all lines near centre steers hard right.
 */
import {
  bgr2gray,
  bgr2hsv,
  bitwiseNot,
  blur,
  contourMoments,
  crop,
  dilate,
  erode,
  findContoursExternal,
  inRange,
  maskCopy,
  minAreaRect,
  threshold,
  type Mat,
  type Pt,
  type RotatedRect,
} from "./cv";
import type { LaneParams } from "./params";

export interface CropBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** camera_init block: vertical pan + horizontal crop from the frame size. */
export function cropFor(width: number, height: number, p: LaneParams): CropBox {
  const rowsToWatch = Math.trunc(height * p.rows_to_watch_decimal);
  const rowsOffset = Math.trunc(height * (1 - p.rows_offset_decimal));
  const startHeight = Math.trunc(height - rowsOffset);
  const bottomHeight = Math.trunc(startHeight + rowsToWatch);
  const leftWidth = Math.trunc((width / 2) * (1 - p.crop_width_decimal));
  const rightWidth = Math.trunc((width / 2) * (1 + p.crop_width_decimal));
  return { x0: leftWidth, y0: startHeight, x1: rightWidth, y1: bottomHeight };
}

export interface LaneContour {
  pts: Pt[];
  rect: RotatedRect;
  /** passed Width_min < w < Width_max */
  pass: boolean;
  /** centroid (crop coordinates) when it passed and m00 != 0 */
  cx?: number;
  cy?: number;
}

export type LaneDecision =
  | { kind: "none"; error: null }
  | { kind: "single"; error: number; target: [number, number] }
  | { kind: "straight"; error: number; target: [number, number]; errors: number[]; horizonDiff: number }
  | { kind: "curve"; error: number; target: [number, number]; errors: number[]; rawErrors: number[]; horizonDiff: number };

export interface LaneResult {
  crop: CropBox;
  width: number;
  height: number;
  centerX: number;
  /** x of the two red threshold lines */
  threshX: [number, number];
  stages: {
    roi: Mat;
    hsv: Mat;
    mask: Mat;
    masked: Mat;
    gray: Mat;
    bw: Mat;
    blurred: Mat;
    eroded: Mat;
    dilated: Mat;
    final: Mat;
  };
  contours: LaneContour[];
  decision: LaneDecision;
  /** value published on /centroid, or null */
  error: number | null;
}

/** Python's min(list, key=abs): first element with the smallest |x|. */
function minAbs(xs: number[]): number {
  let best = xs[0];
  for (const x of xs) if (Math.abs(x) < Math.abs(best)) best = x;
  return best;
}

export function locateCentroid(frame: Mat, p: LaneParams, box?: CropBox): LaneResult {
  const cb = box ?? cropFor(frame.w, frame.h, p);
  const imageWidth = Math.trunc(cb.x1 - cb.x0);
  // self.image_height is the unclipped band height; the numpy slice itself stops at the frame edge
  const imageHeight = cb.y1 - cb.y0;
  const roi = crop(frame, cb.x0, cb.y0, Math.min(cb.x1, frame.w), Math.min(cb.y1, frame.h));

  const hsv = bgr2hsv(roi);
  const mask = inRange(hsv, [p.Hue_low, p.Saturation_low, p.Value_low], [p.Hue_high, p.Saturation_high, p.Value_high]);
  const masked = p.inverted_filter === 1 ? maskCopy(hsv, bitwiseNot(mask)) : maskCopy(hsv, mask);
  const gray = bgr2gray(masked);
  const bw = threshold(gray, p.gray_lower, 255);
  const blurred = blur(bw, p.kernal_size);
  const eroded = erode(blurred, p.kernal_size, p.erosion_itterations);
  const dilated = dilate(eroded, p.kernal_size, p.dilation_itterations);
  const final = threshold(dilated, p.gray_lower, 255);
  const all = findContoursExternal(final);

  const camCenterLineX = Math.trunc(imageWidth * p.camera_centerline);
  const threshX: [number, number] = [
    Math.trunc(camCenterLineX - (p.error_threshold * imageWidth) / 2),
    Math.trunc(camCenterLineX + (p.error_threshold * imageWidth) / 2),
  ];

  const cxList: number[] = [];
  const cyList: number[] = [];
  const contours: LaneContour[] = [];
  for (const pts of all.slice(0, Math.max(0, p.number_of_lines))) {
    const rect = minAreaRect(pts);
    const pass = p.Width_min < rect.w && rect.w < p.Width_max;
    const c: LaneContour = { pts, rect, pass };
    if (pass) {
      const m = contourMoments(pts);
      if (m.m00 !== 0) {
        // int(m10 / m00) truncates toward zero
        c.cx = Math.trunc(m.m10 / m.m00);
        c.cy = Math.trunc(m.m01 / m.m00);
        cxList.push(c.cx);
        cyList.push(c.cy);
      }
      // m00 == 0 raises ZeroDivisionError in Python and the contour is skipped
    }
    contours.push(c);
  }

  let decision: LaneDecision = { kind: "none", error: null };
  if (cxList.length > 1) {
    const errors = cxList.map((cx) => (cx - camCenterLineX) / camCenterLineX);
    const avg = errors.reduce((a, b) => a + b, 0) / errors.length;
    const horizonDiff = Math.abs(errors[0] - errors[errors.length - 1]);
    if (Math.abs(horizonDiff) <= p.error_threshold) {
      const pixel = Math.trunc(camCenterLineX * (1 + avg));
      decision = { kind: "straight", error: avg, target: [pixel, Math.trunc(imageHeight / 2)], errors, horizonDiff };
    } else {
      const raw = errors.slice();
      const adj = errors.map((e) => (Math.abs(e) < p.error_threshold ? 1 : e));
      const ex = minAbs(adj);
      const idx = adj.indexOf(ex);
      decision = { kind: "curve", error: ex, target: [cxList[idx], cyList[idx]], errors: adj, rawErrors: raw, horizonDiff };
    }
  } else if (cxList.length === 1) {
    const ex = (cxList[0] - camCenterLineX) / camCenterLineX;
    decision = { kind: "single", error: ex, target: [cxList[0], cyList[0]] };
  }

  return {
    crop: cb,
    width: imageWidth,
    height: imageHeight,
    centerX: camCenterLineX,
    threshX,
    stages: { roi, hsv, mask, masked, gray, bw, blurred, eroded, dilated, final },
    contours,
    decision,
    error: decision.error,
  };
}
