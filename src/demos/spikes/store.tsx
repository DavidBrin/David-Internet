"use client";

/**
 * Data provider for the spikes demo — fetches the committed assets once and
 * shares them across panels.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { FeaturesJson, FigureEntry, SpikesMetaJson, SweepsJson, WaveformsJson } from "./core/data";

export interface SpikesData {
  sweeps: SweepsJson;
  waveforms: WaveformsJson;
  features: FeaturesJson;
  meta: SpikesMetaJson;
  figures: FigureEntry[];
}

interface Ctx {
  data: SpikesData | null;
  status: "loading" | "ready" | "error";
}

const SpikesCtx = createContext<Ctx>({ data: null, status: "loading" });

const BASE = "/demos/spikes";

export function SpikesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Ctx>({ data: null, status: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sweeps, waveforms, features, meta, figures] = await Promise.all([
          fetch(`${BASE}/sweeps.json`).then((r) => r.json()),
          fetch(`${BASE}/waveforms.json`).then((r) => r.json()),
          fetch(`${BASE}/features.json`).then((r) => r.json()),
          fetch(`${BASE}/meta.json`).then((r) => r.json()),
          fetch(`${BASE}/figures.json`).then((r) => r.json()),
        ]);
        if (alive) setState({ data: { sweeps, waveforms, features, meta, figures }, status: "ready" });
      } catch {
        if (alive) setState({ data: null, status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return <SpikesCtx.Provider value={state}>{children}</SpikesCtx.Provider>;
}

export function useSpikesData(): Ctx {
  return useContext(SpikesCtx);
}
