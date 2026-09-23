/**
 * Headless ROS 2 graph runtime for the #ros panel: one CarSim (fullFrame: false) stepped
 * in real time, plus the startup probe of lane_guidance_node3.check_topic_availability
 * played out in simulated time.
 *
 * CarSim runs PathPlanner.probe() in its constructor (t = 0). The panel replays that
 * decision as the node would live through it: while the probe runs the guidance node has
 * no subscriptions yet, so the planner's callbacks are held off (the car stays parked and
 * /cmd_vel is silent) while the camera and lane nodes already publish. The 30 spin_once
 * ticks are real sim time, and in mode (c) the first /object_detections/centroid message
 * that actually arrives ends the wait.
 */
import { CarSim, type BusMessage } from "../core/sim";
import { PathPlanner, type Topic } from "../core/control";
import { GUIDANCE_PARAMS, LANE_PARAMS } from "../core/params";
import { World } from "../core/world";

export type Mode = "a" | "b" | "c";

export const TOPICS = [
  "/object_detections/image",
  "/object_detections/centroid",
  "/object_detections/depth",
  "/object_detections/flag",
  "/centroid",
  "/cmd_vel",
] as const;
export type TopicName = (typeof TOPICS)[number];

export const OBJ = "/object_detections/centroid";
export const LANE = "/centroid";


export type ProbeStage = "check" | "list" | "found" | "spin" | "result" | "subscribed" | "done";

export interface ProbeState {
  stage: ProbeStage;
  /** sim time the probe began */
  t0: number;
  /** spin_once ticks completed (0..30) */
  ticks: number;
  /** tick on which a test message arrived, or null */
  gotTick: number | null;
  /** sim time the spin loop started */
  spinT0: number | null;
  resultAt: number | null;
  chosen: Topic;
}

export interface TermLine {
  t: number;
  level: "INFO" | "WARN";
  msg: string;
}

export interface Held {
  t: number;
  value: string;
}

/** Durations (sim seconds) of the probe's display beats. Everything but the spin loop is instant in ROS. */
const BEAT = { list: 0.6, found: 1.2, spinTick: 0.1, spinTicks: 30, after: 0.6 };
const HIST = 12;

export class RosRuntime {
  readonly mode: Mode;
  readonly sim: CarSim;
  readonly world: World;
  probe: ProbeState;
  hist = new Map<string, Held[]>();
  times = new Map<string, number[]>();
  counts = new Map<string, number>();
  term: TermLine[] = [];
  termVersion = 0;
  lap = 0;
  respawned = 0;
  /** mode (c): guidance has gone quiet after the maneuver */
  idleSince: number | null = null;
  /** graph listener (message animation) */
  onBus?: (m: BusMessage) => void;
  private readonly initialGarbage: ReturnType<typeof World.defaultGarbage>;
  private held = true;

  constructor(mode: Mode) {
    this.mode = mode;
    const garbage = World.defaultGarbage();
    this.initialGarbage = garbage.map((g) => ({ ...g }));
    this.world = new World({ garbage });
    this.sim = new CarSim({
      lane: LANE_PARAMS,
      guidance: GUIDANCE_PARAMS,
      detector: mode !== "a",
      fullFrame: false,
      world: this.world,
      // (c): ~2.4 m before the cardboard box (27.0, 6.1) on the south straight, heading east
      start: mode === "c" ? { x: 24.6, y: 6.0, th: 0.02 } : undefined,
    });
    this.probe = { stage: "check", t0: 0, ticks: 0, gotTick: null, spinT0: null, resultAt: null, chosen: this.sim.topic };
    this.holdPlanner(true);
    this.sim.onMessage = (m) => this.receive(m);
    this.sim.planner.onLog = (l) => {
      if (this.probe.stage === "done") this.push(l.t, l.level, l.msg);
    };
    this.push(0, "INFO", this.plannerLog(0));
  }

  get planner(): PathPlanner {
    return this.sim.planner;
  }

  /** the guidance node's callbacks, unattached until check_topic_availability returns */
  private holdPlanner(hold: boolean) {
    const pl = this.sim.planner;
    this.held = hold;
    if (hold) {
      pl.onCentroid = () => {};
      pl.onWidth = () => {};
      pl.tick = () => {};
    } else {
      pl.onCentroid = PathPlanner.prototype.onCentroid;
      pl.onWidth = PathPlanner.prototype.onWidth;
      pl.tick = PathPlanner.prototype.tick;
    }
  }

  /** the probe's log strings exactly as PathPlanner.probe() wrote them */
  private plannerLog(i: number): string {
    return this.sim.planner.logs[i]?.msg ?? "";
  }

  private push(t: number, level: TermLine["level"], msg: string) {
    this.term.push({ t, level, msg });
    if (this.term.length > 240) this.term.splice(0, this.term.length - 240);
    this.termVersion++;
  }

  private receive(m: BusMessage) {
    if (m.topic !== "servo_sweeper") {
      let h = this.hist.get(m.topic);
      if (!h) this.hist.set(m.topic, (h = []));
      h.push({ t: m.t, value: m.value });
      if (h.length > HIST) h.shift();
      let ts = this.times.get(m.topic);
      if (!ts) this.times.set(m.topic, (ts = []));
      ts.push(m.t);
      if (ts.length > 11) ts.shift();
      this.counts.set(m.topic, (this.counts.get(m.topic) ?? 0) + 1);
    }
    // the temporary test subscription in check_topic_availability
    if (m.topic === OBJ && this.probe.stage === "spin" && this.probe.gotTick === null) {
      this.probe.gotTick = Math.min(BEAT.spinTicks, this.probe.ticks + 1);
    }
    if (m.topic === "/cmd_vel" && this.mode === "c") this.idleSince = null;
    this.onBus?.(m);
  }

