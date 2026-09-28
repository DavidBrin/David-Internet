/**
 * lane_guidance_node (Code/lane_guidance_node3.py → PathPlanner), ported with an
 * injected clock so the page can run it in simulated time. Callbacks map 1:1:
 *
 *   probe()          check_topic_availability: /object_detections/centroid live within 3 s?
 *   onCentroid(e)    controller(): gain-scheduled throttle + PID steering → /cmd_vel
 *   onWidth(w)       width_callback → check_for_obstacles: > width_threshold starts a sweep
 *   tick()           the 0.1 s sweep_timer: ends the sweep, runs the 5 avoidance steps
 *
 * Every Twist goes out through `publish` (the /cmd_vel publisher), so a caller sees
 * exactly the messages the node would send.
 *
 * Kept as written: Ts is fixed at 1/20 s whatever the real message rate; the integral
 * is clamped to 1e-8; avoidance steps are timed open loop (duration = distance / speed)
 * and use ROS's "negative angular.z = right" while the PID path uses positive = right
 * (the course actuator's convention); finish_avoidance_maneuver sleeps resume_delay
 * inside the timer callback, which blocks the single-threaded executor: messages that
 * arrive meanwhile queue (QoS depth 10, oldest dropped) and missed timer periods
 * coalesce into one call, all handled when the sleep ends (timer first, then messages
 * in arrival order).
 */
import type { GuidanceParams } from "./params";

export interface Twist {
  /** linear.x */
  linear: number;
  /** angular.z */
  angular: number;
}

export type Topic = "/centroid" | "/object_detections/centroid";

export type Phase = "drive" | "stopped" | "sweeping" | "avoiding";

export interface AvoidStep {
  n: number;
  label: string;
  duration: number;
  twist: Twist;
}

export interface LogLine {
  t: number;
  level: "INFO" | "WARN";
  msg: string;
}

const QOS_DEPTH = 10;

export class PathPlanner {
  readonly p: GuidanceParams;
  topic: Topic = "/centroid";

  // PID state
  readonly Ts = 1 / 20;
  /**
   * Page-only experiment (not in the node): when set, the derivative and integral terms
   * use this timestep instead of the hard-coded Ts. null (the default) = as written.
   */
  tsOverride: number | null = null;
  ek = 0;
  ek1 = 0;
  proportional = 0;
  derivative = 0;
  integral = 0;
  readonly integralMax = 1e-8;
  lastThrottle = 0;
  lastSteering = 0;

  // obstacle state
  obstacleTooLarge = false;
  isSweeping = false;
  isAvoiding = false;
  avoidanceStep = 0;
  avoidanceStart: number | null = null;
  sweepStart: number | null = null;
  lastWidth: number | null = null;
  blockedUntil = -Infinity;
  private lastWidthLog: number | null = null;
  private queue: { kind: "centroid" | "width"; v: number }[] = [];
  private pendingTick = false;

  readonly turnDuration: number;
  readonly forwardDuration: number;
  readonly reverseDuration: number;
  readonly finalForwardDuration: number;

  logs: LogLine[] = [];
  onLog?: (l: LogLine) => void;
  /** the /cmd_vel publisher */
  publish: (tw: Twist, t: number) => void = () => {};
  /** called when the node spawns / kills `ros2 run final_pkg servo_sweeper` */
  onSweep?: (running: boolean, t: number) => void;
  /** PID the spawned servo_sweeper process reports */
  nextPid = 4217;

  constructor(p: GuidanceParams) {
    this.p = { ...p };
    this.turnDuration = Math.abs(((p.turn_angle_deg * Math.PI) / 180) / p.turn_speed);
    this.forwardDuration = Math.abs(p.forward_distance / p.forward_speed);
    this.reverseDuration = Math.abs(p.reverse_distance / p.reverse_speed);
    this.finalForwardDuration = Math.abs(p.final_forward_distance / p.forward_speed);
  }

  private log(t: number, msg: string, level: LogLine["level"] = "INFO") {
    const l = { t, level, msg };
    this.logs.push(l);
    if (this.logs.length > 400) this.logs.splice(0, this.logs.length - 400);
    this.onLog?.(l);
  }

