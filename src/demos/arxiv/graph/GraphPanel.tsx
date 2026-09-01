"use client";

/**
 * GraphPanel — the arXiv Semantic Graph demo's headline panel. Renders both
 * #graph ("the graph, and its one knob") and #recommend ("click-to-recommend")
 * since they share one piece of state: the selected node.
 *
 * Data is fetched at runtime from /demos/arxiv/*.json (see ./data.ts / ./types.ts).
 * Louvain re-runs in a Web Worker (./louvain.worker.ts via ./useLouvainWorker)
 * on every tau change so dragging the slider stays fluid. All animation state
 * (node jitter, color lerp, edge fade) lives in refs and is read inside one
 * requestAnimationFrame loop — React state only drives what the user directly
 * controls (tau, mode, selection, hover, search, the sweep).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { edgeStatsAtTau } from "@/demos/arxiv/core/tau";
import { loadArxivGraphData, type ArxivGraphData } from "./data";
import { useLouvainWorker } from "./useLouvainWorker";
import { categoricalColor, clamp01, lerp, rgbToCss, GREY, type Rgb } from "./palette";
import type { ColorMode } from "./types";
import "./graph.css";

const TAU_MIN = 0.2;
const TAU_MAX = 0.36;
const REPORT_TAU = 0.27;
const EDGE_FADE_MS = 200;
const COLOR_FADE_MS = 300;
const SWEEP_PAUSE_MS = 600;
const HOVER_RADIUS_PX = 8;

function hashPhase(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * Math.PI * 2;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface HoverState {
  idx: number;
  x: number;
  y: number;
}

export default function GraphPanel() {
  // -------------------------------------------------------------- data load
  const [data, setData] = useState<ArxivGraphData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadArxivGraphData()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "failed to load graph data");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------------- controls
  const [tau, setTau] = useState(REPORT_TAU);
  const [mode, setMode] = useState<ColorMode>("communities");
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [sweepRunning, setSweepRunning] = useState(false);
  const [sweepDone, setSweepDone] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  // -------------------------------------------------------------- derived (memo)
  const n = data?.graph.nodes.length ?? 0;

  const edgeArrays = useMemo(() => {
    if (!data) return null;
    const m = data.graph.edges.length;
    const a = new Int32Array(m);
    const b = new Int32Array(m);
    const dist = new Float32Array(m);
    const alphaBase = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      const [ea, eb, ed] = data.graph.edges[i];
      a[i] = ea;
      b[i] = eb;
      dist[i] = ed;
      alphaBase[i] = clamp01(1 - ed);
    }
    return { a, b, dist, alphaBase };
  }, [data]);

  const phaseX = useMemo(
    () => (data ? Float32Array.from(data.graph.nodes, (_node, i) => hashPhase(i)) : new Float32Array(0)),
    [data]
  );
  const phaseY = useMemo(
    () => (data ? Float32Array.from(data.graph.nodes, (_node, i) => hashPhase(i + 91013)) : new Float32Array(0)),
    [data]
  );

  const categoryColorTarget = useMemo(() => {
    const arr = new Float32Array(n * 3);
    if (!data) return arr;
    const cache = new Map<number, Rgb>();
    for (let i = 0; i < n; i++) {
      const g = data.graph.nodes[i].g;
      let rgb = cache.get(g);
      if (!rgb) {
        rgb = categoricalColor(g);
        cache.set(g, rgb);
      }
      arr[i * 3] = rgb[0];
      arr[i * 3 + 1] = rgb[1];
      arr[i * 3 + 2] = rgb[2];
    }
    return arr;
  }, [data, n]);

  const stats = useMemo(() => {
    if (!data) return null;
    return edgeStatsAtTau(n, data.graph.edges, tau);
  }, [data, n, tau]);

  const searchResults = useMemo(() => {
    if (!data || searchQuery.trim().length === 0) return [];
    const q = searchQuery.toLowerCase();
    const out: number[] = [];
    for (let i = 0; i < data.graph.nodes.length && out.length < 8; i++) {
      if (data.graph.nodes[i].t.toLowerCase().includes(q)) out.push(i);
    }
    return out;
  }, [data, searchQuery]);

  // -------------------------------------------------------------- Louvain worker
  const { ready: workerReady, init: workerInit, run: workerRun, result: louvainResult } = useLouvainWorker();
  const [workerInited, setWorkerInited] = useState(false);

  useEffect(() => {
    if (!data || !workerReady || !edgeArrays || workerInited) return;
    workerInit(n, Array.from(edgeArrays.a), Array.from(edgeArrays.b), Array.from(edgeArrays.dist));
    setWorkerInited(true);
  }, [data, workerReady, edgeArrays, workerInit, workerInited, n]);

  useEffect(() => {
    if (!workerInited) return;
    const id = setTimeout(() => workerRun(tau), 30);
    return () => clearTimeout(id);
  }, [tau, workerInited, workerRun]);

  const communityColorTarget = useMemo(() => {
    const arr = new Float32Array(n * 3);
    if (!louvainResult || louvainResult.labels.length !== n) {
      for (let i = 0; i < n; i++) {
        arr[i * 3] = GREY[0];
        arr[i * 3 + 1] = GREY[1];
        arr[i * 3 + 2] = GREY[2];
      }
      return arr;
    }
    const labels = louvainResult.labels;
    const sizes = new Map<number, number>();
    for (let i = 0; i < n; i++) sizes.set(labels[i], (sizes.get(labels[i]) ?? 0) + 1);
    const top = Array.from(sizes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id]) => id);
    const colorIndex = new Map<number, number>();
    top.forEach((id, idx) => colorIndex.set(id, idx));
    for (let i = 0; i < n; i++) {
      const ci = colorIndex.get(labels[i]);
      const rgb = ci === undefined ? GREY : categoricalColor(ci, 40, 0.68, 0.5);
      arr[i * 3] = rgb[0];
      arr[i * 3 + 1] = rgb[1];
      arr[i * 3 + 2] = rgb[2];
    }
    return arr;
  }, [louvainResult, n]);

  // -------------------------------------------------------------- refs (animation state)
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const baseXRef = useRef(new Float32Array(0));
  const baseYRef = useRef(new Float32Array(0));

  const colorFromRef = useRef(new Float32Array(0));
  const colorTargetRef = useRef(new Float32Array(0));
  const colorBatchStartRef = useRef(0);

  const edgeFromRef = useRef(new Float32Array(0));
  const edgeTargetRef = useRef(new Float32Array(0));
  const edgeBatchStartRef = useRef(0);

  const selectedRef = useRef<number | null>(null);
  const hoverRef = useRef<HoverState | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    hoverRef.current = hover;
  }, [hover]);

  // reset animation buffers whenever the dataset (size) changes
  useEffect(() => {
    if (!data || !edgeArrays) return;
    const m = edgeArrays.a.length;
    colorFromRef.current = new Float32Array(n * 3);
    colorTargetRef.current = new Float32Array(n * 3);
    colorBatchStartRef.current = performance.now() - COLOR_FADE_MS * 2;
    edgeFromRef.current = new Float32Array(m);
    edgeTargetRef.current = new Float32Array(m);
    edgeBatchStartRef.current = performance.now() - EDGE_FADE_MS * 2;
  }, [data, edgeArrays, n]);

  // edge alpha targets: recompute (and snapshot a "from" baseline) on tau change
  useEffect(() => {
    if (!edgeArrays) return;
    const m = edgeArrays.a.length;
    if (edgeTargetRef.current.length !== m) return;
    const now = performance.now();
    const t = clamp01((now - edgeBatchStartRef.current) / EDGE_FADE_MS);
    const newFrom = new Float32Array(m);
    const newTarget = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      newFrom[i] = lerp(edgeFromRef.current[i], edgeTargetRef.current[i], t);
      newTarget[i] = edgeArrays.dist[i] <= tau ? edgeArrays.alphaBase[i] : 0;
    }
    edgeFromRef.current = newFrom;
    edgeTargetRef.current = newTarget;
    edgeBatchStartRef.current = now;
  }, [tau, edgeArrays]);

  // node color targets: recompute (and snapshot) on mode switch or new Louvain result
  const colorTarget = mode === "categories" ? categoryColorTarget : communityColorTarget;
  useEffect(() => {
    if (colorTargetRef.current.length !== n * 3) return;
    const now = performance.now();
    const t = clamp01((now - colorBatchStartRef.current) / COLOR_FADE_MS);
    const newFrom = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) newFrom[i] = lerp(colorFromRef.current[i], colorTargetRef.current[i], t);
    colorFromRef.current = newFrom;
    colorTargetRef.current = colorTarget;
    colorBatchStartRef.current = now;
  }, [colorTarget, n]);

  // -------------------------------------------------------------- canvas sizing
  useEffect(() => {
    if (!data) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    canvas.style.display = "block";
    const nodes = data.graph.nodes;
    const margin = 22;
    let lastW = 0;
    let lastH = 0;

    const apply = (width: number, height: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width, height, dpr };
      const innerW = Math.max(width - margin * 2, 1);
      const innerH = Math.max(height - margin * 2, 1);
      const bx = new Float32Array(nodes.length);
      const by = new Float32Array(nodes.length);
      for (let i = 0; i < nodes.length; i++) {
        bx[i] = margin + nodes[i].x * innerW;
        by[i] = margin + nodes[i].z * innerH;
      }
      baseXRef.current = bx;
      baseYRef.current = by;
    };

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (Math.abs(width - lastW) < 2 && Math.abs(height - lastH) < 2) continue;
        lastW = width;
        lastH = height;
        apply(width, height);
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [data]);

  // -------------------------------------------------------------- draw loop
  useEffect(() => {
    if (!data || !edgeArrays) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const m = edgeArrays.a.length;
    let raf = 0;

    const draw = (now: number) => {
      const { width, height } = sizeRef.current;
      ctx.clearRect(0, 0, width, height);
      const bx = baseXRef.current;
      const by = baseYRef.current;

      if (bx.length === n && width > 0) {
        // --- threshold edges, alpha-bucketed for one stroke() per bucket ---
        const eFrom = edgeFromRef.current;
        const eTarget = edgeTargetRef.current;
        if (eFrom.length === m) {
          const eT = clamp01((now - edgeBatchStartRef.current) / EDGE_FADE_MS);
          const buckets = new Map<number, number[]>();
          for (let i = 0; i < m; i++) {
            const a = lerp(eFrom[i], eTarget[i], eT);
            if (a < 0.02) continue;
            const key = Math.round(a * 10);
            let arr = buckets.get(key);
            if (!arr) {
              arr = [];
              buckets.set(key, arr);
            }
            arr.push(i);
          }
          for (const [key, idxs] of buckets) {
            ctx.beginPath();
            for (const i of idxs) {
              const ea = edgeArrays.a[i];
              const eb = edgeArrays.b[i];
              ctx.moveTo(bx[ea], by[ea]);
              ctx.lineTo(bx[eb], by[eb]);
            }
            ctx.strokeStyle = `rgba(139,92,246,${(key / 10) * 0.5})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }

        // --- highlighted k-NN edges for the current selection ---
        const sel = selectedRef.current;
        const neighborSet = new Set<number>();
        if (sel !== null && data.neighbors.list[sel]) {
          ctx.strokeStyle = "rgba(109,40,217,0.85)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (const [nb] of data.neighbors.list[sel]) {
            neighborSet.add(nb);
            ctx.moveTo(bx[sel], by[sel]);
            ctx.lineTo(bx[nb], by[nb]);
          }
          ctx.stroke();
        }

        // --- nodes ---
        const cFrom = colorFromRef.current;
        const cTarget = colorTargetRef.current;
        const cT = clamp01((now - colorBatchStartRef.current) / COLOR_FADE_MS);
        const hoverIdx = hoverRef.current?.idx ?? -1;
        const colorsReady = cFrom.length === n * 3;
        for (let i = 0; i < n; i++) {
          const jx = Math.sin(now / 620 + phaseX[i]) * 0.5;
          const jy = Math.cos(now / 560 + phaseY[i]) * 0.5;
          const x = bx[i] + jx;
          const y = by[i] + jy;
          let radius = 2.5;
          let special = false;
          if (i === sel) {
            radius = 4.5;
            special = true;
          } else if (neighborSet.has(i)) {
            radius = 3.6;
            special = true;
          }
          if (i === hoverIdx) radius += 1.2;

          if (colorsReady) {
            const r = lerp(cFrom[i * 3], cTarget[i * 3], cT);
            const g = lerp(cFrom[i * 3 + 1], cTarget[i * 3 + 1], cT);
            const bch = lerp(cFrom[i * 3 + 2], cTarget[i * 3 + 2], cT);
            ctx.fillStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bch * 255)},0.92)`;
          } else {
            ctx.fillStyle = "rgba(140,130,160,0.8)";
          }
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();

          if (special) {
            const ringR = radius + 3 + Math.sin(now / 220 + i) * 1.2;
            ctx.beginPath();
            ctx.strokeStyle = "rgba(139,92,246,0.55)";
            ctx.lineWidth = 1.2;
            ctx.arc(x, y, Math.max(ringR, radius + 2), 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [data, edgeArrays, phaseX, phaseY, n]);

  // -------------------------------------------------------------- pointer handlers
  const findNearest = useCallback(
    (mx: number, my: number): number | null => {
      const bx = baseXRef.current;
      const by = baseYRef.current;
      let best = -1;
      let bestD2 = HOVER_RADIUS_PX * HOVER_RADIUS_PX;
      for (let i = 0; i < bx.length; i++) {
        const dx = bx[i] - mx;
        const dy = by[i] - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = i;
        }
      }
      return best >= 0 ? best : null;
    },
    []
  );

  const hoverScheduled = useRef(false);
  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (hoverScheduled.current) return;
      hoverScheduled.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      requestAnimationFrame(() => {
        hoverScheduled.current = false;
        const idx = findNearest(mx, my);
        setHover(idx === null ? null : { idx, x: mx, y: my });
      });
    },
    [findNearest]
  );
  const handleMouseLeave = useCallback(() => setHover(null), []);
  const handleClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const idx = findNearest(mx, my);
      if (idx !== null) setSelected(idx);
    },
    [findNearest]
  );

  // -------------------------------------------------------------- sweep ("best tau by modularity")
  const runSweep = useCallback(async () => {
    if (!data || sweepRunning) return;
    setSweepRunning(true);
    setSweepDone(false);
    for (const cand of data.hist.tauCandidates) {
      if (!mountedRef.current) return;
      setTau(cand.tau);
      await sleep(SWEEP_PAUSE_MS);
    }
    if (!mountedRef.current) return;
    let best = data.hist.tauTable[0];
    for (const row of data.hist.tauTable) if (row.modularity > best.modularity) best = row;
    setTau(best.tau);
    setSweepRunning(false);
    setSweepDone(true);
  }, [data, sweepRunning]);

  // -------------------------------------------------------------- render
  if (loadError) {
    return (
      <>
        <section id="graph" className="axSection">
          <h2 className="axH2">The graph, and its one knob</h2>
          <div className="axPanel axNote">Could not load the graph data: {loadError}</div>
        </section>
        <section id="recommend" className="axSection">
          <h2 className="axH2">Click-to-recommend</h2>
          <div className="axPanel axStub">Unavailable.</div>
        </section>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <section id="graph" className="axSection">
          <h2 className="axH2">The graph, and its one knob</h2>
          <div className="axPanel axStub">Loading 2,500 papers...</div>
        </section>
        <section id="recommend" className="axSection">
          <h2 className="axH2">Click-to-recommend</h2>
          <div className="axPanel axStub">Loading...</div>
        </section>
      </>
    );
  }

  const hoverNode = hover ? data.graph.nodes[hover.idx] : null;
  const hoverWords = (() => {
    if (!hover) return null;
    const label027 = data.communities.labels["0.27"]?.[hover.idx];
    if (label027 === undefined) return null;
    return data.communities.words27[String(label027)] ?? null;
  })();
  const tooltipStyle = (() => {
    if (!hover) return undefined;
    const { width, height } = sizeRef.current;
    const boxW = 230;
    const boxH = hoverWords ? 110 : 84;
    let left = hover.x + 14;
    let top = hover.y + 14;
    if (width > 0 && left + boxW > width) left = Math.max(4, hover.x - boxW - 14);
    if (height > 0 && top + boxH > height) top = Math.max(4, hover.y - boxH - 14);
    return { left, top };
  })();

  const fullBest = data.hist.fullRun.louvain.reduce((a, b) => (b.modularity > a.modularity ? b : a));
  const bestSubsample = (() => {
    let best = data.hist.tauTable[0];
    for (const row of data.hist.tauTable) if (row.modularity > best.modularity) best = row;
    return best;
  })();

  const selectedNode = selected !== null ? data.graph.nodes[selected] : null;
  const neighborRows = selected !== null ? data.neighbors.list[selected] ?? [] : [];

  return (
    <>
      {/* ============================================================ #graph */}
      <section id="graph" className="axSection">
        <h2 className="axH2">The graph, and its one knob</h2>
        <div className="axPanel">
          <div className="axRow axGModeRow">
            <span className="axSliderLabel">color by</span>
            <button
              className="axBtn"
              data-active={mode === "communities"}
              onClick={() => setMode("communities")}
              type="button"
            >
              communities (live Louvain)
            </button>
            <button className="axBtn" data-active={mode === "categories"} onClick={() => setMode("categories")} type="button">
              categories
            </button>
          </div>

          <div className="axGCanvasWrap" ref={containerRef}>
            <canvas
              ref={canvasRef}
              className="axGCanvas"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
            />
            {hover && hoverNode && (
              <div className="axGTooltip" style={tooltipStyle}>
                <div className="axGTooltipTitle">{hoverNode.t}</div>
                <div className="axGTooltipMeta axMono">
                  {hoverNode.y} · {hoverNode.c}
                </div>
                {hoverWords && (
                  <div className="axGTooltipWords">
                    topic: {hoverWords.join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="axGStatsRow">
            <div className="axGStat">
              <div className="axGStatNum axMono">{stats?.edges ?? "..."}</div>
              <div className="axGStatLabel">edges</div>
            </div>
            <div className="axGStat">
              <div className="axGStatNum axMono">{stats ? stats.avgDegree.toFixed(2) : "..."}</div>
              <div className="axGStatLabel">avg degree</div>
            </div>
            <div className="axGStat">
              <div className="axGStatNum axMono">{stats?.isolated ?? "..."}</div>
              <div className="axGStatLabel">isolated</div>
            </div>
            <div className="axGStat axGStatBig">
              <div className="axGStatNum axMono">{louvainResult ? louvainResult.modularity.toFixed(3) : "..."}</div>
              <div className="axGStatLabel">Q (modularity)</div>
            </div>
            <div className="axGStat axGStatBig">
              <div className="axGStatNum axMono">{louvainResult ? louvainResult.nCommunities : "..."}</div>
              <div className="axGStatLabel">communities</div>
            </div>
          </div>

          <div className="axGHistBlock">
            <TauHistogram bins={data.hist.bins} counts={data.hist.counts} tau={tau} candidates={data.hist.tauCandidates} />
            <span className="axChip">mirrors choose_tau_from_percentile()</span>
          </div>

          <div className="axGSliderBlock">
            <div className="axRow">
              <span className="axSliderLabel">
                tau <span className="axMono">{tau.toFixed(3)}</span>
              </span>
              <input
                type="range"
                min={TAU_MIN}
                max={TAU_MAX}
                step={0.001}
                value={tau}
                disabled={sweepRunning}
                onChange={(e) => setTau(parseFloat(e.target.value))}
                className="axGSlider"
                aria-label="tau threshold"
              />
              <button className="axBtn axBtnPrimary" type="button" onClick={runSweep} disabled={sweepRunning}>
                {sweepRunning ? "sweeping..." : "best tau by modularity"}
              </button>
            </div>
            <div className="axGTicks">
              {data.hist.tauCandidates.map((c) => {
                const isReport = Math.abs(c.tau - REPORT_TAU) < 1e-6;
                const left = ((c.tau - TAU_MIN) / (TAU_MAX - TAU_MIN)) * 100;
                return (
                  <div key={c.tau} className={`axGTick${isReport ? " axGTickReport" : ""}`} style={{ left: `${left}%` }}>
                    <span className="axGTickMark" />
                    <span className="axGTickLabel">{c.tau.toFixed(2)}</span>
                    {isReport && <span className="axGTickReportLabel">report&apos;s choice</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {sweepDone && (
            <div className="axGSweepResult">
              <p className="axGSweepCaption">
                On this subsample, as in the full run, the modularity argmax (tau={bestSubsample.tau.toFixed(2)}, Q=
                {bestSubsample.modularity.toFixed(3)}) is the <strong>sparsest</strong> graph — just {bestSubsample.edges}{" "}
                edges, {bestSubsample.communities} communities out of {data.hist.sample.n} papers. The report chose tau=
                {REPORT_TAU.toFixed(2)} for usable communities instead. In the full 148,477-paper run the same pattern holds
                harder: Q={fullBest.modularity.toFixed(3)} at tau={fullBest.tau.toFixed(2)}, with{" "}
                {fullBest.communities.toLocaleString()} communities of {data.hist.fullRun.papers.toLocaleString()} papers.
              </p>
              <div className="axGTableWrap">
                <table className="axGTable">
                  <caption>subsample (live, {data.hist.sample.n} papers)</caption>
                  <thead>
                    <tr>
                      <th>tau</th>
                      <th>Q</th>
                      <th>communities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hist.tauTable.map((row) => (
                      <tr key={row.tau} data-current={Math.abs(row.tau - tau) < 1e-6}>
                        <td className="axMono">{row.tau.toFixed(2)}</td>
                        <td className="axMono">{row.modularity.toFixed(3)}</td>
                        <td className="axMono">{row.communities}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="axGTable">
                  <caption>full run ({data.hist.fullRun.papers.toLocaleString()} papers, archived)</caption>
                  <thead>
                    <tr>
                      <th>tau</th>
                      <th>Q</th>
                      <th>communities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hist.fullRun.louvain.map((row) => (
                      <tr key={row.tau}>
                        <td className="axMono">{row.tau.toFixed(2)}</td>
                        <td className="axMono">{row.modularity.toFixed(3)}</td>
                        <td className="axMono">{row.communities.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <span className="axChip">mirrors Section 7 of project_demo.ipynb</span>
            </div>
          )}

          <details className="axGPipeline">
            <summary>the pipeline</summary>
            <img src="/demos/arxiv/diagram.webp" alt="Group 36's arXiv semantic graph pipeline diagram" className="axGPipelineImg" />
            <p className="axGCaption">Abstracts → USE v4 embeddings → k-NN (HNSW at full scale) → threshold at tau → Louvain → recommend.</p>
          </details>

          <div className="axNote">
            Live numbers are the 2,500-paper stratified subsample (same snapshot, same filters, same USE v4 embeddings,
            exact k-NN in place of hnswlib, t-SNE layout added at build). The full 148,477-paper numbers shown for
            comparison are the archived run&apos;s.
          </div>
        </div>
      </section>

      {/* ============================================================ #recommend */}
      <section id="recommend" className="axSection">
        <h2 className="axH2">Click-to-recommend</h2>
        <div className="axPanel">
          <div className="axRow">
            <button
              className="axBtn"
              type="button"
              onClick={() => setSelected(Math.floor(Math.random() * n))}
            >
              random paper
            </button>
            <div className="axGSearchWrap">
              <input
                className="axGSearchInput"
                type="text"
                placeholder="search titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="axGSearchDropdown">
                  {searchResults.map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="axGSearchItem"
                      onClick={() => {
                        setSelected(idx);
                        setSearchQuery("");
                      }}
                    >
                      <span className="axGSearchItemTitle">{data.graph.nodes[idx].t}</span>
                      <span className="axGSearchItemMeta axMono">{data.graph.nodes[idx].y}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="axChip">mirrors recommend_for_id()</span>
          </div>

          {!selectedNode && (
            <div className="axStub">Click a node above, or search / pick a random paper, to see its recommendations.</div>
          )}

          {selectedNode && (
            <div className="axGRecommendGrid">
              <div className="axGQueryCard">
                <div className="axGQueryLabel">query</div>
                <a
                  className="axGQueryTitle"
                  href={`https://arxiv.org/abs/${selectedNode.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selectedNode.t}
                </a>
                <div className="axGQueryMeta axMono">
                  {selectedNode.y} · {selectedNode.c}
                </div>
              </div>
              <div className="axGNeighborList">
                {neighborRows.map(([idx, dist]) => {
                  const node = data.graph.nodes[idx];
                  const significant =
                    louvainResult && selected !== null && louvainResult.labels[selected] === louvainResult.labels[idx];
                  const barPct = clamp01(dist / 0.4) * 100;
                  return (
                    <a
                      key={idx}
                      className="axGNeighborRow"
                      href={`https://arxiv.org/abs/${node.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="axGNeighborTitle">{node.t}</div>
                      <div className="axGNeighborMeta axMono">
                        {node.y} · dist {dist.toFixed(3)}
                      </div>
                      <div className="axGDistBar">
                        <div className="axGDistBarFill" style={{ width: `${barPct}%` }} />
                      </div>
                      <span className={`axGTag ${significant ? "axGTagSig" : "axGTagNonsig"}`}>
                        {significant ? "significant" : "non-significant"}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// ==================================================================== TauHistogram

interface TauHistogramProps {
  bins: number[];
  counts: number[];
  tau: number;
  candidates: { pkeep: number; tau: number }[];
}

const HIST_LO = 0.15;
const HIST_HI = 0.45;
const VB_W = 300;
const VB_H = 64;

function TauHistogram({ bins, counts, tau, candidates }: TauHistogramProps) {
  const startIdx = bins.findIndex((b) => b >= HIST_LO - 1e-9);
  const endIdx = bins.findIndex((b) => b >= HIST_HI - 1e-9);
  const lo = startIdx >= 0 ? startIdx : 0;
  const hi = endIdx >= 0 ? endIdx : counts.length;
  const slice = counts.slice(lo, hi);
  const maxCount = Math.max(...slice, 1);
  const nBins = slice.length || 1;
  const barW = VB_W / nBins;
  const xOf = (v: number) => ((v - HIST_LO) / (HIST_HI - HIST_LO)) * VB_W;

  return (
    <svg className="axGHistSvg" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" role="img" aria-label="k-NN distance histogram">
      {slice.map((c, i) => {
        const binRight = bins[lo + i + 1] ?? HIST_HI;
        const kept = binRight <= tau + 1e-9;
        const h = (c / maxCount) * (VB_H - 4);
        return (
          <rect
            key={i}
            x={i * barW}
            y={VB_H - h}
            width={Math.max(barW - 1, 0.5)}
            height={h}
            fill={kept ? "rgba(139,92,246,0.65)" : "rgba(139,92,246,0.18)"}
          />
        );
      })}
      <line x1={xOf(tau)} x2={xOf(tau)} y1={0} y2={VB_H} stroke="#6d28d9" strokeWidth={1.4} />
      {candidates.map((c) => (
        <line
          key={c.pkeep}
          x1={xOf(c.tau)}
          x2={xOf(c.tau)}
          y1={VB_H - 6}
          y2={VB_H}
          stroke="#453a5e"
          strokeWidth={1.2}
        />
      ))}
    </svg>
  );
}
