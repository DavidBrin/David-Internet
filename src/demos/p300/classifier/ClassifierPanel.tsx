"use client";

/**
 * #classifier — "from a window to a classifier". Prefix pC. Three zones:
 *  1. the window: an illustrative 78-sample x channel heatmap (this panel's
 *     own synthetic data, seeded — no real EEG ships with the page).
 *  2. the CNN in two moves: a DOM diagram of CNN1's five layers, hoverable
 *     for tensor shapes, next to the project's own architecture figure.
 *  3. the head map: all 64 electrodes on a top-down head, toggled by
 *     subset (CNN2a/CNN2b/CNN2c) or colored by one of 10 illustrative
 *     spatial-filter weight maps.
 *
 * Data: fetched at runtime from /demos/p300/head.json (montage positions,
 * electrode subsets, illustrative filter weights).
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALPHA_GAINS,
  CHANNELS_8,
  NoiseChannel,
  P300_GAINS,
  SAMPLE_RATE,
  WINDOW_SAMPLES,
  mulberry32,
  p300Template,
} from "../core/eeg";
import { useDprCanvas } from "./useDprCanvas";
import {
  HEAD_LOGICAL,
  buildFilterGrid,
  divergingCss,
  headTransform,
  project,
  type HeadData,
  type SubsetKey,
} from "./headmap";
import "./classifier.css";

// ------------------------------------------------------------- the window

/** Build the illustrative window heatmap once (deterministic seed, module-level). */
function buildWindowData(): { channels: readonly string[]; grid: number[][] } {
  const channels = CHANNELS_8;
  const raw: number[][] = [];
  for (let c = 0; c < channels.length; c++) {
    const ch = channels[c];
    const noise = new NoiseChannel(mulberry32(4200 + c * 97), ALPHA_GAINS[ch]);
    const row: number[] = [];
    for (let s = 0; s < WINDOW_SAMPLES; s++) {
      const tMs = (s * 1000) / SAMPLE_RATE;
      row.push(noise.next(tMs) + P300_GAINS[ch] * p300Template(tMs) * 2.4);
    }
    raw.push(row);
  }
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (const row of raw) for (const v of row) { sum += v; sumSq += v * v; n++; }
  const mean = sum / n;
  const std = Math.sqrt(Math.max(sumSq / n - mean * mean, 1e-6));
  const grid = raw.map((row) => row.map((v) => (v - mean) / std));
  return { channels, grid };
}

const WINDOW_DATA = buildWindowData();

// ------------------------------------------------------------------ CNN diagram

interface StageSpec {
  name: string;
  desc: string;
  shape: string;
}

const STAGES: StageSpec[] = [
  { name: "window", desc: "raw input patch", shape: "(78, N)" },
  { name: "Conv1D k=1 x10", desc: "mixes channels at each instant — a filter over the scalp", shape: "(78, 10)" },
  { name: "Conv1D k=13 s=11 x50", desc: "slides over the window — temporal convolution", shape: "(6, 50)" },
  { name: "Flatten", desc: "", shape: "(300)" },
  { name: "Dense 100", desc: "", shape: "(100)" },
  { name: "Dense 1, sigmoid", desc: "P300 or not", shape: "(1)" },
];

// -------------------------------------------------------------- head map

const SUBSET_CHIPS: SubsetKey[] = ["all", "cnn2a", "cnn2b_A", "cnn2b_B", "F", "C", "P", "O", "LT", "RT"];
/** Auto-play cycles through every chip, ending on CNN2a's 8 as the resting state. */
const AUTOPLAY_ORDER: SubsetKey[] = ["all", "cnn2b_A", "cnn2b_B", "F", "C", "P", "O", "LT", "RT", "cnn2a"];
const AUTOPLAY_STEP_MS = 900;

