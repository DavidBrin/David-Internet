"use client";

/**
 * Chapter 4 — "Four compounds, sixty days" (Plate F).
 *
 * Three sub-panels: the plate layout (compound columns x stim/no-stim rows,
 * D-1..D60 day picker), the spike raster with live burst / network-event
 * detection, and the knee-mode dose-response boxplots. Real rendered
 * figures from the notebooks close the chapter.
 */
import { useEffect, useMemo, useState } from "react";
import { PLATE_F, doseKey, groupColor } from "../core/plate";
import { synthSpikes } from "../core/synth";
import { isiArray, burstRate, networkEvents, perWell, N_ROWS, N_COLS, N_ELEC } from "../core/bursts";
import { burstPlacements, networkEventPlacements } from "./detectPlacements";
import RasterCanvas, { type RasterRow } from "./RasterCanvas";
import BoxPlot, { type BoxPlotPoint } from "./BoxPlot";
import { useSpectralGrid } from "./spectralCache";
import { useOrgFigures, figureUrl } from "../figures";
import "./compounds.css";

const DURATION = 600; // seconds of synthetic recording per day
const BASE_RATE = 30; // seconds of data swept per real second, at 1x
const SPEEDS = [0.5, 1, 2, 4];

type BoxParam = "offset" | "exponent" | "peakCf" | "peakPower" | "burstCount";

const PARAM_META: Record<BoxParam, { label: string; short: string; unit: string; format: (v: number) => string }> = {
  offset: { label: "Aperiodic offset", short: "offset", unit: "log₁₀ power", format: (v) => v.toFixed(2) },
  exponent: { label: "Aperiodic exponent", short: "exponent", unit: "", format: (v) => v.toFixed(2) },
  peakCf: { label: "Peak center frequency", short: "peak CF", unit: "Hz", format: (v) => v.toFixed(1) },
  peakPower: { label: "Peak power", short: "peak power", unit: "log₁₀", format: (v) => v.toFixed(2) },
  burstCount: { label: "Burst count / well", short: "burst count", unit: "per 10 min", format: (v) => v.toFixed(0) },
};

type StimFilter = "all" | "stim" | "nostim";

function wellLabel(r: number, c: number): string {
  return String.fromCharCode(65 + r) + (c + 1);
}

