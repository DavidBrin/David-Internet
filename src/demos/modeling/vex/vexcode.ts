/**
 * vexcode.ts -- a small TypeScript port of the VEXcode VR API surface used by
 * the six ported programs in programs.ts (drivetrain, pen, location, distance,
 * the two optical eyes, bumpers, brain). This is the real simulation engine
 * for the #vex panel: robot kinematics, wall/floor collision, sensing, and a
 * coroutine Runner that steps a program (a generator of Op) against a Sim one
 * op at a time so the UI can animate and highlight the source line that op
 * came from.
 *
 * Field convention: millimeters, heading 0 = north/up, clockwise positive
 * (matches VEX VR). World coordinates are y-up; canvas rendering (render.ts)
 * flips y for screen space. All comments/identifiers are ASCII-only.
 */

// ---------------------------------------------------------------------------
// Geometry & world types
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned wall rectangle. All walls are the same "red-ish" sensor color. */
export interface WallRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Axis-aligned floor paint rectangle (only green finish marks are used here). */
export interface FloorMark {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: "green";
}

export interface World {
  /** World spans [-halfW, halfW] x [-halfH, halfH] mm. */
  halfW: number;
  halfH: number;
  walls: WallRect[];
  floorMarks: FloorMark[];
}

export interface RobotState {
  x: number;
  y: number;
  heading: number; // degrees, [0, 360)
  penDown: boolean;
  driveVelocityPct: number;
  turnVelocityPct: number;
  continuousDrive: "fwd" | "rev" | null;
  bumperLeft: boolean;
  bumperRight: boolean;
  /** Completed pen strokes plus the in-progress one (last entry), each a polyline. */
  trail: Vec2[][];
}

// ---------------------------------------------------------------------------
// Tuning constants (simulation calibration, not real VEX hardware numbers)
// ---------------------------------------------------------------------------

export const ROBOT_RADIUS = 75; // mm, collision + drawing radius
export const FRONT_PROBE_MM = 115; // how far ahead the front eye looks
export const EYE_PAD_MM = 20; // tolerance added around wall/mark rects for eye checks
export const MAX_SENSOR_RANGE = 4000; // mm, distance sensor fallback range
const BASE_SPEED_MM_S = 260; // drivetrain speed at 100% velocity
const BASE_TURN_DEG_S = 220; // turn speed at 100% velocity
const MOVE_SUBSTEP_MM = 8; // collision-check granularity

function normalizeHeading(h: number): number {
  let n = h % 360;
  if (n < 0) n += 360;
  return n;
}

function dirVec(headingDeg: number): Vec2 {
  const rad = (headingDeg * Math.PI) / 180;
  return { x: Math.sin(rad), y: Math.cos(rad) };
}

