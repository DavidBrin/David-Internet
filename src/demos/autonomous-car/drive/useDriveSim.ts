"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Pose } from "../core/camera";
import { GUIDANCE_PARAMS, LANE_PARAMS, type GuidanceParams } from "../core/params";
import { CarSim } from "../core/sim";
import { World } from "../core/world";

/** The guidance parameters the panel exposes. */
export interface Gains {
  Kp_steering: number;
  Ki_steering: number;
  Kd_steering: number;
  max_throttle: number;
  min_throttle: number;
  error_threshold: number;
}

export const TEAM_GAINS: Gains = {
  Kp_steering: GUIDANCE_PARAMS.Kp_steering,
  Ki_steering: GUIDANCE_PARAMS.Ki_steering,
  Kd_steering: GUIDANCE_PARAMS.Kd_steering,
  max_throttle: GUIDANCE_PARAMS.max_throttle,
  min_throttle: GUIDANCE_PARAMS.min_throttle,
  error_threshold: GUIDANCE_PARAMS.error_threshold,
};

export interface TrailPt {
  x: number;
  y: number;
  /** |cross-track error| in metres */
  c: number;
}

export interface LapStats {
  n: number;
  time: number;
  mean: number;
  max: number;
}

export interface Readout {
  t: number;
  lapElapsed: number;
  laps: number;
  lastLap: LapStats | null;
  bestLap: number | null;
  mean: number;
  max: number;
  v: number;
  e: number | null;
  steer: number;
  throttle: number;
  cte: number;
  /** achieved sim seconds per wall second (EMA) */
  achieved: number;
  lostCount: number;
}

export interface LostInfo {
  title: string;
  why: string;
}

export interface DriveEngine {
  simRef: MutableRefObject<CarSim | null>;
  trailRef: MutableRefObject<TrailPt[]>;
  /** car pose when the last camera frame was taken (so the inset lines up with sim.frame) */
  framePoseRef: MutableRefObject<Pose | null>;
  gainsRef: MutableRefObject<Gains>;
  lostRef: MutableRefObject<{ since: number; info: LostInfo } | null>;
  /** redraw callbacks run after every simulation tick */
  bus: MutableRefObject<Set<() => void>>;
}

interface Options {
  gains: Gains;
  hz: 10 | 20;
  tsTrue: boolean;
  speed: number;
  running: boolean;
  /** build the world (expensive) once this turns true */
  load: boolean;
}

const BUDGET_MS = 14;
const LOST_RESET_MS = 1500;
const TRAIL_MAX = 2400;

function fmt(x: number, d = 2) {
  return (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d);
}

/** Explain why sim.lost() fired, from what the nodes last did. */
function explainLoss(sim: CarSim, cte: number): LostInfo {
  const h = sim.history;
  let nulls = 0;
  for (let i = h.length - 1; i >= 0 && h[i].error === null; i--) nulls++;
  const cmd = `angular.z ${fmt(sim.cmd.angular)}, linear.x ${fmt(sim.cmd.linear)}`;
  const off = `${Math.round(Math.abs(cte) * 100)} cm`;
  if (nulls >= 2) {
    return {
      title: "Lost the line: nothing on /centroid",
      why: `The tape left the crop band, so lane_detection_node published nothing for ${nulls} frames and the guidance node kept its last command (${cmd}). The car ended ${off} off the line.`,
    };
  }
  const lastE = [...h].reverse().find((r) => r.error !== null)?.error ?? 0;
  if (Math.abs(lastE) > 0.75) {
    return {
      title: "Lost the line: tape at the edge of the crop",
      why: `The tape slid to the edge of the crop band (e = ${fmt(lastE)}) while the controller asked for only ${cmd}. That was not enough to hold the 8 m curve, and the car ended ${off} off the line.`,
    };
  }
  return {
    title: "Lost the line",
    why: `The node still saw the tape (e = ${fmt(lastE)}, ${cmd}), but the car ended ${off} off the line.`,
  };
}