export default function CompoundsPanel() {
  const [day, setDay] = useState(PLATE_F.days[4]); // D6 — an early, active-ish day
  const [isiThresh, setIsiThresh] = useState(1.0);
  const [minSpikes, setMinSpikes] = useState(3);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [cursorT, setCursorT] = useState(0);
  const [boxParam, setBoxParam] = useState<BoxParam>("exponent");
  const [stimFilter, setStimFilter] = useState<StimFilter>("all");

  // ---- spike data + detection (recomputed only when day / thresholds change) ----
  const grid = useMemo(() => synthSpikes(PLATE_F, day, DURATION), [day]);
  const isi = useMemo(() => isiArray(grid), [grid]);
  const burstGridExact = useMemo(() => burstRate(isi, isiThresh, minSpikes), [isi, isiThresh, minSpikes]);
  const burstPerWellGrid = useMemo(() => perWell(burstGridExact), [burstGridExact]);
  const nBursts = useMemo(() => burstPerWellGrid.reduce((a, row) => a + row.reduce((b, v) => b + v, 0), 0), [burstPerWellGrid]);
  const networkEventGrid = useMemo(() => networkEvents(grid, isiThresh, minSpikes), [grid, isiThresh, minSpikes]);
  const nNetworkEvents = useMemo(() => networkEventGrid.reduce((a, row) => a + row.reduce((b, v) => b + v, 0), 0), [networkEventGrid]);

  // local re-detection, for PLACEMENT only (see detectPlacements.ts) — counts must match the above
  const burstPlacementsGrid = useMemo(() => burstPlacements(grid, isiThresh, minSpikes), [grid, isiThresh, minSpikes]);
  const networkEventPlacementsGrid = useMemo(() => networkEventPlacements(grid, isiThresh, minSpikes), [grid, isiThresh, minSpikes]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    for (let r = 0; r < N_ROWS; r++) {
      for (let c = 0; c < N_COLS; c++) {
        if (burstPerWellGrid[r][c] !== burstPlacementsGrid[r][c].length) {
          console.warn(`[ch4 raster] burst count mismatch at ${wellLabel(r, c)}: exact=${burstPerWellGrid[r][c]} placements=${burstPlacementsGrid[r][c].length}`);
        }
        if (networkEventGrid[r][c] !== networkEventPlacementsGrid[r][c].length) {
          console.warn(`[ch4 raster] network-event count mismatch at ${wellLabel(r, c)}: exact=${networkEventGrid[r][c]} placements=${networkEventPlacementsGrid[r][c].length}`);
        }
      }
    }
  }, [burstPerWellGrid, burstPlacementsGrid, networkEventGrid, networkEventPlacementsGrid]);

  const rasterRows = useMemo<RasterRow[]>(() => {
    const rows: RasterRow[] = [];
    for (let r = 0; r < N_ROWS; r++) {
      for (let c = 0; c < N_COLS; c++) {
        const ticks: { t: number; lane: number }[] = [];
        let total = 0;
        for (let i = 0; i < N_ELEC; i++) {
          for (let j = 0; j < N_ELEC; j++) {
            const lane = i * N_ELEC + j;
            for (const t of grid[r][c][i][j]) {
              ticks.push({ t, lane });
              total += 1;
            }
          }
        }
        ticks.sort((a, b) => a.t - b.t);
        rows.push({
          label: wellLabel(r, c),
          color: groupColor(PLATE_F, doseKey(PLATE_F, r, c)),
          stim: PLATE_F.stim[r][c],
          active: total > 0,
          ticks,
          bursts: burstPlacementsGrid[r][c].map((b) => ({ lane: b.elec, t0: b.t0, t1: b.t1 })),
          events: networkEventPlacementsGrid[r][c],
        });
      }
    }
    return rows;
  }, [grid, burstPlacementsGrid, networkEventPlacementsGrid]);

  // ---- spectral fits for the boxplot (knee mode, lazy + cached) ----
  const { grid: specGrid, progress: specProgress } = useSpectralGrid(day);

  const boxPoints = useMemo<BoxPlotPoint[]>(() => {
    const pts: BoxPlotPoint[] = [];
    for (let r = 0; r < N_ROWS; r++) {
      for (let c = 0; c < N_COLS; c++) {
        const stimHere = PLATE_F.stim[r][c];
        if (stimFilter === "stim" && !stimHere) continue;
        if (stimFilter === "nostim" && stimHere) continue;
        const group = doseKey(PLATE_F, r, c);
        let value: number | null | undefined;
        if (boxParam === "burstCount") {
          value = burstPerWellGrid[r][c];
        } else {
          const sp = specGrid[r][c];
          if (!sp) continue;
          value = boxParam === "offset" ? sp.offset : boxParam === "exponent" ? sp.exponent : boxParam === "peakCf" ? sp.peakCf : sp.peakPower;
        }
        if (value === null || value === undefined || Number.isNaN(value)) continue;
        pts.push({ key: `${r}-${c}`, value, group });
      }
    }
    return pts;
  }, [boxParam, stimFilter, specGrid, burstPerWellGrid]);

  const figs = useOrgFigures("compounds");
  const meta = PARAM_META[boxParam];
  const spectralParam = boxParam !== "burstCount";
  const specPct = Math.round(specProgress * 100);

  return (
    <div className="ogCmp">
      {/* ---------------------------------------------------------- plate ---------------------------------------------------------- */}
      <div className="ogCmpSection">
        <div className="ogRow">
          <span className="ogSynthBadge">illustrative spike trains</span>
          <span className="ogNote">{PLATE_F.compoundsLine}</span>
        </div>

        <div className="ogCmpPlateWrap">
          <div className="ogCmpPlateGrid" role="img" aria-label="Plate F layout, 6 rows by 8 columns">
            <div className="ogCmpPlateCorner" />
            {Array.from({ length: 8 }, (_, c) => (
              <div key={c} className="ogCmpPlateColHead">{c + 1}</div>
            ))}
            {Array.from({ length: 6 }, (_, r) => (
              <div key={r} className="ogCmpPlateRow" style={{ display: "contents" }}>
                <div className="ogCmpPlateRowHead">{String.fromCharCode(65 + r)}</div>
                {Array.from({ length: 8 }, (_, c) => {
                  const key = doseKey(PLATE_F, r, c);
                  const color = groupColor(PLATE_F, key);
                  const stim = PLATE_F.stim[r][c];
                  return (
                    <div
                      key={c}
                      className={"ogCmpCell" + (stim ? " ogCmpCellStim" : "")}
                      style={{ background: color }}
                      title={`${wellLabel(r, c)} — ${key}${stim ? " (stim)" : " (no-stim)"}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="ogCmpLegend">
            {PLATE_F.groups.map((g) => (
              <span key={g.key} className="ogCmpLegendItem">
                <span className="ogCmpSwatch" style={{ background: g.color }} />
                {g.label}
              </span>
            ))}
            <span className="ogCmpLegendItem ogCmpLegendStim">
              <span className="ogCmpSwatch ogCmpSwatchStim" />
              stim row
            </span>
          </div>
        </div>

        <div className="ogRow ogCmpDayRow">
          <span className="ogLabel">Day</span>
          {PLATE_F.days.map((d) => (
            <button key={d} type="button" className="ogBtn" data-active={d === day} onClick={() => setDay(d)}>
              {d < 0 ? `D${d}` : `D${d}`}
            </button>
          ))}
        </div>
      </div>

      {/* --------------------------------------------------------- raster ---------------------------------------------------------- */}
      <div className="ogCmpSection">
        <div className="ogRow">
          <h4 className="ogCmpSubhead">Spike raster — burst &amp; network-event detection</h4>
          <span className="ogMirror">mirrors isi_array → burst_rate → network_events</span>
        </div>

        <RasterCanvas
          rows={rasterRows}
          duration={DURATION}
          playing={playing}
          baseRate={BASE_RATE}
          speed={speed}
          resetToken={day}
          onCursor={setCursorT}
        />

        <div className="ogRow ogCmpRasterControls">
          <button type="button" className="ogBtn" data-active={playing} onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </button>
          <span className="ogLabel">Speed</span>
          {SPEEDS.map((s) => (
            <button key={s} type="button" className="ogBtn" data-active={s === speed} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
          <span className="ogMono ogCmpCursorReadout">t = {cursorT.toFixed(0)} / {DURATION} s</span>
        </div>

        <div className="ogRow ogCmpSliderRow">
          <label className="ogCmpSliderLabel">
            <span className="ogLabel">ISI threshold</span>
            <input
              className="ogSlider"
              type="range"
              min={0.1}
              max={2}
              step={0.05}
              value={isiThresh}
              onChange={(e) => setIsiThresh(Number(e.target.value))}
            />
            <span className="ogMono">{isiThresh.toFixed(2)} s</span>
          </label>
          <label className="ogCmpSliderLabel">
            <span className="ogLabel">Min spikes</span>
            <input
              className="ogSlider"
              type="range"
              min={2}
              max={6}
              step={1}
              value={minSpikes}
              onChange={(e) => setMinSpikes(Number(e.target.value))}
            />
            <span className="ogMono">{minSpikes}</span>
          </label>
        </div>

        <div className="ogRow">
          <span className="ogChip">
            <b className="ogMono">{nBursts}</b> bursts · <b className="ogMono">{nNetworkEvents}</b> network events
          </span>
          <span className="ogNote">
            counts from the exact port (core/bursts.ts); the raster's glow placements are a local re-walk of the same
            runs/windows, cross-checked in dev against those counts.
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------- boxplots --------------------------------------------------------- */}
      <div className="ogCmpSection">
        <div className="ogRow">
          <h4 className="ogCmpSubhead">Dose-response — {meta.label}, D{day < 0 ? day : `+${day}`}</h4>
          <span className="ogMirror">mirrors plot_aperiodic_boxplot / plot_peak_boxplot2 (knee mode)</span>
        </div>

        <div className="ogRow ogCmpParamRow">
          <span className="ogLabel">Parameter</span>
          {(Object.keys(PARAM_META) as BoxParam[]).map((p) => (
            <button key={p} type="button" className="ogBtn" data-active={p === boxParam} onClick={() => setBoxParam(p)}>
              {PARAM_META[p].short}
            </button>
          ))}
          <span className="ogLabel" style={{ marginLeft: 16 }}>Rows</span>
          {(["all", "stim", "nostim"] as StimFilter[]).map((f) => (
            <button key={f} type="button" className="ogBtn" data-active={f === stimFilter} onClick={() => setStimFilter(f)}>
              {f === "all" ? "All" : f === "stim" ? "Stim only" : "No-stim only"}
            </button>
          ))}
        </div>

        {spectralParam && specProgress < 1 && (
          <div className="ogNote ogCmpFitProgress">fitting FOOOF (knee mode) across the plate… {specPct}%</div>
        )}

        <BoxPlot
          points={boxPoints}
          groups={PLATE_F.groups}
          yLabel={`${meta.label}${meta.unit ? ` (${meta.unit})` : ""}`}
          yFormat={meta.format}
        />
      </div>

      {/* --------------------------------------------------------- figures --------------------------------------------------------- */}
      <div className="ogCmpSection">
        <h4 className="ogCmpSubhead">From the notebooks</h4>
        <div className="ogFigStrip">
          {figs.map((f) => (
            <figure key={f.file}>
              <img src={figureUrl(f)} alt={f.caption} width={f.w} height={f.h} loading="lazy" />
              <figcaption>
                <span className="ogFigReal">real figure</span> {f.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
