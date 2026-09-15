"use client";

import { useEffect, useState } from "react";
import MemoryTimeline from "./MemoryTimeline";
import { parseTrace, type AgentMemoryTrace } from "./core/trace";
import "./agent-memory.css";

export default function Stage() {
  const [trace, setTrace] = useState<AgentMemoryTrace>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    fetch("/demos/agent-memory/trace.json", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`trace.json returned ${response.status}`);
        return parseTrace(await response.json());
      })
      .then(setTrace)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, []);

  return <MemoryTimeline trace={trace} error={error} />;
}
