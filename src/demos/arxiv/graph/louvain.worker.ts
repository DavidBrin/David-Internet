/**
 * Web Worker: re-runs Louvain community detection at a given tau off the main
 * thread, so dragging the tau slider stays fluid. Holds the full candidate
 * edge list (indices + distances) after an "init" message, then on each "run"
 * message filters to dist<=tau, builds weighted edges (w = 1 - dist, the
 * pipeline's convention), and runs core/louvain.
 *
 * Typed without the "webworker" lib (project tsconfig only has "dom") to avoid
 * clashing ambient globals — self/postMessage are accessed through a narrow
 * local cast instead of relying on DedicatedWorkerGlobalScope typings.
 */
import { louvain, type WEdge } from "@/demos/arxiv/core/louvain";
import type { WorkerInMsg, WorkerOutMsg } from "./types";

interface WorkerScope {
  onmessage: ((ev: MessageEvent<WorkerInMsg>) => void) | null;
  postMessage: (msg: WorkerOutMsg, transfer: Transferable[]) => void;
}

const ctx = self as unknown as WorkerScope;

let n = 0;
let edgeA: Int32Array = new Int32Array(0);
let edgeB: Int32Array = new Int32Array(0);
let edgeDist: Float64Array = new Float64Array(0);

ctx.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === "init") {
    n = msg.n;
    edgeA = Int32Array.from(msg.edgeA);
    edgeB = Int32Array.from(msg.edgeB);
    edgeDist = Float64Array.from(msg.edgeDist);
    return;
  }
  if (msg.type === "run") {
    const { reqId, tau } = msg;
    const edges: WEdge[] = [];
    for (let i = 0; i < edgeA.length; i++) {
      const d = edgeDist[i];
      if (d <= tau) edges.push({ a: edgeA[i], b: edgeB[i], w: 1 - d });
    }
    const result = louvain(n, edges);
    const labels = result.labels; // Int32Array — transfer its buffer
    ctx.postMessage(
      {
        reqId,
        tau,
        labels: labels.buffer as ArrayBuffer,
        modularity: result.modularity,
        nCommunities: result.nCommunities,
        edgeCount: edges.length,
      },
      [labels.buffer as ArrayBuffer]
    );
  }
};