const SUBSET_INFO: Record<SubsetKey, { label: string; note: string }> = {
  all: { label: "all 64", note: "The full montage — CNN1 trains on every electrode, no selection." },
  cnn2a: {
    label: "CNN2a's 8 (prefixed)",
    note: "CNN2a keeps the classic P300 sites, chosen by hand from the ERP literature: Fz, Cz, Pz, P3, P4, PO7, PO8, Oz.",
  },
  cnn2b_A: {
    label: "CNN2b subject A (learned)",
    note: "CNN2b picks its 8 electrodes by reading off CNN1's first-layer weights — subject A's data-driven set.",
  },
  cnn2b_B: {
    label: "CNN2b subject B (learned)",
    note: "Subject B's learned set — and it disagrees with subject A: only 3 electrodes are shared between the two.",
  },
  F: { label: "F", note: "CNN2c's topological experiment: train on the frontal lobe alone." },
  C: { label: "C", note: "CNN2c's topological experiment: train on the central lobe alone." },
  P: { label: "P", note: "CNN2c's topological experiment: train on the parietal lobe alone." },
  O: { label: "O", note: "CNN2c's topological experiment: train on the occipital lobe alone." },
  LT: { label: "LT", note: "CNN2c's topological experiment: train on the left temporal lobe alone." },
  RT: { label: "RT", note: "CNN2c's topological experiment: train on the right temporal lobe alone." },
};

const FILTER_GRID_SIZE = 72;

function subsetIndices(head: HeadData, key: SubsetKey): readonly number[] {
  if (key === "all") return head.names.map((_, i) => i);
  return head.subsets[key];
}