  /** check_topic_availability (3 s timeout): the subscription is chosen once, at startup. */
  probe(objectDataSeen: boolean, objectTopicExists: boolean, t = 0, objectTopicType = "std_msgs/msg/Float32"): Topic {
    this.log(t, "Checking topic availability...");
    if (!objectTopicExists) {
      this.log(t, "Topic /object_detections/centroid not found. Using /centroid");
      this.topic = "/centroid";
    } else if (objectTopicType !== "std_msgs/msg/Float32") {
      this.log(t, "Topic /object_detections/centroid has wrong message type. Using /centroid", "WARN");
      this.topic = "/centroid";
    } else if (objectDataSeen) {
      this.log(t, "Topic /object_detections/centroid found. Testing for active data...");
      this.log(t, "Data detected on /object_detections/centroid. Using this topic.");
      this.topic = "/object_detections/centroid";
    } else {
      this.log(t, "Topic /object_detections/centroid found. Testing for active data...");
      this.log(t, "No data detected on /object_detections/centroid within 3.0s. Using /centroid");
      this.topic = "/centroid";
    }
    return this.topic;
  }

  get phase(): Phase {
    if (this.isAvoiding) return "avoiding";
    if (this.isSweeping) return "sweeping";
    if (this.obstacleTooLarge) return "stopped";
    return "drive";
  }

  /** Steps of the avoidance maneuver with their durations and Twist commands. */
  steps(): AvoidStep[] {
    const p = this.p;
    return [
      { n: 1, label: "Turning right 80 degrees", duration: this.turnDuration, twist: { linear: 0, angular: -p.turn_speed } },
      { n: 2, label: "Moving forward 0.4m", duration: this.forwardDuration, twist: { linear: p.forward_speed, angular: 0 } },
      { n: 3, label: "Moving backward 0.4m", duration: this.reverseDuration, twist: { linear: p.reverse_speed, angular: 0 } },
      { n: 4, label: "Turning left 80 degrees", duration: this.turnDuration, twist: { linear: 0, angular: p.turn_speed } },
      { n: 5, label: "Moving forward 0.34m", duration: this.finalForwardDuration, twist: { linear: p.forward_speed, angular: 0 } },
    ];
  }

  private clamp(value: number, upper: number, lower?: number): number {
    const lo = lower === undefined ? -upper : lower;
    if (value < lo) return lo;
    if (value > upper) return upper;
    return value;
  }

  /** Deliver anything the blocking sleep held back, once the node is free again. */
  private drain(t: number): boolean {
    if (t < this.blockedUntil) return false;
    if (this.pendingTick || this.queue.length) {
      const tick = this.pendingTick;
      const q = this.queue;
      this.pendingTick = false;
      this.queue = [];
      if (tick) this.tickNow(t);
      for (const m of q) {
        if (t < this.blockedUntil) {
          this.enqueue(m.kind, m.v);
          continue;
        }
        if (m.kind === "centroid") this.controller(m.v, t);
        else this.widthCallback(m.v, t);
      }
    }
    return true;
  }

  private enqueue(kind: "centroid" | "width", v: number) {
    this.queue.push({ kind, v });
    const same = this.queue.filter((m) => m.kind === kind);
    if (same.length > QOS_DEPTH) this.queue.splice(this.queue.indexOf(same[0]), 1);
  }

  /** A message on the subscribed centroid topic. */
  onCentroid(e: number, t: number): void {
    if (!this.drain(t)) return this.enqueue("centroid", e);
    this.controller(e, t);
  }

  /** A message on /object_detections/depth (the bbox width). */
  onWidth(w: number, t: number): void {
    if (!this.drain(t)) return this.enqueue("width", w);
    this.widthCallback(w, t);
  }

  /** The 0.1 s sweep_timer firing. */
  tick(t: number): void {
    if (!this.drain(t)) {
      this.pendingTick = true;
      return;
    }
    this.tickNow(t);
  }

  isBlocked(t: number): boolean {
    return t < this.blockedUntil;
  }

