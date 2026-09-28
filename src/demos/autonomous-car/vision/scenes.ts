/**
 * Preset poses for the #vision panel. Poses are arc length s along the stadium's tape
 * plus a lateral offset (m, + = left of travel) and a heading offset (rad), the same
 * convention as scripts/demos/autonomous-car.ts SCENES (several are the fixture poses).
 *
 * With the yaml's 20 percent band (rows 240 to 336) the crop almost always holds one
 * dash, so the node ran its single-line branch nearly every frame. The last three scenes
 * use the band from the team's calibration photo (rows_to_watch 0.62, see presets.ts),
 * which holds two dashes on this camera, so the straight / curve branches run.
 */
import type { LaneParams } from "../core/params";
import { LAB_BAND } from "./presets";
import type { Pose } from "../core/camera";
import type { World } from "../core/world";

export interface Scene {
  id: string;
  label: string;
  /** one line under the chips: what this scene shows */
  hint: string;
  s: number;
  off: number;
  dth: number;
  shade?: "deep";
  garbage?: boolean;
  /** full parameter set the scene switches to (default: the yaml) */
  params?: LaneParams;
  /** small tag on the chip when the scene uses non-yaml values */
  tag?: string;
}

export const SCENES: Scene[] = [
  {
    id: "straight",
    label: "Straight",
    hint: "One dash fills the crop band. One contour passes the width filter, so the node takes its single-line branch.",
    s: 2.0,
    off: 0,
    dth: 0,
  },
  {
    id: "gap",
    label: "Dash gap",
    hint: "The gap between dashes sits in the band. Two stubs survive the cleanup but both are narrower than Width_min 15, so nothing is published.",
    s: 2.23,
    off: 0,
    dth: 0,
  },
  {
    id: "curve-entry",
    label: "Curve entry",
    hint: "Start of the 8 m radius turn. The dash leaving the band leaves a 4-row sliver on the bottom edge, which passes (cv2.minAreaRect calls its long side w, 41), while the next dash entering at the top is still too narrow (w 10).",
    s: 9.4,
    off: 0,
    dth: 0,
  },
  {
    id: "offset-left",
    label: "Offset left",
    hint: "Car 12 cm left of the tape. The centroid moves right of the camera centre line and just past the red threshold band.",
    s: 5.0,
    off: 0.12,
    dth: 0,
  },
  {
    id: "offset-right",
    label: "Offset right",
    hint: "Car 10 cm right of the tape, nose 3° left. The error goes negative (steer left).",
    s: 6.1,
    off: -0.1,
    dth: 0.05,
  },
  {
    id: "yawed",
    label: "Yawed",
    hint: "Nose 14° off the tape on the far turn. The dash crosses the band diagonally, and its rotated box still passes.",
    s: 33.0,
    off: 0,
    dth: 0.25,
  },
  {
    id: "shade",
    label: "Deep shade",
    hint: "Under a tree at 2.6x the default shade. The tape's V drops to about 82, below Value_low 145, and the mask comes up empty. Drag Value_low under about 75 to find it again.",
    s: 89.0,
    off: 0,
    dth: 0,
    shade: "deep",
  },
  {
    id: "grass",
    label: "Grass edge",
    hint: "The car has run 2 m off the tape and is nosing toward the verge. This synthetic grass averages H 39, S 158, V 147, inside the yaml's HSV box, so the verge becomes one 432 px wide blob. cv2.minAreaRect lists its short side first (w 67), so it passes the width filter and is tracked as if it were tape.",
    s: 5.0,
    off: -2.0,
    dth: -1.2,
  },
  {
    id: "garbage",
    label: "Garbage ahead",
    hint: "A cardboard box 1.1 m ahead. The detector's box is drawn the way camera_driver2 draws it; the lane node never sees it (its hue, 14, is below Hue_low 18).",
    s: 5.0,
    off: 0,
    dth: 0,
    garbage: true,
  },
  {
    id: "two",
    label: "Two dashes",
    tag: "lab band",
    hint: "The photo's 62 percent band (rows 240 to 480 here) holds two dashes at once. Their errors differ by less than error_threshold 0.16, so the node averages them: the straight branch.",
    s: 2.3,
    off: -0.05,
    dth: 0.1,
    params: LAB_BAND,
  },
  {
    id: "curve",
    label: "Curve branch",
    tag: "lab band",
    hint: "Lab band, car 15 cm right, nose 11° left. The near and far dashes differ by more than 0.16, so the node runs its curve logic: the far dash sits inside the threshold band and becomes error 1.",
    s: 2.3,
    off: -0.15,
    dth: 0.2,
    params: LAB_BAND,
  },
  {
    id: "full-right",
    label: "All lines centred",
    tag: "lab band",
    hint: "Lab band, the tape crossing the centre line. The two dashes differ by more than 0.16 but both sit inside the threshold band, so both errors become 1 and the node publishes 1.0: full right.",
    s: 2.34,
    off: -0.1,
    dth: 0.15,
    params: LAB_BAND,
  },
];

/** Car pose from arc length + lateral offset (+ left) + heading offset. */
export function poseAt(world: World, s: number, off: number, dth: number): Pose {
  const p = world.pointAt(s);
  return { x: p.x - Math.sin(p.th) * off, y: p.y + Math.cos(p.th) * off, th: p.th + dth };
}
