"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LouvainWorkerResult, WorkerOutMsg } from "./types";

/**
 * Owns the Louvain web worker's lifecycle. `init` sends the full candidate
 * edge list once; `run(tau)` requests a re-run at that tau (fire-and-forget —
 * stale responses, from a tau that's since been superseded, are dropped via a
 * request-id check so a fast slider drag never shows an out-of-order result).
 */
export function useLouvainWorker() {
  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  const [result, setResult] = useState<LouvainWorkerResult | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const worker = new Worker(new URL("./louvain.worker.ts", import.meta.url));
    workerRef.current = worker;
    worker.onmessage = (ev: MessageEvent<WorkerOutMsg>) => {
      const data = ev.data;
      if (data.reqId !== reqIdRef.current) return; // superseded by a later request
      setResult({
        tau: data.tau,
        labels: new Int32Array(data.labels),
        modularity: data.modularity,
        nCommunities: data.nCommunities,
        edgeCount: data.edgeCount,
      });
    };
    setReady(true);
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const init = useCallback((n: number, edgeA: number[], edgeB: number[], edgeDist: number[]) => {
    workerRef.current?.postMessage({ type: "init", n, edgeA, edgeB, edgeDist });
  }, []);

  const run = useCallback((tau: number) => {
    reqIdRef.current += 1;
    workerRef.current?.postMessage({ type: "run", reqId: reqIdRef.current, tau });
  }, []);

  return { ready, init, run, result };
}
