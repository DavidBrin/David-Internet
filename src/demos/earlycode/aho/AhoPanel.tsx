"use client";

/**
 * #aho -- Aho-Corasick, from scratch. Prefix eA.
 *
 * The CSE 100 notebook is three cells: install pyahocorasick, feed it eleven
 * Fast & Furious titles, print that the automaton has 106 nodes. This panel
 * is this page's own implementation of what those cells hide, built on top
 * of ../core/aho.ts (buildTrie / computeFailures / stepMatch -- fixture
 * tested against a Python reference; this file never reimplements that
 * logic, only visualizes it).
 *
 * Three moving pieces, one continuous requestAnimationFrame loop drives the
 * canvas:
 *   1. an editable pattern list (left rail) that rebuilds the automaton
 *   2. the automaton itself, drawn as a left-to-right trie with a one-shot
 *      build animation (trie growth, then BFS failure-link attachment)
 *   3. a step-through matcher that walks a text string against the built
 *      automaton, showing state transitions, failure jumps, and emits
 *
 * All animation state lives in refs; React state only drives what the user
 * directly controls or reads (rail edits, hover tooltip, matcher results).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  buildAutomaton,
  stepMatch,
  nodeCount as automatonNodeCount,
  NOTEBOOK_PATTERNS,
  type Automaton,
  type Emit,
} from "../core/aho";
import { computeTreeRows, attributePatterns, prefixOf, pathToRoot } from "./layout";
import "./aho.css";

// ======================================================================= constants

const DEPTH_SPACING = 22; // world px per trie depth level
const ROW_SPACING = 30; // world px per layout row
const WORLD_PAD = 22;
const NODE_R = 3;
const NODE_R_TERM = 4.6;
const MIN_SCALE = 0.35;
const MAX_SCALE = 6;
const HOVER_RADIUS = 9;

const PHASE1_MS = 3000; // trie grows
const PAUSE_MS = 300;
const PHASE2_MS = 2200; // failure links attach in BFS order
const TOTAL_BUILD_MS = PHASE1_MS + PAUSE_MS + PHASE2_MS;
const PHASE2_TRAIL = 4; // how many recent bfs steps stay visible as a fading trail

const FAIL_FLASH_MS = 480; // matcher red flash fade

// ======================================================================= types

interface AhoDefaults {
  patterns: string[];
  nodeCount: number;
  notebookNodeCount: number;
  demoText: string;
}

interface PatternRow {
  id: number;
  value: string;
}

interface Transform {
  scale: number;
  ox: number;
  oy: number;
}

type BuildPhase = "pending" | "phase1" | "pause" | "phase2" | "done";

interface BuildProgress {
  phase: BuildPhase;
  visibleCount: number;
  currentNodeId: number | null;
  bfsIndex: number;
  flashNodeId: number | null;
}

interface HoverState {
  id: number;
  x: number;
  y: number;
}

interface MatcherEmit extends Emit {
  start: number;
  key: number;
}

interface MatcherState {
  position: number;
  state: number;
  emits: MatcherEmit[];
}

interface FailFlash {
  chain: number[];
  start: number;
}

// ======================================================================= pure helpers

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function computeBuildProgress(automaton: Automaton, startTime: number | null, now: number): BuildProgress {
  const totalNonRoot = automaton.nodes.length - 1;
  if (startTime === null) {
    return { phase: "pending", visibleCount: 0, currentNodeId: null, bfsIndex: -1, flashNodeId: null };
  }
  const elapsed = now - startTime;
  if (totalNonRoot <= 0) {
    return { phase: "done", visibleCount: 0, currentNodeId: null, bfsIndex: -1, flashNodeId: null };
  }
  if (elapsed < PHASE1_MS) {
    const frac = elapsed / PHASE1_MS;
    const visibleCount = Math.min(totalNonRoot, Math.floor(frac * totalNonRoot));
    const currentNodeId = visibleCount >= 1 ? visibleCount : null;
    return { phase: "phase1", visibleCount, currentNodeId, bfsIndex: -1, flashNodeId: null };
  }
  if (elapsed < PHASE1_MS + PAUSE_MS) {
    return { phase: "pause", visibleCount: totalNonRoot, currentNodeId: null, bfsIndex: -1, flashNodeId: null };
  }
  const bfsLen = automaton.bfsOrder.length;
  const bfsElapsed = elapsed - PHASE1_MS - PAUSE_MS;
  if (bfsElapsed < PHASE2_MS && bfsLen > 0) {
    const frac = bfsElapsed / PHASE2_MS;
    const bfsIndex = Math.min(bfsLen - 1, Math.floor(frac * bfsLen));
    return { phase: "phase2", visibleCount: totalNonRoot, currentNodeId: null, bfsIndex, flashNodeId: automaton.bfsOrder[bfsIndex] };
  }
  return { phase: "done", visibleCount: totalNonRoot, currentNodeId: null, bfsIndex: bfsLen - 1, flashNodeId: null };
}

interface PackedRange {
  emit: MatcherEmit;
  start: number;
  row: number;
}

/** Greedy interval packing (emission order) so nested/overlapping matches land on separate rows. */
function packEmitRows(emits: MatcherEmit[]): PackedRange[] {
  const rowEnds: number[] = [];
  const ranges: PackedRange[] = [];
  for (const emit of emits) {
    let row = 0;
    while (row < rowEnds.length && rowEnds[row] >= emit.start) row++;
    if (row === rowEnds.length) rowEnds.push(emit.end);
    else rowEnds[row] = emit.end;
    ranges.push({ emit, start: emit.start, row });
  }
  return ranges;
}

function patternsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// ======================================================================= component

export default function AhoPanel() {
  const reducedMotion = usePrefersReducedMotion();

  // ---------------------------------------------------------------- data load
  const [defaults, setDefaults] = useState<AhoDefaults | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/demos/earlycode/aho/defaults.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<AhoDefaults>;
      })
      .then((d) => {
        if (!cancelled) setDefaults(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "failed to load defaults");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------- pattern rail
  const [rows, setRows] = useState<PatternRow[]>([]);
  const [livePatterns, setLivePatterns] = useState<string[]>([]);
  const idCounterRef = useRef(0);

  useEffect(() => {
    if (!defaults) return;
    idCounterRef.current = defaults.patterns.length;
    setRows(defaults.patterns.map((p, i) => ({ id: i, value: p })));
    setLivePatterns([...defaults.patterns]);
  }, [defaults]);

  const editRow = useCallback((id: number, value: string) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, value } : row)));
  }, []);
  const removeRow = useCallback((id: number) => {
    setRows((r) => (r.length <= 1 ? r : r.filter((row) => row.id !== id)));
  }, []);
  const addRow = useCallback(() => {
    setRows((r) => [...r, { id: idCounterRef.current++, value: "" }]);
  }, []);
  const handleRebuild = useCallback(() => {
    setRows((r) => {
      const cleaned = r.map((row) => ({ ...row, value: row.value.trim() })).filter((row) => row.value.length > 0);
      if (cleaned.length === 0) return r;
      setLivePatterns(cleaned.map((row) => row.value));
      return cleaned;
    });
  }, []);
  const handleReset = useCallback(() => {
    if (!defaults) return;
    const base = idCounterRef.current;
    idCounterRef.current += defaults.patterns.length;
    setRows(defaults.patterns.map((p, i) => ({ id: base + i, value: p })));
    setLivePatterns([...defaults.patterns]);
  }, [defaults]);

  const hasValidPattern = rows.some((r) => r.value.trim().length > 0);

  // ---------------------------------------------------------------- automaton (derived)
  const automaton = useMemo(() => buildAutomaton(livePatterns), [livePatterns]);
  const rowLayout = useMemo(() => computeTreeRows(automaton.nodes), [automaton]);
  const attribution = useMemo(() => attributePatterns(automaton), [automaton]);
  const nodeCountVal = automatonNodeCount(automaton);
  const isNotebookConfig = useMemo(() => patternsEqual(livePatterns, NOTEBOOK_PATTERNS), [livePatterns]);

  // ---------------------------------------------------------------- canvas + transform
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const transformRef = useRef<Transform>({ scale: 1, ox: 10, oy: 10 });
  const screenPosRef = useRef<{ x: Float32Array; y: Float32Array }>({ x: new Float32Array(0), y: new Float32Array(0) });
  const visibleMaxIdRef = useRef(0);

  const fitToContainer = useCallback(() => {
    const { w, h } = sizeRef.current;
    if (w <= 1 || h <= 1) return;
    const maxDepth = automaton.nodes.reduce((m, node) => Math.max(m, node.depth), 0);
    const maxRow = rowLayout.reduce((m, r) => Math.max(m, r), 0);
    const worldW = maxDepth * DEPTH_SPACING + WORLD_PAD * 2;
    const worldH = maxRow * ROW_SPACING + WORLD_PAD * 2;
    const scale = Math.min(w / Math.max(worldW, 1), h / Math.max(worldH, 1), MAX_SCALE);
    const clamped = Math.max(scale, MIN_SCALE);
    transformRef.current = { scale: clamped, ox: 12, oy: Math.max(6, (h - worldH * clamped) / 2) };
  }, [automaton, rowLayout]);

  // DPR-aware sizing, skip sub-2px resizes, display:block set imperatively
  useEffect(() => {
    if (!defaults) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    canvas.style.display = "block";
    let lastW = 0;
    let lastH = 0;
    const apply = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(wrap.clientWidth));
      const h = Math.max(1, Math.floor(wrap.clientHeight));
      if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
      lastW = w;
      lastH = h;
      const needW = Math.floor(w * dpr);
      const needH = Math.floor(h * dpr);
      if (canvas.width !== needW || canvas.height !== needH) {
        canvas.width = needW;
        canvas.height = needH;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      fitToContainer();
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [defaults, fitToContainer]);

  useEffect(() => {
    fitToContainer();
  }, [fitToContainer]);

  // manual wheel-zoom: React's onWheel is passive by default, so this needs a native listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !defaults) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const t = transformRef.current;
      const worldX = (mx - t.ox) / t.scale;
      const worldY = (my - t.oy) / t.scale;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newScale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
      transformRef.current = { scale: newScale, ox: mx - worldX * newScale, oy: my - worldY * newScale };
    };
    canvas.addEventListener("wheel", onWheelNative, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheelNative);
  }, [defaults]);

  // ---------------------------------------------------------------- hover
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverPathSet = useMemo(() => (hover ? new Set(pathToRoot(automaton.nodes, hover.id)) : null), [hover, automaton]);
  const hoverPathRef = useRef<Set<number> | null>(null);
  useEffect(() => {
    hoverPathRef.current = hoverPathSet;
  }, [hoverPathSet]);
  const hoveredIdRef = useRef<number | null>(null);
  useEffect(() => {
    hoveredIdRef.current = hover?.id ?? null;
  }, [hover]);

  const [showAllFail, setShowAllFail] = useState(false);
  const showAllFailRef = useRef(false);
  useEffect(() => {
    showAllFailRef.current = showAllFail;
  }, [showAllFail]);

  const findNearestNode = useCallback((mx: number, my: number): number | null => {
    const pos = screenPosRef.current;
    let best = -1;
    let bestD2 = HOVER_RADIUS * HOVER_RADIUS;
    for (let id = 0; id <= visibleMaxIdRef.current; id++) {
      const dx = pos.x[id] - mx;
      const dy = pos.y[id] - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = id;
      }
    }
    return best >= 0 ? best : null;
  }, []);

  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const hoverScheduledRef = useRef(false);

  const handleCanvasMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (draggingRef.current) {
        const dx = e.clientX - lastPointerRef.current.x;
        const dy = e.clientY - lastPointerRef.current.y;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
        const t = transformRef.current;
        transformRef.current = { scale: t.scale, ox: t.ox + dx, oy: t.oy + dy };
        return;
      }
      if (hoverScheduledRef.current) return;
      hoverScheduledRef.current = true;
      requestAnimationFrame(() => {
        hoverScheduledRef.current = false;
        const id = findNearestNode(mx, my);
        setHover(id === null ? null : { id, x: mx, y: my });
      });
    },
    [findNearestNode]
  );
  const handleCanvasMouseLeave = useCallback(() => {
    setHover(null);
    draggingRef.current = false;
  }, []);
  const handleCanvasMouseDown = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    draggingRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    setHover(null);
  }, []);
  useEffect(() => {
    const up = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // ---------------------------------------------------------------- build animation
  const buildStartRef = useRef<number | null>(null);
  const hasTriggeredRef = useRef(false);
  const [animPhase, setAnimPhase] = useState<BuildPhase>("pending");
  const animPhaseRef = useRef<BuildPhase>("pending");
  const [buildingPatternIdx, setBuildingPatternIdx] = useState<number | null>(null);
  const buildingPatternIdxRef = useRef<number | null>(null);

  useEffect(() => {
    if (!defaults) return;
    if (reducedMotion) {
      if (!hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        buildStartRef.current = performance.now() - (TOTAL_BUILD_MS + 1000);
      }
      return;
    }
    const wrap = wrapRef.current;
    if (!wrap || hasTriggeredRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.3 && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            buildStartRef.current = performance.now();
            observer.disconnect();
          }
        }
      },
      { threshold: [0, 0.3, 0.6, 1] }
    );
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [defaults, reducedMotion]);

  // if patterns are rebuilt after the initial build already played, snap the
  // new trie into view instantly rather than re-running a multi-second
  // animation on every edit; the replay button covers "watch it again"
  const firstAutomatonRef = useRef(true);
  useEffect(() => {
    if (firstAutomatonRef.current) {
      firstAutomatonRef.current = false;
      return;
    }
    if (hasTriggeredRef.current) {
      buildStartRef.current = performance.now() - (TOTAL_BUILD_MS + 1000);
    }
  }, [automaton]);

  const replayBuild = useCallback(() => {
    if (reducedMotion) return;
    buildStartRef.current = performance.now();
  }, [reducedMotion]);

  // ---------------------------------------------------------------- matcher
  const [matchText, setMatchText] = useState("");
  useEffect(() => {
    if (defaults) setMatchText(defaults.demoText);
  }, [defaults]);

  const [matcher, setMatcher] = useState<MatcherState>({ position: -1, state: 0, emits: [] });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const activeNodeRef = useRef(0);
  const matcherRunningRef = useRef(false);
  const failFlashRef = useRef<FailFlash | null>(null);
  const emitKeyRef = useRef(0);

  const resetMatcher = useCallback(() => {
    setPlaying(false);
    activeNodeRef.current = 0;
    matcherRunningRef.current = false;
    failFlashRef.current = null;
    setMatcher({ position: -1, state: 0, emits: [] });
  }, []);

  useEffect(() => {
    resetMatcher();
  }, [automaton, matchText, resetMatcher]);

  const stepOnce = useCallback(() => {
    setMatcher((prev) => {
      if (prev.position + 1 >= matchText.length) return prev;
      const i = prev.position + 1;
      const ch = matchText[i];
      const result = stepMatch(automaton, prev.state, ch, i);
      matcherRunningRef.current = true;
      activeNodeRef.current = result.state;
      if (result.failJumps.length > 0) {
        failFlashRef.current = { chain: [prev.state, ...result.failJumps], start: performance.now() };
      }
      if (result.emits.length === 0) return { position: i, state: result.state, emits: prev.emits };
      const newEmits: MatcherEmit[] = result.emits.map((e) => ({
        ...e,
        start: e.end - e.pattern.length + 1,
        key: emitKeyRef.current++,
      }));
      return { position: i, state: result.state, emits: [...prev.emits, ...newEmits] };
    });
  }, [automaton, matchText]);

  useEffect(() => {
    if (!playing) return;
    if (reducedMotion) {
      setPlaying(false);
      return;
    }
    if (matcher.position + 1 >= matchText.length) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(stepOnce, Math.max(45, 1000 / speed));
    return () => window.clearTimeout(id);
  }, [playing, matcher.position, speed, matchText, stepOnce, reducedMotion]);

  const packedEmits = useMemo(() => packEmitRows(matcher.emits), [matcher.emits]);

  // ---------------------------------------------------------------- draw loop
  useEffect(() => {
    if (!defaults) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    screenPosRef.current = { x: new Float32Array(automaton.nodes.length), y: new Float32Array(automaton.nodes.length) };

    let raf = 0;
    const draw = (now: number) => {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);
      if (w > 1 && h > 1) {
        const progress = computeBuildProgress(automaton, buildStartRef.current, now);
        visibleMaxIdRef.current = progress.visibleCount;

        if (progress.phase !== animPhaseRef.current) {
          animPhaseRef.current = progress.phase;
          setAnimPhase(progress.phase);
        }
        const nextBuildingIdx =
          progress.phase === "phase1" && progress.currentNodeId !== null ? attribution[progress.currentNodeId] : null;
        if (nextBuildingIdx !== buildingPatternIdxRef.current) {
          buildingPatternIdxRef.current = nextBuildingIdx;
          setBuildingPatternIdx(nextBuildingIdx);
        }

        const t = transformRef.current;
        const pos = screenPosRef.current;
        const nodes = automaton.nodes;

        // pass 1: positions + trie edges + node circles (parent id is always < child id)
        for (let id = 0; id < nodes.length; id++) {
          const visible = id === 0 || id <= progress.visibleCount;
          if (!visible) continue;
          const node = nodes[id];
          const wx = WORLD_PAD + node.depth * DEPTH_SPACING;
          const wy = WORLD_PAD + rowLayout[id] * ROW_SPACING;
          const sx = t.ox + wx * t.scale;
          const sy = t.oy + wy * t.scale;
          pos.x[id] = sx;
          pos.y[id] = sy;

          const onHoverPath = hoverPathRef.current?.has(id) ?? false;

          if (id > 0) {
            const psx = pos.x[node.parent];
            const psy = pos.y[node.parent];
            ctx.beginPath();
            ctx.moveTo(psx, psy);
            ctx.lineTo(sx, sy);
            ctx.strokeStyle = onHoverPath ? "#2563eb" : "#b8c0cd";
            ctx.lineWidth = onHoverPath ? 1.8 : 1;
            ctx.stroke();
            if (DEPTH_SPACING * t.scale > 13) {
              ctx.font = "9px ui-monospace, Consolas, monospace";
              ctx.fillStyle = onHoverPath ? "#1d4ed8" : "#94a3b8";
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              ctx.fillText(node.ch, (psx + sx) / 2, (psy + sy) / 2 - 2);
            }
          }

          const isTerminal = node.word !== null;
          const isHovered = hoveredIdRef.current === id;
          const isBuilding = progress.phase === "phase1" && id === progress.currentNodeId;
          let radius = isTerminal ? NODE_R_TERM : NODE_R;
          if (isHovered) radius += 2;
          if (isBuilding) radius += 1.2;

          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          if (isTerminal) {
            ctx.fillStyle = onHoverPath || isHovered ? "#1d4ed8" : isBuilding ? "#0f766e" : "#475569";
          } else {
            ctx.fillStyle = onHoverPath || isHovered ? "#dbeafe" : isBuilding ? "#a7f3d0" : "#ffffff";
          }
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = onHoverPath || isHovered ? "#2563eb" : "#94a3b8";
          ctx.stroke();

          if (isTerminal) {
            const pIdx = attribution[id];
            ctx.font = "700 8px ui-monospace, Consolas, monospace";
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(pIdx + 1), sx, sy + 0.5);
          }
        }

        // matcher: current automaton state ring
        if (matcherRunningRef.current && progress.phase === "done") {
          const id = activeNodeRef.current;
          ctx.beginPath();
          ctx.arc(pos.x[id], pos.y[id], (nodes[id].word !== null ? NODE_R_TERM : NODE_R) + 4, 0, Math.PI * 2);
          ctx.strokeStyle = "#16a34a";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // pass 2: failure-link arcs (only meaningful once links exist)
        if (progress.phase === "pause" || progress.phase === "phase2" || progress.phase === "done") {
          const drawArc = (fromId: number, toId: number, alpha: number, color: string, width: number) => {
            const sx = pos.x[fromId];
            const sy = pos.y[fromId];
            const tx = pos.x[toId];
            const ty = pos.y[toId];
            const midX = (sx + tx) / 2;
            const midY = Math.min(sy, ty) - 16 - Math.min(Math.abs(sx - tx) * 0.05, 24);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(midX, midY, tx, ty);
            ctx.stroke();
            ctx.restore();
          };

          if (showAllFailRef.current) {
            for (let id = 1; id < nodes.length; id++) drawArc(id, nodes[id].fail, 0.16, "#94a3b8", 1);
          } else if (hoveredIdRef.current !== null && hoveredIdRef.current > 0) {
            const id = hoveredIdRef.current;
            drawArc(id, nodes[id].fail, 0.9, "#2563eb", 1.6);
          }

          if (progress.phase === "phase2") {
            for (let k = Math.max(0, progress.bfsIndex - PHASE2_TRAIL); k <= progress.bfsIndex; k++) {
              const id = automaton.bfsOrder[k];
              const alpha = 0.25 + 0.65 * (1 - (progress.bfsIndex - k) / (PHASE2_TRAIL + 1));
              drawArc(id, nodes[id].fail, alpha, "#0f766e", k === progress.bfsIndex ? 2 : 1.2);
              if (k === progress.bfsIndex) {
                ctx.beginPath();
                ctx.arc(pos.x[id], pos.y[id], (nodes[id].word !== null ? NODE_R_TERM : NODE_R) + 3, 0, Math.PI * 2);
                ctx.strokeStyle = "#0f766e";
                ctx.lineWidth = 1.6;
                ctx.stroke();
              }
            }
          }
        }

        // matcher: fading red arcs along the failure chain just traversed
        const flash = failFlashRef.current;
        if (flash) {
          const age = now - flash.start;
          if (age > FAIL_FLASH_MS) {
            failFlashRef.current = null;
          } else {
            const alpha = 1 - age / FAIL_FLASH_MS;
            for (let i = 0; i < flash.chain.length - 1; i++) {
              const fromId = flash.chain[i];
              const toId = flash.chain[i + 1];
              const sx = pos.x[fromId];
              const sy = pos.y[fromId];
              const tx = pos.x[toId];
              const ty = pos.y[toId];
              const midX = (sx + tx) / 2;
              const midY = Math.min(sy, ty) - 16 - Math.min(Math.abs(sx - tx) * 0.05, 24);
              ctx.save();
              ctx.globalAlpha = alpha;
              ctx.strokeStyle = "#dc2626";
              ctx.lineWidth = 2.2;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.quadraticCurveTo(midX, midY, tx, ty);
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [defaults, automaton, rowLayout, attribution]);

  // ---------------------------------------------------------------- hover derived (for tooltip HTML)
  const hoverNode = hover ? automaton.nodes[hover.id] : null;
  const hoverPrefix = hoverNode ? prefixOf(automaton.nodes, hoverNode.id) : "";
  const hoverFailPrefix = hoverNode ? (hoverNode.fail === 0 ? "(root)" : prefixOf(automaton.nodes, hoverNode.fail)) : "";
  const hoverDictWord = hoverNode && hoverNode.dict !== -1 ? automaton.nodes[hoverNode.dict].word : null;
  const tooltipStyle = (() => {
    if (!hover) return undefined;
    const { w, h } = sizeRef.current;
    const boxW = 220;
    const boxH = 78;
    let left = hover.x + 12;
    let top = hover.y + 12;
    if (w > 0 && left + boxW > w) left = Math.max(4, hover.x - boxW - 12);
    if (h > 0 && top + boxH > h) top = Math.max(4, hover.y - boxH - 12);
    return { left, top };
  })();

  const buildStatusText: Record<BuildPhase, string> = {
    pending: "waiting to scroll into view...",
    phase1: "growing the trie...",
    pause: "trie complete",
    phase2: "attaching failure links (BFS)...",
    done: "built",
  };

  // ---------------------------------------------------------------- render
  if (loadError) {
    return (
      <div className="elPanel eAPanel">
        <span className="elEra">2024, CSE 100</span>
        <h2 className="elH2">Aho-Corasick, from scratch</h2>
        <p className="elNote">Could not load the automaton defaults: {loadError}</p>
      </div>
    );
  }

  if (!defaults) {
    return (
      <div className="elPanel eAPanel">
        <span className="elEra">2024, CSE 100</span>
        <h2 className="elH2">Aho-Corasick, from scratch</h2>
        <p className="elNote">Loading...</p>
      </div>
    );
  }

  return (
    <div className="elPanel eAPanel">
      <span className="elEra">2024, CSE 100</span>
      <h2 className="elH2">Aho-Corasick, from scratch</h2>
      <p className="elIntro">
        The CSE 100 notebook is three cells: install pyahocorasick, feed it eleven Fast &amp; Furious titles, print that
        the automaton has 106 nodes. Everything below is this page&apos;s own implementation of what those three cells
        hide.
      </p>

      <div className="eALayout">
        <div className="eARail">
          <p className="eARailLabel">patterns</p>
          {rows.map((row, idx) => (
            <div className="eARailRow" key={row.id} data-building={buildingPatternIdx === idx}>
              <span className="eARailIdx elMono">{idx + 1}</span>
              <input
                className="eARailInput elMono"
                type="text"
                value={row.value}
                onChange={(e) => editRow(row.id, e.target.value)}
                spellCheck={false}
                aria-label={`pattern ${idx + 1}`}
              />
              <button
                className="eARailRemove"
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={rows.length <= 1}
                aria-label={`remove pattern ${idx + 1}`}
              >
                x
              </button>
            </div>
          ))}
          <div className="eARailActions elRow">
            <button className="elBtn" type="button" onClick={addRow}>
              + pattern
            </button>
            <button className="elBtn elBtnPrimary" type="button" onClick={handleRebuild} disabled={!hasValidPattern}>
              rebuild
            </button>
            <button className="elBtn" type="button" onClick={handleReset}>
              reset to notebook&apos;s list
            </button>
          </div>
          <p className="eANodeCount" data-match={isNotebookConfig}>
            {isNotebookConfig
              ? `${nodeCountVal} nodes, exactly what pyahocorasick reported`
              : `${nodeCountVal} nodes`}
          </p>
        </div>

        <div className="eAStage">
          <div className="eACanvasControls elRow">
            <button className="elBtn" type="button" onClick={fitToContainer}>
              zoom to fit
            </button>
            <button className="elBtn" type="button" data-active={showAllFail} onClick={() => setShowAllFail((v) => !v)}>
              show all failure links
            </button>
            <button className="elBtn" type="button" onClick={replayBuild} disabled={reducedMotion}>
              replay build
            </button>
            <span className="elNote eABuildStatus">{buildStatusText[animPhase]}</span>
          </div>
          <div className="eACanvasWrap" ref={wrapRef}>
            <canvas
              ref={canvasRef}
              className="eACanvas"
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              onMouseDown={handleCanvasMouseDown}
            />
            {hover && hoverNode && tooltipStyle && (
              <div className="eATooltip" style={tooltipStyle}>
                <div className="eATooltipPrefix">&quot;{hoverPrefix || "(root)"}&quot;</div>
                <div className="eATooltipRow">
                  fail: <span className="elMono">{hoverFailPrefix || "(root)"}</span>
                </div>
                <div className="eATooltipRow">
                  dict: <span className="elMono">{hoverDictWord ?? "(none)"}</span>
                </div>
              </div>
            )}
          </div>
          <p className="elNote">
            Root at left, depth increasing right. Filled numbered circles are pattern endpoints (numbers match the rail).
            Drag to pan, scroll to zoom, hover a node for its prefix / failure target / dictionary link.
          </p>
        </div>
      </div>

      <h3 className="eAH3">Walk the text</h3>
      <div className="eAMatcher">
        <div className="eATextInputRow elRow">
          <input
            className="eATextInput"
            type="text"
            value={matchText}
            onChange={(e) => setMatchText(e.target.value)}
            spellCheck={false}
            aria-label="text to scan"
          />
        </div>
        <div className="eAMatcherControls elRow">
          <button
            className="elBtn elBtnPrimary"
            type="button"
            data-active={playing}
            onClick={() => setPlaying((p) => !p)}
            disabled={reducedMotion || matcher.position + 1 >= matchText.length}
          >
            {playing ? "pause" : "play"}
          </button>
          <button className="elBtn" type="button" onClick={stepOnce} disabled={matcher.position + 1 >= matchText.length}>
            step
          </button>
          <button className="elBtn" type="button" onClick={resetMatcher}>
            reset
          </button>
          <label className="eASpeedLabel">
            speed <span className="elMono">{speed}/s</span>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={reducedMotion}
              aria-label="matcher speed"
            />
          </label>
        </div>

        <div className="eATextStripWrap">
          <div className="eATextGrid" style={{ gridTemplateColumns: `repeat(${Math.max(matchText.length, 1)}, 1fr)` }}>
            {Array.from(matchText).map((ch, i) => (
              <span
                key={i}
                className="eAChar elMono"
                data-current={i === matcher.position}
                style={{ gridColumn: i + 1, gridRow: 1 }}
              >
                {ch === " " ? " " : ch}
              </span>
            ))}
            {packedEmits.map((p) => (
              <span
                key={p.emit.key}
                className="eAHighlightBar"
                data-tone={p.row % 4}
                style={{ gridColumn: `${p.start + 1} / ${p.emit.end + 2}`, gridRow: p.row + 2 }}
                title={p.emit.pattern}
              />
            ))}
          </div>
        </div>

        <div className="eAChips">
          {matcher.emits.length === 0 && <span className="elNote">no matches yet; press play or step</span>}
          {matcher.emits.map((e) => (
            <span key={e.key} className="elChip eAChip">{`(end=${e.end}, ${e.pattern})`}</span>
          ))}
        </div>

        <div className="eAResultsWrap">
          <div className="eAResultsList elMono">
            {matcher.emits.map((e) => (
              <div key={e.key}>{`(end=${e.end}, '${e.pattern}')`}</div>
            ))}
            {matcher.emits.length === 0 && <div className="elNote">(empty)</div>}
          </div>
        </div>
        <p className="elNote">the same (end_index, pattern) tuples the notebook&apos;s library iterator returns.</p>
      </div>

      <div className="eAComplexity">
        <p className="elMono">O(n + m + z) - text + patterns + matches; the failure links are why there&apos;s no backtracking.</p>
        <p className="elNote">
          the notebook is three cells and the library does everything; this panel is the page&apos;s own implementation of
          what that hides.
        </p>
      </div>

      <div className="eABridge">
        <p className="elNote">
          Last artifact of the era: CardClassifier.ipynb, a PyTorch tutorial follow-along (EfficientNet-B0, 53 card
          classes) - the bridge to the vision and cross-teaching pages. Its dataset isn&apos;t archived, so it&apos;s
          referenced in the Source drawer, not re-run.
        </p>
      </div>
    </div>
  );
}