export default function ClassifierPanel() {
  // ---- head.json fetch
  const [head, setHead] = useState<HeadData | null>(null);
  const [headError, setHeadError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/demos/p300/head.json")
      .then((r) => (r.ok ? (r.json() as Promise<HeadData>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) setHead(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setHeadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- head-map interaction state
  const [subset, setSubset] = useState<SubsetKey>("all");
  const [hoverElectrode, setHoverElectrode] = useState<number | null>(null);
  const [hoverFilter, setHoverFilter] = useState<number | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<number | null>(null);
  const displayedFilter = hoverFilter ?? selectedFilter;

  // ---- one-time auto-play through the subset chips, ending on CNN2a's 8.
  // Strict-Mode-safe: the guard ref is reset in cleanup, not set-and-forget,
  // so React's dev-mode mount -> cleanup -> remount still runs the sequence
  // for real on the second (kept) mount rather than skipping it.
  const autoplayRanRef = useRef(false);
  const autoplayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoplay = useCallback(() => {
    if (autoplayTimerRef.current !== null) {
      clearInterval(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (autoplayRanRef.current) return;
    autoplayRanRef.current = true;
    let i = 0;
    setSubset(AUTOPLAY_ORDER[0]);
    autoplayTimerRef.current = setInterval(() => {
      i += 1;
      if (i >= AUTOPLAY_ORDER.length) {
        stopAutoplay();
        return;
      }
      setSubset(AUTOPLAY_ORDER[i]);
    }, AUTOPLAY_STEP_MS);
    return () => {
      stopAutoplay();
      autoplayRanRef.current = false;
    };
  }, [stopAutoplay]);

  const chooseSubset = useCallback(
    (key: SubsetKey) => {
      stopAutoplay();
      setSelectedFilter(null);
      setSubset(key);
    },
    [stopAutoplay],
  );

  const positions = useMemo<[number, number][]>(() => {
    if (!head) return [];
    return head.names.map((n) => head.pos[n] ?? [0, 0]);
  }, [head]);

  const highlighted = useMemo<Set<number>>(() => {
    if (!head) return new Set<number>();
    return new Set(subsetIndices(head, subset));
  }, [head, subset]);

  // ---- filter scalp-map underlay canvas
  const filterGridCache = useRef<Map<number, ImageData>>(new Map());
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  const drawHeadUnderlay = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);
      if (!head || displayedFilter === null) return;
      let grid = filterGridCache.current.get(displayedFilter);
      if (!grid) {
        grid = buildFilterGrid(positions, head.filters[displayedFilter], FILTER_GRID_SIZE);
        filterGridCache.current.set(displayedFilter, grid);
      }
      let off = offscreenRef.current;
      if (!off) {
        off = document.createElement("canvas");
        offscreenRef.current = off;
      }
      if (off.width !== FILTER_GRID_SIZE || off.height !== FILTER_GRID_SIZE) {
        off.width = FILTER_GRID_SIZE;
        off.height = FILTER_GRID_SIZE;
      }
      const offCtx = off.getContext("2d");
      if (!offCtx) return;
      offCtx.putImageData(grid, 0, 0);

      const t = headTransform();
      ctx.save();
      ctx.scale(w / HEAD_LOGICAL, h / HEAD_LOGICAL);
      ctx.beginPath();
      ctx.arc(t.cx, t.cy, t.r * 1.02, 0, Math.PI * 2);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, FILTER_GRID_SIZE, FILTER_GRID_SIZE, 0, 0, HEAD_LOGICAL, HEAD_LOGICAL);
      ctx.restore();
    },
    [head, displayedFilter, positions],
  );

  const { canvasRef: headCanvasRef, wrapRef: headWrapRef } = useDprCanvas(drawHeadUnderlay);

  // ---- the window heatmap canvas
  const drawWindow = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const { grid } = WINDOW_DATA;
    const nRows = grid.length;
    const nCols = grid[0].length;
    const cellW = w / nCols;
    const cellH = h / nRows;
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const v = Math.max(-1, Math.min(1, grid[r][c] / 1.9));
        ctx.fillStyle = divergingCss(v);
        ctx.fillRect(c * cellW, r * cellH, cellW + 0.6, cellH + 0.6);
      }
    }
  }, []);
  const { canvasRef: windowCanvasRef, wrapRef: windowWrapRef } = useDprCanvas(drawWindow);

  const t = headTransform();
  const nosePts = (() => {
    const [bx1, by] = project(t, -0.09, 1.0);
    const [bx2] = project(t, 0.09, 1.0);
    const [tx, ty] = project(t, 0, 1.16);
    return `${bx1},${by} ${tx},${ty} ${bx2},${by}`;
  })();

  const filterCaption =
    displayedFilter === null
      ? "Hover or click a filter (1–10) to color every electrode by that filter's spatial weight."
      : displayedFilter === 0
        ? "Filter 1 — seeded centro-parietal: heaviest over Pz/Cz/parietal sites, the same region the P300 peaks over."
        : `Filter ${displayedFilter + 1} of 10 — an illustrative spatial-filter weight map.`;

  return (
    <div className="ppPanel">
      <h2 className="ppH2">From a window to a classifier</h2>
      <p className="ppIntro pCIntro">
        Every flash opens a 650 ms window across the electrodes — bandpassed, downsampled, z-scored — and P300
        detection becomes binary image classification on that window. Below: what the window looks like, how CNN1
        reads it in two convolutions, and where the electrodes it can choose from actually sit on the scalp.
      </p>

      {/* ------------------------------------------------------------ zone 1 */}
      <div className="pCZone">
        <h3 className="pCZoneTitle">The window</h3>
        <div className="pCWindowWrap">
          <div className="pCWindowAxisY">channels</div>
          <div className="pCWindowCanvasCol">
            <div className="pCCanvasBox" ref={windowWrapRef}>
              <canvas
                ref={windowCanvasRef}
                role="img"
                aria-label="Illustrative 650 millisecond by channel window heatmap, with a P300-like brightening near 300 milliseconds on centro-parietal rows"
              />
            </div>
            <div className="pCWindowAxisX">78 samples (650 ms @ 120 Hz)</div>
          </div>
        </div>
        <p className="ppNote">
          Bandpass 0.1–20 Hz, downsampled 240 → 120 Hz, z-scored per window. This heatmap is illustrative only — no
          real EEG ships with this page; seeded noise plus a synthetic P300 bump around the 300 ms column stands in
          for a real windowed epoch.
        </p>
      </div>

      {/* ------------------------------------------------------------ zone 2 */}
      <div className="pCZone">
        <h3 className="pCZoneTitle">The CNN in two moves</h3>
        <div className="pCDiagRow">
          {STAGES.map((s, i) => (
            <Fragment key={s.name}>
              {i > 0 && (
                <span className="pCArrow" aria-hidden="true">
                  &rarr;
                </span>
              )}
              <div className="pCStage" data-shape={s.shape} tabIndex={0}>
                <span className="pCStageName">{s.name}</span>
                {s.desc && <span className="pCStageDesc">{s.desc}</span>}
              </div>
            </Fragment>
          ))}
        </div>
        <div className="pCDiagFigureRow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/demos/p300/cnn-architecture.webp"
            alt="The p300-speller project's own CNN1 architecture diagram"
            className="pCDiagFigure"
          />
          <p className="ppNote pCDiagFigureCaption">
            The project&rsquo;s own architecture figure (Manucar/Gualor, p300-speller repo) — hover a box above for
            its tensor shape.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------ zone 3 */}
      <div className="pCZone">
        <h3 className="pCZoneTitle">The head map</h3>

        {headError && <p className="ppNote">Could not load the electrode layout ({headError}).</p>}
        {!head && !headError && <p className="ppNote">Loading electrode layout…</p>}

        {head && (
          <>
            <div className="ppRow pCChipRow">
              {SUBSET_CHIPS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="ppBtn pCChipBtn"
                  data-active={subset === key && displayedFilter === null}
                  onClick={() => chooseSubset(key)}
                >
                  {SUBSET_INFO[key].label}
                </button>
              ))}
            </div>

            <div className="pCHeadMain">
              <div className="pCHeadStage" ref={headWrapRef}>
                <canvas ref={headCanvasRef} className="pCHeadCanvas" aria-hidden="true" />
                <svg
                  className="pCHeadSvg"
                  viewBox={`0 0 ${HEAD_LOGICAL} ${HEAD_LOGICAL}`}
                  role="img"
                  aria-label="Top-down 10-20 head map with 64 electrodes"
                >
                  <circle cx={t.cx} cy={t.cy} r={t.r} fill="none" stroke="#7e22ce" strokeWidth={1.5} opacity={0.55} />
                  <polygon points={nosePts} fill="none" stroke="#7e22ce" strokeWidth={1.5} opacity={0.55} />
                  <ellipse
                    cx={t.cx - t.r - 3}
                    cy={t.cy}
                    rx={4}
                    ry={11}
                    fill="none"
                    stroke="#7e22ce"
                    strokeWidth={1.5}
                    opacity={0.55}
                  />
                  <ellipse
                    cx={t.cx + t.r + 3}
                    cy={t.cy}
                    rx={4}
                    ry={11}
                    fill="none"
                    stroke="#7e22ce"
                    strokeWidth={1.5}
                    opacity={0.55}
                  />
                  {head.names.map((name, i) => {
                    const [x, y] = project(t, positions[i][0], positions[i][1]);
                    const isHover = hoverElectrode === i;
                    let fill = "#fff";
                    let stroke = "#9aa0ab";
                    if (displayedFilter !== null) {
                      fill = divergingCss(head.filters[displayedFilter][i]);
                      stroke = "#3d1d5c";
                    } else if (highlighted.has(i)) {
                      fill = "#a855f7";
                      stroke = "#7e22ce";
                    }
                    return (
                      <circle
                        key={name}
                        className="pCElectrode"
                        cx={x}
                        cy={y}
                        r={isHover ? 5.5 : 3.6}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isHover ? 1.6 : 1}
                        onMouseEnter={() => setHoverElectrode(i)}
                        onMouseLeave={() => setHoverElectrode((h) => (h === i ? null : h))}
                      >
                        <title>{name}</title>
                      </circle>
                    );
                  })}
                </svg>
              </div>

              <div className="pCHeadSide">
                <p className="pCHoverLabel">{hoverElectrode !== null ? head.names[hoverElectrode] : " "}</p>
                <p className="ppNote">{displayedFilter !== null ? filterCaption : SUBSET_INFO[subset].note}</p>

                <span className="pCLabel">filters (illustrative spatial weights)</span>
                <div className="pCFilterStrip">
                  {head.filters.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className="pCFilterBtn"
                      data-active={selectedFilter === i}
                      onMouseEnter={() => setHoverFilter(i)}
                      onMouseLeave={() => setHoverFilter((f) => (f === i ? null : f))}
                      onFocus={() => setHoverFilter(i)}
                      onBlur={() => setHoverFilter((f) => (f === i ? null : f))}
                      onClick={() => {
                        stopAutoplay();
                        setSelectedFilter((s) => (s === i ? null : i));
                      }}
                      aria-label={`Filter ${i + 1}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <p className="ppNote pCFiltersNote">{head.filtersNote}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