function shortestTurnDelta(from: number, to: number): number {
  let d = normalizeHeading(to) - normalizeHeading(from);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

// ---------------------------------------------------------------------------
// Collision + sensing geometry
// ---------------------------------------------------------------------------

function circleRectDistance(px: number, py: number, r: WallRect): number {
  const cx = Math.max(r.x0, Math.min(px, r.x1));
  const cy = Math.max(r.y0, Math.min(py, r.y1));
  return Math.hypot(px - cx, py - cy);
}

function rectContains(px: number, py: number, r: { x0: number; y0: number; x1: number; y1: number }, pad = 0): boolean {
  return px >= r.x0 - pad && px <= r.x1 + pad && py >= r.y0 - pad && py <= r.y1 + pad;
}

/** Nearest wall within `radius` of (px,py), or null. */
function firstWallCollision(world: World, px: number, py: number, radius: number): WallRect | null {
  let best: WallRect | null = null;
  let bestD = radius;
  for (const w of world.walls) {
    const d = circleRectDistance(px, py, w);
    if (d <= bestD) {
      best = w;
      bestD = d;
    }
  }
  return best;
}

/** Ray-vs-axis-aligned-rect distance along a unit direction; null if it misses. */
function rayRectDistance(x: number, y: number, dx: number, dy: number, r: WallRect): number | null {
  let tmin = 0;
  let tmax = MAX_SENSOR_RANGE;
  if (Math.abs(dx) < 1e-9) {
    if (x < r.x0 || x > r.x1) return null;
  } else {
    let t1 = (r.x0 - x) / dx;
    let t2 = (r.x1 - x) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y < r.y0 || y > r.y1) return null;
  } else {
    let t1 = (r.y0 - y) / dy;
    let t2 = (r.y1 - y) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (tmin < 0) return tmax >= 0 ? 0 : null;
  return tmin;
}

function raycastDistance(world: World, x: number, y: number, headingDeg: number): number {
  const { x: dx, y: dy } = dirVec(headingDeg);
  let best = MAX_SENSOR_RANGE;
  for (const w of world.walls) {
    const t = rayRectDistance(x, y, dx, dy, w);
    if (t !== null && t < best) best = t;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32) so a given run number reproduces the same numbers
// ---------------------------------------------------------------------------

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

// ---------------------------------------------------------------------------
// Op: a data description of one drivetrain/pen/brain/wait command, tagged
// with the listing line it came from. Generators yield these; the Runner
// interprets them against a Sim.
// ---------------------------------------------------------------------------

export type Dir = "fwd" | "rev";
export type TurnDir = "left" | "right";
export type PenState = "up" | "down";
export type Axis = "X" | "Y";

interface OpBase {
  line: number;
}

export type Op =
  | (OpBase & { kind: "setDriveVelocity"; pct: number })
  | (OpBase & { kind: "setTurnVelocity"; pct: number })
  | (OpBase & { kind: "driveFor"; dir: Dir; mm: number })
  | (OpBase & { kind: "drive"; dir: Dir })
  | (OpBase & { kind: "stop" })
  | (OpBase & { kind: "turnFor"; dir: TurnDir; deg: number })
  | (OpBase & { kind: "turnToHeading"; deg: number })
  | (OpBase & { kind: "penMove"; state: PenState })
  | (OpBase & { kind: "wait"; ms: number })
  | (OpBase & { kind: "waitUntil"; cond: () => boolean })
  | (OpBase & { kind: "print"; text: string });

// ---------------------------------------------------------------------------
// Sim: mutable robot + world state, plus the VexApi surface programs call.
// ---------------------------------------------------------------------------

export class Sim {
  robot: RobotState;
  world: World;
  brain: string[] = [];

  constructor(world: World, startX: number, startY: number, startHeading: number) {
    this.world = world;
    this.robot = {
      x: startX,
      y: startY,
      heading: normalizeHeading(startHeading),
      penDown: false,
      driveVelocityPct: 50,
      turnVelocityPct: 50,
      continuousDrive: null,
      bumperLeft: false,
      bumperRight: false,
      trail: [],
    };
  }

  private pushTrailPoint(): void {
    if (!this.robot.penDown) return;
    const trail = this.robot.trail;
    const last = trail[trail.length - 1];
    if (!last) return;
    last.push({ x: this.robot.x, y: this.robot.y });
  }

  setPen(state: PenState): void {
    this.robot.penDown = state === "down";
    if (this.robot.penDown) {
      this.robot.trail.push([{ x: this.robot.x, y: this.robot.y }]);
    }
  }

  /** Move up to `distanceMm` forward (sign=1) or reverse (sign=-1) along the current heading.
   *  Stops early on wall collision. Returns actual distance moved. */
  moveAlongHeading(sign: 1 | -1, distanceMm: number): { moved: number; collided: boolean } {
    const { x: dx, y: dy } = dirVec(this.robot.heading);
    let moved = 0;
    let collided = false;
    while (moved < distanceMm) {
      const step = Math.min(MOVE_SUBSTEP_MM, distanceMm - moved);
      const nx = this.robot.x + dx * sign * step;
      const ny = this.robot.y + dy * sign * step;
      const hit = firstWallCollision(this.world, nx, ny, ROBOT_RADIUS);
      if (hit) {
        collided = true;
        // left/right side of the contact relative to the heading's forward-right axis
        const cx = Math.max(hit.x0, Math.min(nx, hit.x1));
        const cy = Math.max(hit.y0, Math.min(ny, hit.y1));
        const cross = dx * (cy - this.robot.y) - dy * (cx - this.robot.x);
        if (cross >= 0) this.robot.bumperRight = true;
        else this.robot.bumperLeft = true;
        break;
      }
      this.robot.x = nx;
      this.robot.y = ny;
      this.pushTrailPoint();
      moved += step;
    }
    return { moved, collided };
  }

  turnBy(deltaDeg: number): void {
    this.robot.heading = normalizeHeading(this.robot.heading + deltaDeg);
  }

  frontProbePoint(): Vec2 {
    const { x: dx, y: dy } = dirVec(this.robot.heading);
    return { x: this.robot.x + dx * FRONT_PROBE_MM, y: this.robot.y + dy * FRONT_PROBE_MM };
  }

  frontEyeNearObject(): boolean {
    const p = this.frontProbePoint();
    return this.world.walls.some((w) => rectContains(p.x, p.y, w, EYE_PAD_MM));
  }

  /** Only "red" wall color exists in this port, mirroring the maze's red walls. */
  frontEyeDetectsColor(_color: "red"): boolean {
    return this.frontEyeNearObject();
  }

  downEyeDetectsColor(color: "green"): boolean {
    return this.world.floorMarks.some((m) => m.color === color && rectContains(this.robot.x, this.robot.y, m, 0));
  }

  bumperPressed(side: "left" | "right"): boolean {
    return side === "left" ? this.robot.bumperLeft : this.robot.bumperRight;
  }

  distanceGetDistance(): number {
    return raycastDistance(this.world, this.robot.x, this.robot.y, this.robot.heading);
  }

  locationPosition(axis: Axis): number {
    return axis === "X" ? this.robot.x : this.robot.y;
  }

  headingGet(): number {
    return this.robot.heading;
  }

  clearBumpers(): void {
    this.robot.bumperLeft = false;
    this.robot.bumperRight = false;
  }
}

// ---------------------------------------------------------------------------
// VexApi: the factory functions programs.ts calls. Op-producing methods build
// plain data (no side effects); query methods read the live Sim directly, so
// callers always see up-to-date state between yields.
// ---------------------------------------------------------------------------

export interface VexApi {
  setDriveVelocity(pct: number, line: number): Op;
  setTurnVelocity(pct: number, line: number): Op;
  driveFor(dir: Dir, mm: number, line: number): Op;
  drive(dir: Dir, line: number): Op;
  stop(line: number): Op;
  turnFor(dir: TurnDir, deg: number, line: number): Op;
  turnToHeading(deg: number, line: number): Op;
  penMove(state: PenState, line: number): Op;
  wait(ms: number, line: number): Op;
  waitUntil(cond: () => boolean, line: number): Op;
  brainPrint(text: string, line: number): Op;
  locationPosition(axis: Axis): number;
  distanceGetDistance(): number;
  frontEyeNearObject(): boolean;
  frontEyeDetectsColor(color: "red"): boolean;
  downEyeDetectsColor(color: "green"): boolean;
  bumperPressed(side: "left" | "right"): boolean;
  headingGet(): number;
}

export function createVexApi(sim: Sim): VexApi {
  return {
    setDriveVelocity: (pct, line) => ({ kind: "setDriveVelocity", pct, line }),
    setTurnVelocity: (pct, line) => ({ kind: "setTurnVelocity", pct, line }),
    driveFor: (dir, mm, line) => ({ kind: "driveFor", dir, mm, line }),
    drive: (dir, line) => ({ kind: "drive", dir, line }),
    stop: (line) => ({ kind: "stop", line }),
    turnFor: (dir, deg, line) => ({ kind: "turnFor", dir, deg, line }),
    turnToHeading: (deg, line) => ({ kind: "turnToHeading", deg, line }),
    penMove: (state, line) => ({ kind: "penMove", state, line }),
    wait: (ms, line) => ({ kind: "wait", ms, line }),
    waitUntil: (cond, line) => ({ kind: "waitUntil", cond, line }),
    brainPrint: (text, line) => ({ kind: "print", text, line }),
    locationPosition: (axis) => sim.locationPosition(axis),
    distanceGetDistance: () => sim.distanceGetDistance(),
    frontEyeNearObject: () => sim.frontEyeNearObject(),
    frontEyeDetectsColor: (color) => sim.frontEyeDetectsColor(color),
    downEyeDetectsColor: (color) => sim.downEyeDetectsColor(color),
    bumperPressed: (side) => sim.bumperPressed(side),
    headingGet: () => sim.headingGet(),
  };
}

export type Program = Generator<Op, void, void>;

// ---------------------------------------------------------------------------
// Runner: steps a Program's ops against a Sim, `tickMs` of sim time at a time.
// ---------------------------------------------------------------------------

export class Runner {
  private gen: Program;
  private sim: Sim;
  private current: Op | null = null;
  private drivenMm = 0;
  private turnedDeg = 0;
  private turnTargetDeg = 0;
  private waitRemainingMs = 0;
  finished = false;

  constructor(gen: Program, sim: Sim) {
    this.gen = gen;
    this.sim = sim;
  }

  get currentLine(): number | null {
    return this.current ? this.current.line : null;
  }

  private beginOp(op: Op): boolean {
    // Returns true if the op is already complete (zero-duration ops).
    switch (op.kind) {
      case "setDriveVelocity":
        this.sim.robot.driveVelocityPct = op.pct;
        return true;
      case "setTurnVelocity":
        this.sim.robot.turnVelocityPct = op.pct;
        return true;
      case "drive":
        this.sim.robot.continuousDrive = op.dir;
        return true;
      case "stop":
        this.sim.robot.continuousDrive = null;
        return true;
      case "penMove":
        this.sim.setPen(op.state);
        return true;
      case "print":
        this.sim.brain.push(op.text);
        return true;
      case "driveFor":
        this.drivenMm = 0;
        return op.mm <= 0;
      case "turnFor":
        this.turnedDeg = 0;
        this.turnTargetDeg = Math.abs(op.deg);
        return this.turnTargetDeg <= 0;
      case "turnToHeading":
        this.turnedDeg = 0;
        this.turnTargetDeg = Math.abs(shortestTurnDelta(this.sim.robot.heading, op.deg));
        return this.turnTargetDeg <= 0;
      case "wait":
        this.waitRemainingMs = op.ms;
        return op.ms <= 0;
      case "waitUntil":
        this.sim.clearBumpers();
        return op.cond();
      default:
        return true;
    }
  }

  /** Advance the current op by up to dtMs of sim time; returns ms actually consumed. */
  private advanceOp(op: Op, dtMs: number): { consumed: number; complete: boolean } {
    switch (op.kind) {
      case "driveFor": {
        const speed = (BASE_SPEED_MM_S * Math.abs(this.sim.robot.driveVelocityPct)) / 100;
        const remainMm = op.mm - this.drivenMm;
        const wantMm = (speed * dtMs) / 1000;
        const stepMm = Math.min(wantMm, remainMm);
        const sign: 1 | -1 = op.dir === "fwd" ? 1 : -1;
        const { moved, collided } = this.sim.moveAlongHeading(sign, stepMm);
        this.drivenMm += moved;
        const consumed = speed > 0 ? (moved / speed) * 1000 : dtMs;
        const complete = collided || this.drivenMm >= op.mm - 1e-6;
        return { consumed: Math.max(consumed, collided ? dtMs : 0), complete };
      }
      case "turnFor":
      case "turnToHeading": {
        const speed = (BASE_TURN_DEG_S * Math.abs(this.sim.robot.turnVelocityPct)) / 100;
        const remainDeg = this.turnTargetDeg - this.turnedDeg;
        const wantDeg = (speed * dtMs) / 1000;
        const stepDeg = Math.min(wantDeg, remainDeg);
        let sign = 1;
        if (op.kind === "turnFor") sign = op.dir === "right" ? 1 : -1;
        else sign = shortestTurnDelta(this.sim.robot.heading, op.deg) >= 0 ? 1 : -1;
        this.sim.turnBy(stepDeg * sign);
        this.turnedDeg += stepDeg;
        const consumed = speed > 0 ? (stepDeg / speed) * 1000 : dtMs;
        return { consumed, complete: this.turnedDeg >= this.turnTargetDeg - 1e-6 };
      }
      case "wait": {
        const stepMs = Math.min(dtMs, this.waitRemainingMs);
        this.waitRemainingMs -= stepMs;
        return { consumed: stepMs, complete: this.waitRemainingMs <= 1e-6 };
      }
      case "waitUntil": {
        if (op.cond()) return { consumed: 0, complete: true };
        const dir = this.sim.robot.continuousDrive;
        if (dir) {
          const speed = (BASE_SPEED_MM_S * Math.abs(this.sim.robot.driveVelocityPct)) / 100;
          const stepMm = (speed * dtMs) / 1000;
          const sign: 1 | -1 = dir === "fwd" ? 1 : -1;
          this.sim.moveAlongHeading(sign, stepMm);
        }
        return { consumed: dtMs, complete: op.cond() };
      }
      default:
        return { consumed: dtMs, complete: true };
    }
  }

  /** Advance the whole program by dtMs of sim time (already speed-multiplied by the caller). */
  tick(dtMs: number): void {
    if (this.finished) return;
    let budget = dtMs;
    let guard = 0;
    while (budget >= 0 && !this.finished && guard < 2000) {
      guard++;
      if (!this.current) {
        const n = this.gen.next();
        if (n.done) {
          this.finished = true;
          this.sim.robot.continuousDrive = null;
          return;
        }
        this.current = n.value;
        const doneNow = this.beginOp(this.current);
        if (doneNow) {
          this.current = null;
          if (budget <= 0) return;
          continue;
        }
      }
      const { consumed, complete } = this.advanceOp(this.current, budget);
      budget -= consumed;
      if (complete) this.current = null;
      if (consumed <= 0 && !complete) {
        // waitUntil with no continuous drive and a false condition: nothing more
        // to do this tick (avoid a busy spin).
        return;
      }
      if (budget <= 0) return;
    }
  }
}
