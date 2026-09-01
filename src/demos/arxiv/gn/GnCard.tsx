"use client";

/**
 * #girvan-newman — community detection on Zachary's karate club by repeatedly
 * cutting the highest edge-betweenness edge (Brandes, ../core/graphalgos).
 *
 * Node radii come from David's from-scratch nodeBetweenness, computed once on
 * the *original* 78-edge graph. Edge widths come from edgeBetweenness on the
 * *current* edge list, recomputed after every cut. Each step is two-phase: the
 * doomed edge flashes for FLASH_MS, then is actually removed from state so the
 * widths/colors re-animate via CSS transitions.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  nodeBetweenness,
  edgeBetweenness,
  girvanNewmanStep,
  components as computeComponents,
  type Edge,
} from "@/demos/arxiv/core/graphalgos";
import { scalePositions, componentColor, ekey, PALETTE, type SocialJson } from "./gnHelpers";
import "./gn.css";

const WIDTH = 420;
const HEIGHT = 320;
const PAD = 24;
const MAX_STEPS = 12;
const AUTO_MS = 1000;
const FLASH_MS = 550;

export default function GnCard() {
  const [data, setData] = useState<SocialJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [edges, setEdges] = useState<Edge[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const [comps, setComps] = useState<number[][]>([]);
  const [flash, setFlash] = useState<Edge | null>(null);
  const [lastRemoved, setLastRemoved] = useState<{ edge: Edge; betweenness: number } | null>(null);
  const [dendro, setDendro] = useState<number[][]>([]);
  const [stepCount, setStepCount] = useState(0);
  const [auto, setAuto] = useState(false);

  const autoTimer = useRef<number | null>(null);
  const busyRef = useRef(false);
  const stepCountRef = useRef(0);
  const compCountRef = useRef(1);

  useEffect(() => {
    let cancelled = false;
    fetch("/demos/arxiv/social.json")
      .then((r) => {
        if (!r.ok) throw new Error(`social.json: ${r.status}`);
        return r.json();
      })
      .then((json: SocialJson) => {
        if (cancelled) return;
        setData(json);
        edgesRef.current = json.edges;
        setEdges(json.edges);
        const initial = computeComponents(json.n, json.edges);
        setComps(initial);
        compCountRef.current = initial.length;
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // David's node betweenness — computed once, on the original graph.
  const staticBetweenness = useMemo(() => {
    if (!data) return null;
    return nodeBetweenness(data.n, data.edges);
  }, [data]);

  // Brandes edge betweenness on the *current* edge list — drives edge widths.
  const currentEdgeBetweenness = useMemo(() => {
    if (!data) return new Map<string, number>();
    return edgeBetweenness(data.n, edges);
  }, [data, edges]);

  const pts = useMemo(() => {
    if (!data) return [];
    return scalePositions(data.pos, data.n, WIDTH, HEIGHT, PAD);
  }, [data]);

  const doStep = useCallback(() => {
    if (!data || busyRef.current) return;
    if (edgesRef.current.length === 0 || stepCountRef.current >= MAX_STEPS) return;
    const result = girvanNewmanStep(data.n, edgesRef.current);
    if (!result) return;
    busyRef.current = true;
    setFlash(result.removed);
    window.setTimeout(() => {
      const [ra, rb] = result.removed;
      const next = edgesRef.current.filter(([a, b]) => !((a === ra && b === rb) || (a === rb && b === ra)));
      edgesRef.current = next;
      setEdges(next);
      setComps(result.components);
      setLastRemoved({ edge: result.removed, betweenness: result.betweenness });
      stepCountRef.current += 1;
      setStepCount(stepCountRef.current);
      if (result.components.length > compCountRef.current) {
        compCountRef.current = result.components.length;
        setDendro((d) => [...d, result.components.map((c) => c.length)]);
      }
      setFlash(null);
      busyRef.current = false;
    }, FLASH_MS);
  }, [data]);

  useEffect(() => {
    if (!auto) {
      if (autoTimer.current !== null) {
        window.clearInterval(autoTimer.current);
        autoTimer.current = null;
      }
      return;
    }
    autoTimer.current = window.setInterval(() => doStep(), AUTO_MS);
    return () => {
      if (autoTimer.current !== null) {
        window.clearInterval(autoTimer.current);
        autoTimer.current = null;
      }
    };
  }, [auto, doStep]);

  useEffect(() => {
    if (auto && (stepCount >= MAX_STEPS || edges.length === 0)) setAuto(false);
  }, [auto, stepCount, edges.length]);

  useEffect(() => {
    return () => {
      if (autoTimer.current !== null) window.clearInterval(autoTimer.current);
    };
  }, []);

  const reset = () => {
    if (!data) return;
    setAuto(false);
    busyRef.current = false;
    setFlash(null);
    edgesRef.current = data.edges;
    setEdges(data.edges);
    const initial = computeComponents(data.n, data.edges);
    setComps(initial);
    compCountRef.current = initial.length;
    setDendro([]);
    setLastRemoved(null);
    stepCountRef.current = 0;
    setStepCount(0);
  };

  if (error) {
    return <div className="axPanel axN axNNote">Failed to load the karate club graph: {error}</div>;
  }
  if (!data || !staticBetweenness) {
    return <div className="axPanel axN axNNote">Loading the karate club graph&hellip;</div>;
  }

  const maxBc = Math.max(...Array.from(staticBetweenness), 1e-9);
  const ebVals = [...currentEdgeBetweenness.values()];
  const maxEb = ebVals.length ? Math.max(...ebVals) : 1;

  const nodeR = (i: number) => 5 + 13 * Math.sqrt((staticBetweenness[i] ?? 0) / maxBc);
  const edgeW = (a: number, b: number) => {
    const v = currentEdgeBetweenness.get(ekey(a, b)) ?? 0;
    return 1 + 6 * (v / (maxEb || 1));
  };

  const dendroMax = data.n;
  const compsForColor = comps.length ? comps : [Array.from({ length: data.n }, (_, k) => k)];

  return (
    <div className="axPanel axN">
      <div className="axRow axNHead">
        <h3 className="axNH3">Girvan&ndash;Newman on the karate club</h3>
        <span className="axChip">
          mirrors calculate_betweenness_centrality()
          <span className="axNTip"> &middot; one shortest path per pair, node sizes use it</span>
        </span>
        <span className="axChip">edge betweenness: Brandes</span>
      </div>

      <div className="axRow">
        <button type="button" className="axBtn" onClick={doStep} disabled={edges.length === 0 || stepCount >= MAX_STEPS}>
          Step
        </button>
        <button
          type="button"
          className="axBtn"
          data-active={auto}
          onClick={() => setAuto((a) => !a)}
          disabled={edges.length === 0 || stepCount >= MAX_STEPS}
        >
          {auto ? "Pause" : "Auto"}
        </button>
        <button type="button" className="axBtn" onClick={reset}>
          Reset
        </button>
        <span className="axMono axNNote">
          edges remaining {edges.length} &middot; components {comps.length || 1} &middot; step {stepCount}/
          {MAX_STEPS}
        </span>
      </div>

      <div className="axNBody">
        <svg className="axNGraph" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet">
          {edges.map(([a, b]) => {
            const isFlash = !!flash && ((flash[0] === a && flash[1] === b) || (flash[0] === b && flash[1] === a));
            return (
              <line
                key={`${a}-${b}`}
                x1={pts[a].x}
                y1={pts[a].y}
                x2={pts[b].x}
                y2={pts[b].y}
                className={isFlash ? "axNEdge axNEdgeFlash" : "axNEdge"}
                strokeWidth={isFlash ? 4.5 : edgeW(a, b)}
              />
            );
          })}
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={nodeR(i)} className="axNNode" fill={componentColor(i, compsForColor)} />
          ))}
        </svg>

        <div className="axNDendroWrap">
          <div className="axNLabel">dendrogram &middot; component sizes per split</div>
          <div className="axNDendroCols">
            {dendro.length === 0 && <div className="axNNote axNDendroEmpty">step to trigger the first split</div>}
            {dendro.map((sizes, ci) => (
              <div className="axNDendroCol" key={ci}>
                <div className="axNDendroStack">
                  {sizes.map((s, si) => (
                    <div
                      key={si}
                      className="axNDendroSeg"
                      style={{ height: `${(s / dendroMax) * 100}%`, background: PALETTE[si % PALETTE.length] }}
                      title={`${s} nodes`}
                    />
                  ))}
                </div>
                <div className="axNDendroColLabel axMono">{ci + 1}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="axMono axNReadout">
        last removed:{" "}
        {lastRemoved
          ? `${lastRemoved.edge[0]}–${lastRemoved.edge[1]} (betweenness ${lastRemoved.betweenness.toFixed(4)})`
          : "none yet"}
      </div>
    </div>
  );
}
