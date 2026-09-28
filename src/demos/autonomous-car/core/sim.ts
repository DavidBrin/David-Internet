/**
 * Closed-loop simulation: the virtual OAK-D frame feeds the ported nodes exactly the
 * way the ROS 2 graph wires them, and /cmd_vel drives a kinematic bicycle model.
 *
 *   camera (10 Hz timer in camera_driver2) ─┬─ /object_detections/image ─ lane_detection_node ─ /centroid ─┐
 *                                            ├─ /object_detections/centroid ───────────────────────────────┤ (one, chosen by probe)
 *                                            └─ /object_detections/depth (bbox width) ──────────── lane_guidance_node ─ /cmd_vel ─ vesc_twist_node
 *
 * Physical constants are assumptions (the repo has no vehicle model): 1/10-scale
 * wheelbase 0.33 m, +-26 deg wheel lock at |steering| = 1, speed = 5 m/s x throttle
 * with a 0.3 s lag, 80 ms steering-servo lag. /cmd_vel is read with the course
 * actuator's normalized convention (angular.z in [-1, 1], positive = right).
 */
import { CAMERA, renderCamera, type Pose } from "./camera";
import { bgrFromRGBA } from "./cv";
import { runModel, standInDetections, type DetectorOutput } from "./detect";
import { locateCentroid, type LaneResult } from "./lane";
import { PathPlanner, type Topic, type Twist } from "./control";
import type { GuidanceParams, LaneParams } from "./params";
import { World } from "./world";

export const VEHICLE = {
  wheelbase: 0.33,
  maxWheel: (26 * Math.PI) / 180,
  speedPerThrottle: 5,
  speedLag: 0.3,
  steerLag: 0.08,
};

export interface BusMessage {
  t: number;
  topic: string;
  value: string;
}

export interface SimOptions {
  lane: LaneParams;
  guidance: GuidanceParams;
  /** is the detector node running (publishing /object_detections/centroid)? */
  detector: boolean;
  cameraHz?: number;
  /** render the full frame (for display) or just the lane crop rows */
  fullFrame?: boolean;
  world?: World;
  start?: Pose;
  /**
   * How the avoidance steps' Twists move the car: "twist" reads them in their own units
   * (m/s, rad/s, angular.z > 0 = left: what the step list describes), "actuator" through
   * the course actuator's normalized convention like every other /cmd_vel message.
   */
  avoidMode?: "twist" | "actuator";
  /**
   * Run lane_detection_node on every frame (default true). A garbage run whose probe
   * picked /object_detections/centroid may pass false to save the per-frame render and
   * CV work: the guidance node never reads /centroid then, so nothing it does changes.
   */
  laneNode?: boolean;
}

export class CarSim {
  world: World;
  pose: Pose;
  v = 0;
  steer = 0;
  t = 0;
  cmd: Twist = { linear: 0, angular: 0 };
  lane: LaneParams;
  planner: PathPlanner;
  detector: boolean;
  cameraHz: number;
  fullFrame: boolean;
  topic: Topic = "/centroid";
  avoidMode: "twist" | "actuator";
  laneNode: boolean;

  readonly frame: Uint8ClampedArray;
  frameSeq = 0;
  lastLane: LaneResult | null = null;
  lastDetect: DetectorOutput | null = null;
  /** last value on each topic */
  bus = new Map<string, BusMessage>();
  onMessage?: (m: BusMessage) => void;
  servoAngle = 0;
  servoOn = false;
  private servoT0 = 0;
  /** garbage the sweep will scoop (the widest box when the stop fired) */
  private scoopTarget: string | null = null;
  collected: string[] = [];
  private nextFrame = 0;
  private nextTick = 0;
  /** distance travelled along the centre line (for lap progress) */
  progress = 0;
  private lastS: number | null = null;
  trail: [number, number][] = [];
  history: { t: number; error: number | null; steering: number; throttle: number; cte: number }[] = [];

