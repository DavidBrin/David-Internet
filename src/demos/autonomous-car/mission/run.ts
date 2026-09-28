/**
 * One garbage run for the #mission panel: a CarSim in garbage mode on the south
 * straight, plus the bookkeeping the panel draws (trail, width history, threshold
 * crossings, the maneuver's planned path, end-of-run detection). Nothing here changes
 * what the ported nodes do; it only watches them.
 */
import { CarSim, unicyclePath } from "../core/sim";
import type { Pose } from "../core/camera";
import { GUIDANCE_PARAMS, LANE_PARAMS } from "../core/params";
import { World, type Garbage } from "../core/world";

export type AvoidMode = "twist" | "actuator";

/** Start pose on the south straight (y = 6, heading east), 2.4 m short of the first item. */
export const START: Pose = { x: 24.6, y: 6.0, th: 0.02 };

/**
 * Three items about 2.2 m apart along the tape, slightly off-centre. Checked in
 * simulation: after each maneuver the next item is already in the detector's view with
 * confidence above 0.60, so the guidance node has a centroid to steer by when it resumes.
 */
export function missionGarbage(): Garbage[] {
  const [box, bag, bottle] = World.defaultGarbage();
  return [
    { ...box, x: 27.0, y: 6.1 },
    { ...bag, x: 29.2, y: 5.92, yaw: -0.3 },
    { ...bottle, x: 31.3, y: 6.07, d: 0.1, h: 0.1, yaw: 0.6, label: "plastic bottle" },
  ];
}

/** The live state the panel's state machine shows. */
export type MState = "drive" | "stopped" | "sweeping" | "avoid" | "blocked";

export interface TrailPt {
  x: number;
  y: number;
  /** true while the avoidance steps are running */
  avoid: boolean;
}

export interface Crossing {
  t: number;
  w: number;
}

export class MissionRun {
  readonly sim: CarSim;
  readonly items: Garbage[];
  readonly mode: AvoidMode;
  trail: TrailPt[] = [];
  /** one sample per camera frame: widest box (px) or null when nothing was detected */
  widths: { t: number; w: number | null }[] = [];
  crossings: Crossing[] = [];
  /** the step list read in Twist units from where the maneuver starts */
  plan: { pose: Pose; pts: { x: number; y: number; step: number }[]; frozen: boolean } | null = null;
  /** pose of the last camera frame (the detections belong to it) */
  framePose: Pose;
  frameSeq = 0;
  done = false;
  doneAt: number | null = null;
  private idleSince: number | null = null;
  private planStart: number | null = null;

  constructor(world: World, mode: AvoidMode) {
    this.items = missionGarbage();
    world.garbage = this.items.map((g) => ({ ...g }));
    this.mode = mode;
    this.sim = new CarSim({
      lane: LANE_PARAMS,
      guidance: GUIDANCE_PARAMS,
      detector: true,
      avoidMode: mode,
      start: { ...START },
      world,
      fullFrame: false,
      laneNode: false,
    });
    this.framePose = { ...this.sim.pose };
    this.sim.onMessage = (m) => {
      if (m.topic === "/object_detections/image") {
        this.framePose = { ...this.sim.pose };
        this.frameSeq++;
      } else if (m.topic === "/object_detections/flag") {
        this.widths.push({ t: m.t, w: this.sim.lastDetect?.width ?? null });
        if (this.widths.length > 400) this.widths.splice(0, this.widths.length - 400);
      }
    };
    this.sim.planner.onLog = (l) => {
      if (l.level !== "WARN") return;
      const m = /at ([\d.]+)px/.exec(l.msg);
      if (m) this.crossings.push({ t: l.t, w: Number(m[1]) });
    };
    this.trail.push({ x: START.x, y: START.y, avoid: false });
  }

  get state(): MState {
    const s = this.sim;
    const p = s.planner;
    if (p.isBlocked(s.t)) return "blocked";
    if (p.isSweeping) {
      // the width callback sets obstacle_too_large and is_sweeping together; the
      // controller answers with zero throttle, and the car coasts to a halt first
      if (!p.isAvoiding && p.sweepStart !== null && s.t - p.sweepStart < 1.5 && Math.abs(s.v) > 0.03) return "stopped";
      return "sweeping";
    }
    if (p.isAvoiding) return "avoid";
    if (p.obstacleTooLarge) return "stopped";
    return "drive";
  }

  /** servo_sweeper's own phase, from the time since the guidance node spawned it */
  get servoPhase(): "idle" | "zero" | "hundred" | "disabled" {
    const s = this.sim;
    const p = s.planner;
    if (!s.servoOn || p.sweepStart === null) return "idle";
    const e = s.t - p.sweepStart;
    return e < 1 ? "zero" : e < 2 ? "hundred" : "disabled";
  }

  advance(dt: number) {
    if (this.done) return;
    const s = this.sim;
    const p = s.planner;
    s.step(dt);

    const last = this.trail[this.trail.length - 1];
    if (Math.hypot(s.pose.x - last.x, s.pose.y - last.y) > 0.02) {
      this.trail.push({ x: s.pose.x, y: s.pose.y, avoid: p.isAvoiding });
      if (this.trail.length > 3000) this.trail.shift();
    }

    // the maneuver as the step list describes it: previewed during the sweep, fixed
    // where step 1 actually starts (kept on screen until the next sweep)
    if (p.isAvoiding && p.avoidanceStep === 1 && p.avoidanceStart !== null && this.planStart !== p.avoidanceStart) {
      this.planStart = p.avoidanceStart;
      this.plan = { pose: { ...s.pose }, pts: this.path(s.pose), frozen: true };
    } else if (p.isSweeping && !p.isAvoiding) {
      this.plan = { pose: { ...s.pose }, pts: this.path(s.pose), frozen: false };
    }

    // end of run: nothing in view, nothing being published, car at rest
    const idle =
      this.state === "drive" && !(s.lastDetect?.preds.length ?? 0) && Math.abs(s.cmd.linear) < 1e-9 && Math.abs(s.v) < 0.01;
    if (idle) {
      if (this.idleSince === null) this.idleSince = s.t;
      else if (s.t - this.idleSince > 1.0) this.finish();
    } else this.idleSince = null;
    if (s.t > 150) this.finish();
  }

  private finish() {
    this.done = true;
    this.doneAt = this.sim.t;
  }

  private path(from: Pose) {
    return unicyclePath(this.sim.planner.steps(), from, 0.05).map((q) => ({ x: q.pose.x, y: q.pose.y, step: q.step }));
  }
}
