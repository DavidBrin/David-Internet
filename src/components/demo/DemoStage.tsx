"use client";

/**
 * slug → lazily loaded stage. Each demo's interactive code lives in its own chunk so the
 * search pages never pay for canvas/WebGL/worker code they don't use.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

function Loading() {
  return <div className="demoStageLoading">Loading demo…</div>;
}

const STAGES: Record<string, ComponentType> = {
  verilog: dynamic(() => import("@/demos/verilog/Stage"), { ssr: false, loading: Loading }),
  nocturnal: dynamic(() => import("@/demos/nocturnal/Stage"), { ssr: false, loading: Loading }),
  signals: dynamic(() => import("@/demos/signals/Stage"), { ssr: false, loading: Loading }),
  quantum: dynamic(() => import("@/demos/quantum/Stage"), { ssr: false, loading: Loading }),
  hardhack: dynamic(() => import("@/demos/hardhack/Stage"), { ssr: false, loading: Loading }),
  esp32: dynamic(() => import("@/demos/esp32/Stage"), { ssr: false, loading: Loading }),
  organoids: dynamic(() => import("@/demos/organoids/Stage"), { ssr: false, loading: Loading }),
  spikes: dynamic(() => import("@/demos/spikes/Stage"), { ssr: false, loading: Loading }),
  vision: dynamic(() => import("@/demos/vision/Stage"), { ssr: false, loading: Loading }),
  arxiv: dynamic(() => import("@/demos/arxiv/Stage"), { ssr: false, loading: Loading }),
  crossteach: dynamic(() => import("@/demos/crossteach/Stage"), { ssr: false, loading: Loading }),
  p300: dynamic(() => import("@/demos/p300/Stage"), { ssr: false, loading: Loading }),
  sql: dynamic(() => import("@/demos/sql/Stage"), { ssr: false, loading: Loading }),
  modeling: dynamic(() => import("@/demos/modeling/Stage"), { ssr: false, loading: Loading }),
  earlycode: dynamic(() => import("@/demos/earlycode/Stage"), { ssr: false, loading: Loading }),
};

export default function DemoStage({ slug }: { slug: string }) {
  const Stage = STAGES[slug];
  if (!Stage) return <div className="demoStageLoading">No stage registered for “{slug}”.</div>;
  return <Stage />;
}