  constructor(o: SimOptions) {
    this.world = o.world ?? new World({ garbage: [] });
    const s0 = this.world.pointAt(0);
    this.pose = o.start ?? { x: s0.x, y: s0.y, th: s0.th };
    this.lane = o.lane;
    this.planner = new PathPlanner(o.guidance);
    this.detector = o.detector;
    this.cameraHz = o.cameraHz ?? 10;
    this.fullFrame = o.fullFrame ?? true;
    this.avoidMode = o.avoidMode ?? "actuator";
    this.laneNode = o.laneNode ?? true;
    this.frame = new Uint8ClampedArray(CAMERA.W * CAMERA.H * 4);
    this.planner.publish = (tw) => this.apply(tw);
    this.planner.onSweep = (on, t) => {
      this.servoOn = on;
      this.servoT0 = t;
      if (on) {
        const preds = this.lastDetect?.preds ?? [];
        const widest = preds.reduce<(typeof preds)[number] | null>((m, p) => (!m || p.width > m.width ? p : m), null);
        this.scoopTarget = widest?.id ?? null;
      }
      this.publish("servo_sweeper", on ? "spawned: ros2 run final_pkg servo_sweeper" : "terminated");
    };
    // startup: the guidance node probes /object_detections/centroid for 3 s; the
    // detector only publishes it when something is in view, and the car is parked
    const seen = this.detector && runModel(standInDetections(this.world, this.pose), CAMERA.W).flag;
    this.topic = this.planner.probe(seen, this.detector, 0);
  }

  /** Remove a garbage item (the sweep's scoop collected it). */
  collect(id: string) {
    this.world.garbage = this.world.garbage.filter((g) => g.id !== id);
  }

  private publish(topic: string, value: string) {
    const m = { t: this.t, topic, value };
    this.bus.set(topic, m);
    this.onMessage?.(m);
  }

  /** One camera frame through the whole graph. */
  private cameraFrame() {
    const rowsOnly = !this.fullFrame;
    const crop = rowsOnly ? cropRows(this.lane) : undefined;
    const seed = ++this.frameSeq;
    if (this.laneNode || this.fullFrame) renderCamera(this.world, this.pose, this.frame, CAMERA, { rows: crop, seed });

    // object_detection_node publishes the image first, then its detections
    this.publish("/object_detections/image", `sensor_msgs/Image ${CAMERA.W}x${CAMERA.H} bgr8 #${this.frameSeq}`);
    if (this.detector) {
      const det = runModel(standInDetections(this.world, this.pose), CAMERA.W);
      this.lastDetect = det;
      this.publish("/object_detections/flag", `data: ${det.flag ? "true" : "false"}`);
      if (det.centroid !== null) {
        this.publish("/object_detections/centroid", `data: ${det.centroid.toFixed(4)}`);
        if (this.topic === "/object_detections/centroid") this.planner.onCentroid(det.centroid, this.t);
      }
      if (det.width !== null) {
        this.publish("/object_detections/depth", `data: ${det.width.toFixed(1)}  # bbox width, px`);
        this.planner.onWidth(det.width, this.t);
      }
    }

    // lane_detection_node, subscribed to the same image topic
    const lane = this.laneNode ? locateCentroid(bgrFromRGBA(this.frame, CAMERA.W, CAMERA.H), this.lane) : null;
    this.lastLane = lane;
    if (lane && lane.error !== null) {
      this.publish("/centroid", `data: ${lane.error.toFixed(4)}`);
      if (this.topic === "/centroid") this.planner.onCentroid(lane.error, this.t);
    }
    const tr = this.world.track(this.pose.x, this.pose.y);
    this.history.push({
      t: this.t,
      error: this.topic === "/centroid" ? (lane?.error ?? null) : (this.lastDetect?.centroid ?? null),
      steering: this.cmd.angular,
      throttle: this.cmd.linear,
      cte: tr ? tr.d : NaN,
    });
    if (this.history.length > 600) this.history.shift();
  }

  private apply(tw: Twist) {
    this.cmd = tw;
    this.publish("/cmd_vel", `linear.x: ${tw.linear.toFixed(3)}  angular.z: ${tw.angular.toFixed(3)}`);
  }

