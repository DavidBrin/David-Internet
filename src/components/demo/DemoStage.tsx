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
};

export default function DemoStage({ slug }: { slug: string }) {
  const Stage = STAGES[slug];
  if (!Stage) return <div className="demoStageLoading">No stage registered for “{slug}”.</div>;
  return <Stage />;
}