  private controller(e: number, t: number) {
    if (this.obstacleTooLarge || this.isSweeping || this.isAvoiding) {
      if (!this.isAvoiding) this.publish({ linear: this.p.zero_throttle, angular: 0 }, t);
      return;
    }
    const p = this.p;
    this.ek = e;
    // throttle gain scheduling (function of error)
    const infThrottle = p.min_throttle - (p.min_throttle - p.max_throttle) / (1 - p.error_threshold);
    const throttleRaw = ((p.min_throttle - p.max_throttle) / (1 - p.error_threshold)) * Math.abs(this.ek) + infThrottle;
    const throttle = this.clamp(throttleRaw, p.max_throttle, p.min_throttle);
    // steering PID
    this.proportional = p.Kp_steering * this.ek;
    const Ts = this.tsOverride ?? this.Ts;
    this.derivative = (p.Kd_steering * (this.ek - this.ek1)) / Ts;
    this.integral += p.Ki_steering * this.ek * Ts;
    this.integral = this.clamp(this.integral, this.integralMax);
    const steeringRaw = this.proportional + this.derivative + this.integral;
    const steering = this.clamp(steeringRaw, p.max_right_steering, p.max_left_steering);
    this.lastThrottle = throttle;
    this.lastSteering = steering;
    this.publish({ linear: throttle, angular: steering }, t);
    this.ek1 = this.ek;
  }

  private widthCallback(w: number, t: number) {
    this.lastWidth = w;
    if (!Number.isFinite(w) || w <= 0) return;
    const tooLarge = w > this.p.width_threshold;
    if (this.lastWidthLog === null) this.lastWidthLog = t;
    else if (t - this.lastWidthLog > 2.0) {
      this.log(t, `Object width: ${w.toFixed(1)}px, Threshold: ${this.p.width_threshold.toFixed(1)}px`);
      this.lastWidthLog = t;
    }
    if (tooLarge && !this.obstacleTooLarge && !this.isSweeping) {
      this.log(t, `Obstacle too large at ${w.toFixed(1)}px! Stopping and initiating sweep.`, "WARN");
      this.obstacleTooLarge = true;
      this.log(t, "Starting servo sweeper...");
      this.isSweeping = true;
      this.sweepStart = t;
      this.onSweep?.(true, t);
      this.log(t, `Servo sweeper started with PID: ${this.nextPid++}`);
    } else if (!tooLarge && this.obstacleTooLarge && !this.isSweeping) {
      this.log(t, "Obstacle became smaller or path clear, resuming normal operation.");
      this.obstacleTooLarge = false;
    }
  }

  private tickNow(t: number) {
    if (this.isSweeping && this.sweepStart !== null) {
      if (t - this.sweepStart >= this.p.sweep_duration) {
        this.log(t, "Sweep duration completed, stopping sweep...");
        this.log(t, "Stopping servo sweeper...");
        this.onSweep?.(false, t);
        this.log(t, "Servo sweeper stopped.");
        this.log(t, "Starting avoidance maneuver sequence...");
        this.isAvoiding = true;
        this.avoidanceStep = 1;
        this.avoidanceStart = t;
        this.log(t, "Step 1: Turning right 80 degrees...");
        this.isSweeping = false;
        this.sweepStart = null;
      }
    } else if (this.isAvoiding && this.avoidanceStart !== null) {
      this.executeStep(t);
    }
  }

  private executeStep(t: number) {
    const el = t - this.avoidanceStart!;
    const steps = this.steps();
    const step = steps[this.avoidanceStep - 1];
    if (!step) return;
    if (el < step.duration) {
      this.publish({ ...step.twist }, t);
      return;
    }
    if (this.avoidanceStep < 5) {
      const next = steps[this.avoidanceStep];
      this.avoidanceStep += 1;
      this.avoidanceStart = t;
      this.log(t, `Step ${next.n}: ${next.label}...`);
      this.publish({ linear: 0, angular: 0 }, t);
      return;
    }
    // finish_avoidance_maneuver
    this.log(t, "Avoidance maneuver completed. Resuming normal guidance...");
    this.publish({ linear: 0, angular: 0 }, t);
    this.isAvoiding = false;
    this.avoidanceStep = 0;
    this.avoidanceStart = null;
    this.obstacleTooLarge = false;
    // time.sleep(resume_delay) inside the timer callback
    this.blockedUntil = t + this.p.resume_delay;
  }
}

/** Throttle schedule as a function of |error| (for plotting the gain-scheduling curve). */
export function scheduledThrottle(absErr: number, p: GuidanceParams): number {
  const inf = p.min_throttle - (p.min_throttle - p.max_throttle) / (1 - p.error_threshold);
  const raw = ((p.min_throttle - p.max_throttle) / (1 - p.error_threshold)) * absErr + inf;
  return Math.min(p.max_throttle, Math.max(p.min_throttle, raw));
}