  /** Advance simulated time by dt seconds (internally 5 ms physics steps). */
  step(dt: number) {
    const h = 0.005;
    const end = this.t + dt;
    while (this.t < end - 1e-9) {
      if (this.t >= this.nextFrame) {
        this.cameraFrame();
        this.nextFrame += 1 / this.cameraHz;
      }
      if (this.t >= this.nextTick) {
        this.planner.tick(this.t);
        this.nextTick += 0.1;
      }
      // servo_sweeper.py: 0 deg, hold 1 s, 100 deg, hold 1 s, disable
      if (this.servoOn) {
        const e = this.t - this.servoT0;
        this.servoAngle = e < 1 ? 0 : e < 2 ? 100 : this.servoAngle;
        // the arm's scoop collects the item as it swings to 100 deg (per David)
        if (e >= 1 && this.scoopTarget) {
          this.collect(this.scoopTarget);
          this.collected.push(this.scoopTarget);
          this.publish("servo_sweeper", `scooped ${this.scoopTarget}`);
          this.scoopTarget = null;
        }
      }
      this.physics(h);
      this.t += h;
    }
  }

  private physics(h: number) {
    const p0 = this.pose;
    if (this.planner.isAvoiding && this.avoidMode === "twist") {
      this.v = this.cmd.linear;
      p0.x += this.cmd.linear * Math.cos(p0.th) * h;
      p0.y += this.cmd.linear * Math.sin(p0.th) * h;
      p0.th += this.cmd.angular * h;
      return;
    }
    const vTarget = this.cmd.linear * VEHICLE.speedPerThrottle;
    this.v += (vTarget - this.v) * Math.min(1, h / VEHICLE.speedLag);
    const sTarget = Math.max(-1, Math.min(1, this.cmd.angular));
    this.steer += (sTarget - this.steer) * Math.min(1, h / VEHICLE.steerLag);
    const delta = -this.steer * VEHICLE.maxWheel; // positive steering = right = clockwise
    const p = this.pose;
    p.x += this.v * Math.cos(p.th) * h;
    p.y += this.v * Math.sin(p.th) * h;
    p.th += (this.v / VEHICLE.wheelbase) * Math.tan(delta) * h;
    const tr = this.world.track(p.x, p.y);
    if (tr) {
      if (this.lastS !== null) {
        let ds = tr.s - this.lastS;
        const L = this.world.length;
        if (ds > L / 2) ds -= L;
        if (ds < -L / 2) ds += L;
        if (Math.abs(ds) < 0.5) this.progress += ds;
      }
      this.lastS = tr.s;
    }
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(p.x - last[0], p.y - last[1]) > 0.05) {
      this.trail.push([p.x, p.y]);
      if (this.trail.length > 1500) this.trail.shift();
    }
  }

  /** true when the car has wandered off the taped course */
  lost(): boolean {
    const tr = this.world.track(this.pose.x, this.pose.y);
    return !tr || Math.abs(tr.d) > 0.28;
  }
}

/** Rows the lane node reads, so headless sims can skip the rest of the frame. */
export function cropRows(p: LaneParams): [number, number] {
  const H = CAMERA.H;
  const rowsToWatch = Math.trunc(H * p.rows_to_watch_decimal);
  const start = Math.trunc(H - Math.trunc(H * (1 - p.rows_offset_decimal)));
  return [start, start + rowsToWatch];
}

/**
 * The avoidance maneuver read in Twist's own units (m/s, rad/s, angular.z > 0 = left),
 * i.e. the path the step list describes for a robot that can turn in place.
 */
export function unicyclePath(steps: { duration: number; twist: Twist }[], start: Pose, dt = 0.02): { t: number; pose: Pose; step: number }[] {
  const out: { t: number; pose: Pose; step: number }[] = [];
  const p = { ...start };
  let t = 0;
  steps.forEach((s, i) => {
    for (let e = 0; e < s.duration; e += dt) {
      p.x += s.twist.linear * Math.cos(p.th) * dt;
      p.y += s.twist.linear * Math.sin(p.th) * dt;
      p.th += s.twist.angular * dt;
      t += dt;
      out.push({ t, pose: { ...p }, step: i + 1 });
    }
  });
  return out;
}