  /** is the guidance node subscribed to this topic right now? */
  subscribed(topic: string): boolean {
    if (topic === "/object_detections/image") return true;
    if (topic === "/object_detections/flag") return false;
    if (topic === "/cmd_vel") return true;
    if (this.probe.stage !== "done") {
      // only the temporary test subscription exists during the spin loop
      return topic === OBJ && (this.probe.stage === "spin" || this.probe.stage === "found");
    }
    if (topic === "/object_detections/depth") return this.mode !== "a";
    return topic === this.probe.chosen;
  }

  hz(topic: string): number | null {
    const ts = this.times.get(topic);
    if (!ts || ts.length < 3) return null;
    if (this.sim.t - ts[ts.length - 1] > 1.5) return null;
    return (ts.length - 1) / (ts[ts.length - 1] - ts[0]);
  }

  /** mode (c) after the maneuver: no detections, so no /cmd_vel */
  get idle(): boolean {
    return this.mode === "c" && this.idleSince !== null && this.sim.t - this.idleSince > 1.0;
  }

  step(dt: number) {
    const sim = this.sim;
    sim.step(dt);
    if (this.probe.stage !== "done") this.advanceProbe();
    else this.watch();
  }

  private advanceProbe() {
    const p = this.probe;
    const e = this.sim.t - p.t0;
    const obj = this.mode !== "a";
    if (p.stage === "check" && e >= BEAT.list) p.stage = "list";
    if (p.stage === "list" && e >= BEAT.found) {
      if (!obj) {
        this.push(this.sim.t, "INFO", this.plannerLog(1));
        this.finishProbe();
        return;
      }
      p.stage = "found";
      this.push(this.sim.t, "INFO", this.plannerLog(1));
      p.stage = "spin";
      p.spinT0 = this.sim.t;
    }
    if (p.stage === "spin" && p.spinT0 !== null) {
      const ticks = Math.min(BEAT.spinTicks, Math.floor((this.sim.t - p.spinT0) / BEAT.spinTick + 1e-6));
      p.ticks = Math.max(p.ticks, ticks);
      if (p.gotTick !== null || p.ticks >= BEAT.spinTicks) {
        if (p.gotTick !== null) p.ticks = p.gotTick;
        this.push(this.sim.t, "INFO", this.plannerLog(2));
        this.finishProbe();
      }
    }
    if (p.stage === "result" && p.resultAt !== null && this.sim.t - p.resultAt >= BEAT.after) {
      p.stage = "subscribed";
      this.push(this.sim.t, "INFO", `Subscribed to topic: ${p.chosen}`);
      this.push(this.sim.t, "INFO", "Subscribed to width topic: /object_detections/depth");
      const g = GUIDANCE_PARAMS;
      const pl = this.sim.planner;
      this.push(
        this.sim.t,
        "INFO",
        [
          "",
          `Kp_steering: ${g.Kp_steering}`,
          `Ki_steering: ${py(g.Ki_steering)}`,
          `Kd_steering: ${g.Kd_steering}`,
          `error_threshold: ${g.error_threshold}`,
          `zero_throttle: ${py(g.zero_throttle)}`,
          `max_throttle: ${g.max_throttle}`,
          `min_throttle: ${g.min_throttle}`,
          `max_right_steering: ${py(g.max_right_steering)}`,
          `max_left_steering: ${py(g.max_left_steering)}`,
          `width_threshold: ${py(g.width_threshold)}`,
          `sweep_duration: ${py(g.sweep_duration)}`,
          `final_forward_distance: ${g.final_forward_distance}`,
          `turn_duration: ${pl.turnDuration.toFixed(2)}s`,
          `forward_duration: ${pl.forwardDuration.toFixed(2)}s`,
          `reverse_duration: ${pl.reverseDuration.toFixed(2)}s`,
          `final_forward_duration: ${pl.finalForwardDuration.toFixed(2)}s`,
        ].join("\n"),
      );
      p.stage = "done";
      this.holdPlanner(false);
    }
  }

  private finishProbe() {
    const p = this.probe;
    p.stage = "result";
    p.resultAt = this.sim.t;
  }

  /** loop bookkeeping once the car is live */
  private watch() {
    const sim = this.sim;
    if (this.mode === "c") {
      const pl = sim.planner;
      const quiet = pl.phase === "drive" && !pl.isBlocked(sim.t) && sim.collected.length > 0;
      if (quiet && this.idleSince === null) this.idleSince = sim.t;
      if (!quiet) this.idleSince = null;
      return;
    }
    const lap = Math.floor(sim.progress / this.world.length);
    if (lap > this.lap) {
      this.lap = lap;
      // put scooped items back where they were so every lap shows the width stop
      const back = this.initialGarbage.filter(
        (g) => sim.collected.includes(g.id) && Math.hypot(g.x - sim.pose.x, g.y - sim.pose.y) > 6,
      );
      if (back.length) {
        this.world.garbage.push(...back.map((g) => ({ ...g })));
        sim.collected = sim.collected.filter((id) => !back.some((g) => g.id === id));
        this.respawned += back.length;
      }
    }
  }

  get holding(): boolean {
    return this.held;
  }
}

/** Python's str() of a float: 0.0, 1.0, 200.0 */
function py(v: number): string {
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
}

/** log time on this page's simulated clock (seconds since the graph started) */
export function logTime(t: number): string {
  return `t=${t.toFixed(2)}`;
}

/** header.stamp on the simulated clock (sim seconds, not wall time) */
export function simStamp(t: number): { sec: number; nanosec: number } {
  const sec = Math.floor(t);
  return { sec, nanosec: Math.min(999999999, Math.round((t - sec) * 1e9)) };
}
