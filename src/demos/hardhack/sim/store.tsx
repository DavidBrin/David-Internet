"use client";

/**
 * One shared simulation for every panel on the page. A fixed-timestep loop
 * (TICK_MS) drives sim/core.ts; panels read via useSimTick() and write through
 * the actions on the handle. A version counter + useSyncExternalStore re-renders
 * subscribers once per tick, not per field.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createSim,
  phoneResetNetwork,
  phoneSetArmed,
  setIteration,
  tick,
  TICK_MS,
  type Iteration,
  type SimState,
} from "./core";

export interface SimHandle {
  /** Mutable sim — read fields inside render via useSimTick(). */
  sim: SimState;
  version: () => number;
  subscribe: (cb: () => void) => () => void;
  /** Bump the version and re-render subscribers (actions call this themselves). */
  notify: () => void;
  paused: boolean;
  actions: {
    setDoorAngle: (deg: number) => void;
    setIntruder: (active: boolean, distCm?: number) => void;
    setArmedFromPhone: (on: boolean) => void;
    resetNetwork: () => void;
    setIteration: (it: Iteration) => void;
    setFaultWifi: (down: boolean) => void;
    injectUartNoise: () => void;
    setConfig: (patch: Partial<Pick<SimState["cfg"], "thresholdCm" | "confirmationCount" | "sensorIntervalMs">>) => void;
    setPaused: (p: boolean) => void;
  };
}

const SimContext = createContext<SimHandle | null>(null);

export function SimProvider({ children }: { children: ReactNode }) {
  const handle = useMemo<SimHandle>(() => {
    const sim = createSim(1);
    let version = 0;
    const subs = new Set<() => void>();
    const h: SimHandle = {
      sim,
      version: () => version,
      subscribe: (cb) => {
        subs.add(cb);
        return () => subs.delete(cb);
      },
      notify: () => {
        version++;
        subs.forEach((cb) => cb());
      },
      paused: false,
      actions: {
        setDoorAngle: (deg) => {
          sim.doorAngleDeg = Math.max(0, Math.min(90, deg));
        },
        setIntruder: (active, distCm) => {
          sim.intruderActive = active;
          if (distCm !== undefined) sim.intruderDistCm = Math.max(0, distCm);
        },
        setArmedFromPhone: (on) => phoneSetArmed(sim, on),
        resetNetwork: () => phoneResetNetwork(sim),
        setIteration: (it) => {
          setIteration(sim, it);
          h.notify();
        },
        setFaultWifi: (down) => {
          sim.faultWifiDown = down;
          h.notify();
        },
        injectUartNoise: () => {
          sim.faultUartNoiseOnce = true;
        },
        setConfig: (patch) => {
          Object.assign(sim.cfg, patch);
          h.notify();
        },
        setPaused: (p) => {
          h.paused = p;
          h.notify();
        },
      },
    };
    return h;
  }, []);

  useEffect(() => {
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    let alive = true;
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(250, now - last);
      last = now;
      if (!handle.paused) {
        acc += dt;
        let ticked = false;
        while (acc >= TICK_MS) {
          tick(handle.sim, TICK_MS);
          acc -= TICK_MS;
          ticked = true;
        }
        if (ticked) handle.notify();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [handle]);

  return <SimContext.Provider value={handle}>{children}</SimContext.Provider>;
}

export function useSimHandle(): SimHandle {
  const h = useContext(SimContext);
  if (!h) throw new Error("useSimHandle must be used inside <SimProvider>");
  return h;
}

/**
 * Subscribe to the sim clock: re-renders the component once per sim tick and
 * returns the live SimState to read from.
 */
export function useSimTick(): SimState {
  const h = useSimHandle();
  useSyncExternalStore(h.subscribe, h.version, h.version);
  return h.sim;
}
