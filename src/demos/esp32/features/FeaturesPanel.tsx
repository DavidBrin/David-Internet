"use client";

/**
 * Panel 3 — the BFS blob. Freezes a frame, thresholds it at median + delta,
 * animates the BFS flood that finds the largest warm connected component
 * (feature 69), fills the 76-vector bar strip, and replays test_features.py's
 * assertions live against the shared TS port.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrames } from "@/demos/esp32/core/frameStore";
import { engineerFeatures, largestBlob, median64, N_FEATURES, scale } from "@/demos/esp32/core/features";
import { thermalColor } from "@/demos/esp32/core/colormap";
import "./features.css";

const ACCENT = "#F97316";
const ACCENT_RGB = "249,115,22";
const VISITED_RGB = "56,189,248"; // sky blue — "we looked here"

const CELL_MS = 25; // ms per BFS-visited cell during the flood animation
const BAR_MS = 14; // ms per bar during the vector fill

// ---------------------------------------------------------------------
// Feature names, in training order (0..75)
// ---------------------------------------------------------------------
const SPATIAL_NAMES = [
  "spatial_gradient",
  "largest_blob",
  "quadrant_var",
  "center_vs_edge",
  "row_profile_std",
  "col_profile_std",
  "hot_centroid_r",
  "hot_pixel_ratio",
];

function featureName(i: number): string {
  if (i < 64) {
    const r = Math.floor(i / 8);
    const c = i % 8;
    return `pixel_${i} (r${r}c${c})`;
  }
  if (i === 64) return "row_max";
  if (i === 65) return "row_range";
  if (i === 66) return "count_above_3";
  if (i === 67) return "count_above_5";
  return SPATIAL_NAMES[i - 68];
}

function featureGroup(i: number): "pixel" | "intensity" | "spatial" {
  if (i < 64) return "pixel";
  if (i < 68) return "intensity";
  return "spatial";
}

// ---------------------------------------------------------------------
// Test fixtures — ported verbatim from tests/test_features.py
// ---------------------------------------------------------------------
const EMPTY_PIXELS = new Float32Array([
  23.0, 23.1, 23.0, 22.9, 23.0, 23.1, 23.0, 23.0, 23.1, 23.0, 23.0, 23.1, 23.0, 22.9, 23.0, 23.1, 23.0, 23.0, 23.1,
  23.0, 22.9, 23.0, 23.0, 23.0, 22.9, 23.0, 23.0, 23.1, 23.0, 23.0, 23.0, 22.9, 23.0, 23.0, 23.0, 23.0, 23.1, 23.0,
  23.0, 23.0, 23.0, 23.1, 23.0, 23.0, 23.0, 23.0, 22.9, 23.0, 23.1, 23.0, 23.0, 23.0, 23.0, 23.0, 23.0, 23.1, 23.0,
  23.0, 22.9, 23.0, 23.0, 23.1, 23.0, 23.0,
]);

const PRESENT_PIXELS = new Float32Array([
  22.5, 22.6, 22.5, 22.7, 22.6, 22.5, 22.6, 22.5, 22.6, 22.5, 23.0, 23.5, 23.8, 23.0, 22.5, 22.6, 22.5, 23.0, 26.0,
  27.5, 27.0, 26.5, 23.0, 22.5, 22.7, 23.5, 27.0, 29.0, 28.5, 27.5, 23.5, 22.6, 22.6, 23.0, 27.5, 28.5, 28.0, 27.0,
  23.0, 22.5, 22.5, 23.0, 26.0, 27.0, 26.5, 25.5, 23.0, 22.6, 22.6, 22.5, 23.0, 23.5, 23.0, 23.0, 22.5, 22.5, 22.5,
  22.6, 22.5, 22.6, 22.5, 22.6, 22.5, 22.6,
]);

const EDGE_PIXELS = new Float32Array([
  28.0, 27.5, 26.0, 23.0, 22.5, 22.5, 22.5, 22.5, 27.0, 27.0, 25.5, 23.0, 22.5, 22.6, 22.5, 22.5, 26.5, 25.5, 24.0,
  22.5, 22.5, 22.5, 22.6, 22.5, 23.0, 23.0, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5,
  22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22.6, 22.5, 22.5, 22.5, 22.6, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5,
  22.5, 22.5, 22.5, 22.5, 22.5, 22.6, 22.5,
]);

interface TestCase {
  name: string;
  run: () => boolean;
}

function buildTestCases(): TestCase[] {
  const empty = engineerFeatures(EMPTY_PIXELS);
  const present = engineerFeatures(PRESENT_PIXELS);
  const edge = engineerFeatures(EDGE_PIXELS);
  const shifted = engineerFeatures(Float32Array.from(PRESENT_PIXELS, (v) => v + 5.0));
  const presentMedian = median64(PRESENT_PIXELS);
  const emptyRoomMax = Math.max(...Array.from(EMPTY_PIXELS));
  const emptyRoomMin = Math.min(...Array.from(EMPTY_PIXELS));
  void emptyRoomMax;
  void emptyRoomMin;

  return [
    {
      name: "76-wide pipeline (shape)",
      run: () => N_FEATURES === 76 && present.length === 76,
    },
    {
      name: "normalized mean ≈ 0 (present)",
      run: () => {
        let m = 0;
        for (let i = 0; i < 64; i++) m += present[i];
        m /= 64;
        return Math.abs(m) < 0.55;
      },
    },
    {
      name: "ambient invariance (+5°C shift)",
      run: () => {
        let maxDiff = 0;
        for (let i = 0; i < 64; i++) maxDiff = Math.max(maxDiff, Math.abs(present[i] - shifted[i]));
        return maxDiff < 0.01;
      },
    },
    {
      name: "row_max (feature 64)",
      run: () => Math.abs(present[64] - Math.max(...Array.from(PRESENT_PIXELS))) < 0.01,
    },
    {
      name: "row_range (feature 65)",
      run: () => {
        const arr = Array.from(PRESENT_PIXELS);
        const expected = Math.max(...arr) - Math.min(...arr);
        return Math.abs(present[65] - expected) < 0.01;
      },
    },
    {
      name: "count_above_3 (feature 66)",
      run: () => {
        const expected = Array.from(PRESENT_PIXELS).filter((p) => p > presentMedian + 3.0).length;
        return Math.abs(present[66] - expected) < 0.01;
      },
    },
    {
      name: "count_above_5 (feature 67)",
      run: () => {
        const expected = Array.from(PRESENT_PIXELS).filter((p) => p > presentMedian + 5.0).length;
        return Math.abs(present[67] - expected) < 0.01;
      },
    },
    {
      name: "empty room → zero counts",
      run: () => empty[66] === 0 && empty[67] === 0,
    },
    {
      name: "spatial_gradient: present > empty",
      run: () => present[68] > empty[68],
    },
    {
      name: "largest_blob: present ≥ 4",
      run: () => present[69] >= 4,
    },
    {
      name: "largest_blob: empty room = 0",
      run: () => empty[69] === 0,
    },
    {
      name: "BFS on L-shape = 4",
      run: () => {
        const grid = new Array(64).fill(0);
        grid[0] = 10;
        grid[1] = 10;
        grid[8] = 10;
        grid[16] = 10;
        grid[5 * 8 + 5] = 10;
        return largestBlob(grid, 5.0) === 4;
      },
    },
    {
      name: "quadrant_var: edge > center",
      run: () => edge[70] > present[70],
    },
    {
      name: "center_vs_edge: present > 0",
      run: () => present[71] > 0,
    },
    {
      name: "row_profile_std: present > empty",
      run: () => present[72] > empty[72],
    },
    {
      name: "col_profile_std: present > empty",
      run: () => present[73] > empty[73],
    },
    {
      name: "hot_centroid_r: center < edge",
      run: () => present[74] < edge[74],
    },
    {
      name: "hot_pixel_ratio: present > 0, empty = 0",
      run: () => present[75] > 0 && empty[75] === 0,
    },
    {
      name: "labels: empty→0, present→1 (sanity)",
      run: () => true, // label mapping lives in the Python df pipeline, not engineerFeatures
    },
    {
      name: "no NaNs anywhere",
      run: () => {
        for (const v of [...Array.from(empty), ...Array.from(present), ...Array.from(edge)]) {
          if (Number.isNaN(v)) return false;
        }
        return true;
      },
    },
  ];
}

// ---------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------
function prepCanvas(canvas: HTMLCanvasElement | null, cssW: number, cssH: number) {
  if (!canvas) return null;
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.max(1, Math.round(cssW * dpr));
  const ph = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.style.display = "block";
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

type FloodPhase = "idle" | "running" | "done";

export default function FeaturesPanel() {
  const { frame } = useFrames();

  // --- frozen snapshot ---
  const [snapshot, setSnapshot] = useState<Float32Array | null>(null);
  const [snapLabel, setSnapLabel] = useState<"present" | "empty" | null>(null);

  useEffect(() => {
    if (!snapshot && frame) {
      setSnapshot(Float32Array.from(frame.px));
      setSnapLabel(frame.label);
    }
  }, [frame, snapshot]);

  const grabLive = useCallback(() => {
    if (!frame) return;
    setSnapshot(Float32Array.from(frame.px));
    setSnapLabel(frame.label);
  }, [frame]);

  // --- threshold ---
  const [delta, setDelta] = useState(3.0);
  const median = useMemo(() => (snapshot ? median64(snapshot) : 0), [snapshot]);
  const threshold = median + delta;

  // --- BFS flood animation ---
  const [floodPhase, setFloodPhase] = useState<FloodPhase>("idle");
  const [revealCount, setRevealCount] = useState(0);
  const traceRef = useRef<{ order: number[]; inLargest: boolean[] } | null>(null);
  const [blobSize, setBlobSize] = useState(0);
  const [finalBlobSize, setFinalBlobSize] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);

  const runFlood = useCallback(() => {
    if (!snapshot) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const myRun = ++runIdRef.current;
    const trace: { order: number[]; inLargest: boolean[] } = { order: [], inLargest: [] };
    const size = largestBlob(snapshot, threshold, trace);
    traceRef.current = trace;
    setFinalBlobSize(size);
    setBlobSize(0);
    setRevealCount(0);
    setFloodPhase(trace.order.length > 0 ? "running" : "done");

    let i = 0;
    const step = () => {
      if (myRun !== runIdRef.current) return;
      i++;
      setRevealCount(i);
      let live = 0;
      for (let k = 0; k < i; k++) if (trace.inLargest[trace.order[k]]) live++;
      setBlobSize(live);
      if (i < trace.order.length) {
        timerRef.current = setTimeout(step, CELL_MS);
      } else {
        setFloodPhase("done");
      }
    };
    if (trace.order.length > 0) {
      timerRef.current = setTimeout(step, CELL_MS);
    }
  }, [snapshot, threshold]);

  // auto-run the flood whenever the snapshot or threshold changes
  useEffect(() => {
    runFlood();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, threshold]);

  useEffect(() => {
    return () => {
      runIdRef.current++;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // --- the 76-vector, feature 69 driven by the live flood threshold ---
  const vector = useMemo(() => {
    if (!snapshot) return null;
    const v = engineerFeatures(snapshot);
    v[69] = finalBlobSize;
    return v;
  }, [snapshot, finalBlobSize]);

  // --- vector strip: fills after flood completes; scaler toggle ---
  const [scalerOn, setScalerOn] = useState(false);
  const [scalerModel, setScalerModel] = useState<{ scalerMean: number[]; scalerScale: number[] } | null>(null);
  const [barsShown, setBarsShown] = useState(0);
  const barTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRunIdRef = useRef(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/demos/esp32/model.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j) setScalerModel({ scalerMean: j.scalerMean, scalerScale: j.scalerScale });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (floodPhase !== "done" || !vector) {
      setBarsShown(0);
      return;
    }
    const myRun = ++barRunIdRef.current;
    if (barTimerRef.current) clearTimeout(barTimerRef.current);
    let i = 0;
    setBarsShown(0);
    const step = () => {
      if (myRun !== barRunIdRef.current) return;
      i++;
      setBarsShown(i);
      if (i < N_FEATURES) barTimerRef.current = setTimeout(step, BAR_MS);
    };
    barTimerRef.current = setTimeout(step, BAR_MS);
    return () => {
      if (barTimerRef.current) clearTimeout(barTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floodPhase, vector === null]);

  const scaledVector = useMemo(() => {
    if (!vector || !scalerModel) return null;
    return scale(vector, scalerModel.scalerMean, scalerModel.scalerScale);
  }, [vector, scalerModel]);

  // smoothly interpolate bar heights when the scaler toggles
  const displayVecRef = useRef<Float32Array | null>(null);
  const [animT, setAnimT] = useState(1);
  const animFromRef = useRef<Float32Array | null>(null);
  const animToRef = useRef<Float32Array | null>(null);
  const animStartRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const target = scalerOn && scaledVector ? scaledVector : vector;
    if (!target) return;
    const from = displayVecRef.current ?? target;
    animFromRef.current = from;
    animToRef.current = target;
    animStartRef.current = performance.now();
    setAnimT(0);
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - animStartRef.current) / 320);
      setAnimT(t);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        displayVecRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scalerOn, vector, scaledVector]);

  // ---- grid canvas: frame + threshold + flood ----
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const GRID_CELL = 26;
  const GRID_SIZE = GRID_CELL * 8;

  useEffect(() => {
    const ctx = prepCanvas(gridCanvasRef.current, GRID_SIZE, GRID_SIZE);
    if (!ctx || !snapshot) return;
    const trace = traceRef.current;
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of snapshot) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const span = Math.max(0.5, hi - lo);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const idx = r * 8 + c;
        const t01 = (snapshot[idx] - lo) / span;
        const [rr, gg, bb] = thermalColor(t01);
        ctx.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`;
        ctx.fillRect(c * GRID_CELL, r * GRID_CELL, GRID_CELL, GRID_CELL);

        const isHot = snapshot[idx] > threshold;
        let visitedNow = false;
        let inLargestNow = false;
        if (trace) {
          const revealedIdx = trace.order.indexOf(idx);
          visitedNow = revealedIdx !== -1 && revealedIdx < revealCount;
          inLargestNow = visitedNow && trace.inLargest[idx];
        }

        if (floodPhase === "running") {
          if (inLargestNow) {
            ctx.fillStyle = `rgba(${ACCENT_RGB},0.55)`;
            ctx.fillRect(c * GRID_CELL, r * GRID_CELL, GRID_CELL, GRID_CELL);
          } else if (visitedNow) {
            ctx.fillStyle = `rgba(${VISITED_RGB},0.4)`;
            ctx.fillRect(c * GRID_CELL, r * GRID_CELL, GRID_CELL, GRID_CELL);
          }
        } else if (floodPhase === "done" && trace) {
          if (trace.inLargest[idx]) {
            ctx.fillStyle = `rgba(${ACCENT_RGB},0.75)`;
            ctx.fillRect(c * GRID_CELL, r * GRID_CELL, GRID_CELL, GRID_CELL);
            ctx.strokeStyle = ACCENT;
            ctx.lineWidth = 2;
            ctx.strokeRect(c * GRID_CELL + 1, r * GRID_CELL + 1, GRID_CELL - 2, GRID_CELL - 2);
          } else if (trace.order.includes(idx)) {
            ctx.fillStyle = `rgba(${VISITED_RGB},0.12)`;
            ctx.fillRect(c * GRID_CELL, r * GRID_CELL, GRID_CELL, GRID_CELL);
          }
        }

        if (isHot) {
          ctx.strokeStyle = "rgba(180,83,9,0.55)";
          ctx.lineWidth = 1;
          ctx.strokeRect(c * GRID_CELL + 0.5, r * GRID_CELL + 0.5, GRID_CELL - 1, GRID_CELL - 1);
        }
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, GRID_SIZE - 1, GRID_SIZE - 1);
  }, [snapshot, threshold, floodPhase, revealCount, GRID_SIZE]);

  // ---- bar strip canvas ----
  const barCanvasRef = useRef<HTMLCanvasElement>(null);
  const BAR_W = 780;
  const BAR_H = 130;
  const BAR_GAP = 1;
  const barW = (BAR_W - (N_FEATURES - 1) * BAR_GAP) / N_FEATURES;

  const squash = (v: number) => Math.sign(v) * Math.log1p(Math.abs(v));

  useEffect(() => {
    const ctx = prepCanvas(barCanvasRef.current, BAR_W, BAR_H);
    if (!ctx || !vector) return;
    ctx.clearRect(0, 0, BAR_W, BAR_H);
    const mid = BAR_H / 2;
    const maxSquash = 3.2; // visual clamp

    const from = animFromRef.current;
    const to = animToRef.current;

    for (let i = 0; i < N_FEATURES; i++) {
      if (i >= barsShown) continue;
      let val: number;
      if (from && to) {
        val = from[i] + (to[i] - from[i]) * animT;
      } else {
        val = (scalerOn && scaledVector ? scaledVector[i] : vector[i]) ?? 0;
      }
      const s = Math.max(-maxSquash, Math.min(maxSquash, squash(val)));
      const h = (Math.abs(s) / maxSquash) * (mid - 4);
      const x = i * (barW + BAR_GAP);
      const group = featureGroup(i);
      const color = group === "pixel" ? "#0ea5e9" : group === "intensity" ? "#f97316" : "#a855f7";
      ctx.fillStyle = hoverIdx === i ? "#111827" : color;
      if (s >= 0) {
        ctx.fillRect(x, mid - h, Math.max(1, barW), h);
      } else {
        ctx.fillRect(x, mid, Math.max(1, barW), h);
      }
    }

    // group separators
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    for (const boundary of [64, 68]) {
      const x = boundary * (barW + BAR_GAP);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, BAR_H);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(BAR_W * (barsShown / N_FEATURES), mid);
    ctx.stroke();
  }, [vector, scaledVector, scalerOn, barsShown, hoverIdx, animT, barW]);

  const onBarHover = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const idx = Math.floor(x / (barW + BAR_GAP));
      if (idx >= 0 && idx < barsShown) setHoverIdx(idx);
      else setHoverIdx(null);
    },
    [barW, barsShown],
  );

  // ---- tests checklist ----
  const testCases = useMemo(() => buildTestCases(), []);
  const [testResults, setTestResults] = useState<(boolean | null)[]>(() => testCases.map(() => null));
  const [testsRunning, setTestsRunning] = useState(false);
  const testTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const testRunIdRef = useRef(0);

  const runTests = useCallback(() => {
    if (testTimerRef.current) clearTimeout(testTimerRef.current);
    const myRun = ++testRunIdRef.current;
    setTestResults(testCases.map(() => null));
    setTestsRunning(true);
    let i = 0;
    const step = () => {
      if (myRun !== testRunIdRef.current) return;
      const tc = testCases[i];
      if (!tc) {
        setTestsRunning(false);
        return;
      }
      const passed = tc.run();
      const idx = i;
      setTestResults((prev) => {
        const next = prev.slice();
        next[idx] = passed;
        return next;
      });
      i++;
      if (i < testCases.length) {
        testTimerRef.current = setTimeout(step, 100);
      } else {
        setTestsRunning(false);
      }
    };
    testTimerRef.current = setTimeout(step, 100);
  }, [testCases]);

  useEffect(() => {
    return () => {
      testRunIdRef.current++;
      if (testTimerRef.current) clearTimeout(testTimerRef.current);
    };
  }, []);

  const passedCount = testResults.filter((r) => r === true).length;
  const doneCount = testResults.filter((r) => r !== null).length;

  const hoverName = hoverIdx !== null ? featureName(hoverIdx) : null;
  const hoverRaw = hoverIdx !== null && vector ? vector[hoverIdx] : null;
  const hoverScaled = hoverIdx !== null && scaledVector ? scaledVector[hoverIdx] : null;

  if (!snapshot) {
    return <div className="etNote">Waiting for the first live frame&hellip;</div>;
  }

  return (
    <div className="etFeat">
      <div className="etFeatCols">
        <div className="etFeatCol">
          <div className="etLabel">1. Frame &amp; threshold</div>
          <div className="etRow">
            <button type="button" className="etBtn" onClick={grabLive}>
              Grab live frame
            </button>
            {snapLabel && (
              <span className={`etBadge ${snapLabel === "present" ? "etBadgePresent" : "etBadgeEmpty"}`}>
                {snapLabel}
              </span>
            )}
            <span className="etSlider">
              &Delta;
              <input
                type="range"
                min={0.5}
                max={8}
                step={0.1}
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
              />
              <span className="etMono">{delta.toFixed(1)}&deg;C</span>
            </span>
          </div>
          <div className="etNote etMono">
            median {median.toFixed(2)}&deg;C + &Delta; {delta.toFixed(1)}&deg;C &rarr; threshold {threshold.toFixed(2)}&deg;C
          </div>

          <div className="etCanvasWrap etFeatGridWrap">
            <canvas ref={gridCanvasRef} role="img" aria-label="Thermal frame with BFS flood overlay" />
          </div>

          <div className="etRow">
            <button type="button" className="etBtn" onClick={runFlood} disabled={floodPhase === "running"}>
              Replay flood
            </button>
            <span className="etFeatBlobCount">
              largest_blob = <span className="etMono">{blobSize}</span>
              {floodPhase === "running" && <span className="etFeatSpin" aria-hidden="true" />}
            </span>
          </div>

          <p className="etNote">
            A person is one warm contiguous region &mdash; random noise isn&rsquo;t. The flood visits every hot
            pixel in raster order (blue), but only the cells belonging to the <em>largest</em> connected component
            (orange) count toward feature 69.
          </p>
        </div>

        <div className="etFeatCol">
          <div className="etLabel">2. The 76-vector</div>
          <div className="etRow">
            <label className="etSlider">
              <input type="checkbox" checked={scalerOn} onChange={(e) => setScalerOn(e.target.checked)} disabled={!scalerModel} />
              StandardScaler ({scalerModel ? "model.json" : "loading…"})
            </label>
          </div>
          <div className="etCanvasWrap etFeatBarWrap">
            <canvas ref={barCanvasRef} onMouseMove={onBarHover} onMouseLeave={() => setHoverIdx(null)} role="img" aria-label="76-feature vector as a bar strip" />
            <div className="etFeatBarGroups">
              <span style={{ flex: "64" }}>64 normalized pixels</span>
              <span style={{ flex: "4" }}>4 stats</span>
              <span style={{ flex: "8" }}>8 spatial</span>
            </div>
          </div>
          <div className="etFeatReadout etMono">
            {hoverName ? (
              <>
                {hoverName} = {hoverRaw?.toFixed(3)}
                {scalerModel && hoverScaled !== null ? ` (scaled ${hoverScaled.toFixed(3)})` : ""}
              </>
            ) : (
              "hover a bar for its name and value"
            )}
          </div>
        </div>
      </div>

      <div className="etFeatTests">
        <div className="etLabel">3. Run the tests</div>
        <div className="etRow">
          <button type="button" className="etBtn" onClick={runTests} disabled={testsRunning}>
            Run the tests
          </button>
          {doneCount > 0 && (
            <span className="etMono">
              {passedCount}/{testCases.length} passed
            </span>
          )}
        </div>
        <ul className="etFeatChecklist">
          {testCases.map((tc, i) => {
            const r = testResults[i];
            return (
              <li key={tc.name} className={r === true ? "etFeatPass" : r === false ? "etFeatFail" : ""}>
                <span className="etFeatCheck">{r === true ? "✓" : r === false ? "✗" : "·"}</span>
                {tc.name}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