export function useDriveSim(o: Options) {
  const [world, setWorld] = useState<World | null>(null);
  const [readout, setReadout] = useState<Readout | null>(null);
  const [lost, setLost] = useState<LostInfo | null>(null);

  const simRef = useRef<CarSim | null>(null);
  const trailRef = useRef<TrailPt[]>([]);
  const framePoseRef = useRef<Pose | null>(null);
  const gainsRef = useRef(o.gains);
  const lostRef = useRef<{ since: number; info: LostInfo } | null>(null);
  const bus = useRef(new Set<() => void>());
  const opts = useRef(o);
  opts.current = o;

  // lap bookkeeping (simulated time)
  const lap = useRef({ n: 0, start: 0, sum: 0, dur: 0, max: 0, last: null as LapStats | null, best: null as number | null });
  const lostCount = useRef(0);
  const achieved = useRef(1);
  const lastReadout = useRef(0);

  // --------------------------------------------------------------- build / reset

  const applyGains = useCallback((sim: CarSim) => {
    const g = opts.current.gains;
    Object.assign(sim.planner.p, g);
    sim.cameraHz = opts.current.hz;
    sim.planner.tsOverride = opts.current.tsTrue ? 1 / opts.current.hz : null;
  }, []);

  const reset = useCallback(() => {
    const w = world;
    if (!w) return;
    const sim = new CarSim({
      lane: LANE_PARAMS,
      guidance: { ...GUIDANCE_PARAMS, ...opts.current.gains } as GuidanceParams,
      detector: false,
      cameraHz: opts.current.hz,
      fullFrame: false,
      world: w,
    });
    applyGains(sim);
    sim.onMessage = (m) => {
      if (m.topic === "/object_detections/image") framePoseRef.current = { ...sim.pose };
    };
    simRef.current = sim;
    trailRef.current = [];
    framePoseRef.current = { ...sim.pose };
    lap.current = { n: 0, start: 0, sum: 0, dur: 0, max: 0, last: null, best: lap.current.best };
    lostRef.current = null;
    setLost(null);
    // render one camera frame so the inset has a picture before the first tick
    sim.step(0.001);
    for (const f of bus.current) f();
  }, [world, applyGains]);

  // build the world after mount (the first World bakes a ~370 ms texture)
  useEffect(() => {
    if (!o.load || world) return;
    const id = window.setTimeout(() => setWorld(new World({ garbage: [] })), 30);
    return () => window.clearTimeout(id);
  }, [o.load, world]);

  useEffect(() => {
    if (world && !simRef.current) reset();
  }, [world, reset]);

  // live parameter changes go straight into the running node
  useEffect(() => {
    gainsRef.current = o.gains;
    const sim = simRef.current;
    if (sim) applyGains(sim);
  }, [o.gains, o.hz, o.tsTrue, applyGains]);

  // --------------------------------------------------------------- loop

  const publishReadout = useCallback((force = false) => {
    const now = performance.now();
    if (!force && now - lastReadout.current < 160) return;
    lastReadout.current = now;
    const sim = simRef.current;
    if (!sim) return;
    const L = lap.current;
    const last = sim.history[sim.history.length - 1];
    const tr = sim.world.track(sim.pose.x, sim.pose.y);
    setReadout({
      t: sim.t,
      lapElapsed: sim.t - L.start,
      laps: L.n,
      lastLap: L.last,
      bestLap: L.best,
      mean: L.dur > 0 ? L.sum / L.dur : 0,
      max: L.max,
      v: sim.v,
      e: last ? last.error : null,
      steer: sim.cmd.angular,
      throttle: sim.cmd.linear,
      cte: tr ? tr.d : NaN,
      achieved: achieved.current,
      lostCount: lostCount.current,
    });
  }, []);

  const afterChunk = useCallback((sim: CarSim, h: number) => {
    const tr = sim.world.track(sim.pose.x, sim.pose.y);
    const c = tr ? Math.abs(tr.d) : 0.3;
    const L = lap.current;
    L.sum += c * h;
    L.dur += h;
    L.max = Math.max(L.max, c);
    const trail = trailRef.current;
    const p = trail[trail.length - 1];
    if (!p || Math.hypot(sim.pose.x - p.x, sim.pose.y - p.y) > 0.04) {
      trail.push({ x: sim.pose.x, y: sim.pose.y, c });
      if (trail.length > TRAIL_MAX) trail.splice(0, trail.length - TRAIL_MAX);
    }
    if (sim.progress >= (L.n + 1) * sim.world.length) {
      const stats = { n: L.n + 1, time: sim.t - L.start, mean: L.dur > 0 ? L.sum / L.dur : 0, max: L.max };
      lap.current = { n: L.n + 1, start: sim.t, sum: 0, dur: 0, max: 0, last: stats, best: L.best === null ? stats.time : Math.min(L.best, stats.time) };
    }
  }, []);

  useEffect(() => {
    if (!o.running || !world) return;
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const sim = simRef.current;
      if (sim) {
        const lostState = lostRef.current;
        if (lostState) {
          if (now - lostState.since > LOST_RESET_MS) reset();
        } else {
          const t0 = sim.t;
          let remaining = dt * opts.current.speed;
          while (remaining > 1e-6) {
            const h = Math.min(remaining, 0.05);
            const before = sim.t;
            sim.step(h);
            remaining -= h;
            afterChunk(sim, sim.t - before);
            if (sim.lost()) {
              const tr = sim.world.track(sim.pose.x, sim.pose.y);
              const info = explainLoss(sim, tr ? tr.d : 0.3);
              lostRef.current = { since: now, info };
              lostCount.current++;
              setLost(info);
              break;
            }
            if (performance.now() - now > BUDGET_MS) break; // CPU budget: run slower than asked
          }
          if (dt > 0) achieved.current += ((sim.t - t0) / dt - achieved.current) * 0.08;
        }
        for (const f of bus.current) f();
        publishReadout();
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [o.running, world, reset, afterChunk, publishReadout]);

  // when paused, still refresh readouts once so they match the frozen scene
  useEffect(() => {
    if (!o.running) publishReadout(true);
  }, [o.running, publishReadout]);

  const engineRef = useRef<DriveEngine | null>(null);
  if (!engineRef.current) engineRef.current = { simRef, trailRef, framePoseRef, gainsRef, lostRef, bus };
  const engine = engineRef.current;

  return { world, readout, lost, reset, engine };
}
