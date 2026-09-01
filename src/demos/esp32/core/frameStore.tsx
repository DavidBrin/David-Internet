"use client";

/**
 * Shared frame stream for the ESP32 demo: loads /demos/esp32/frames.json once,
 * exposes the decoded frames, a playhead ticking at the AMG8833's ~10 fps, and
 * play/pause/scrub controls. The camera, features, and tinyml panels all read
 * the same current frame so the page feels like one live sensor.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { decodeFrames, type FramesJson, type ThermalFrame } from "./colormap";

export const SENSOR_FPS = 10;

export interface FrameStore {
  frames: ThermalFrame[];
  sequences: { sid: string; start: number; end: number }[];
  stats: { total: number; present: number; empty: number } | null;
  index: number;
  playing: boolean;
  frame: ThermalFrame | null;
  setIndex: (i: number) => void;
  setPlaying: (p: boolean) => void;
  /** Loading / error state for panels that must wait. */
  status: "loading" | "ready" | "error";
}

const Ctx = createContext<FrameStore | null>(null);

export function FrameProvider({ children }: { children: ReactNode }) {
  const [frames, setFrames] = useState<ThermalFrame[]>([]);
  const [meta, setMeta] = useState<Pick<FramesJson, "sequences" | "stats"> | null>(null);
  const [status, setStatus] = useState<FrameStore["status"]>("loading");
  const [index, setIndexState] = useState(0);
  const [playing, setPlaying] = useState(true);
  const raf = useRef(0);

  useEffect(() => {
    let alive = true;
    fetch("/demos/esp32/frames.json")
      .then((r) => {
        if (!r.ok) throw new Error(`frames.json ${r.status}`);
        return r.json() as Promise<FramesJson>;
      })
      .then((j) => {
        if (!alive) return;
        setFrames(decodeFrames(j));
        setMeta({ sequences: j.sequences, stats: j.stats });
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    let last = performance.now();
    let acc = 0;
    let alive = true;
    const loop = (now: number) => {
      if (!alive) return;
      acc += now - last;
      last = now;
      const step = 1000 / SENSOR_FPS;
      if (acc >= step) {
        const n = Math.floor(acc / step);
        acc -= n * step;
        setIndexState((i) => (i + n) % frames.length);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf.current);
    };
  }, [playing, frames.length]);

  const setIndex = useCallback(
    (i: number) => setIndexState(Math.max(0, Math.min(frames.length - 1, i))),
    [frames.length],
  );

  const store: FrameStore = {
    frames,
    sequences: meta?.sequences ?? [],
    stats: meta?.stats ?? null,
    index,
    playing,
    frame: frames.length ? frames[index] : null,
    setIndex,
    setPlaying,
    status,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useFrames(): FrameStore {
  const s = useContext(Ctx);
  if (!s) throw new Error("useFrames must be used inside <FrameProvider>");
  return s;
}
