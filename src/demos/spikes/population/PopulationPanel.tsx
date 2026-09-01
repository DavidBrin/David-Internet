"use client";

/**
 * Population — the cross-subject feature table (~2,700 fitted spikes from 10 marmosets) as a
 * brushable scatter. Brushing pulls up the matching real waveforms, and feeds the group
 * boxplots / correlation heatmap below (which fall back to the whole table when nothing is
 * brushed).
 */
import { useCallback, useMemo, useState } from "react";
import { useSpikesData } from "../store";
import { FEATURE_COLUMNS, type FeatureColumn, type FeatureRow, type SubjectMeta } from "../core/data";
import Scatter from "./Scatter";
import WaveformOverlay from "./WaveformOverlay";
import GroupBoxplots from "./GroupBoxplots";
import CorrelationHeatmap from "./CorrelationHeatmap";
import { CATEGORICAL_PALETTE } from "./stats";
import "./population.css";

type ColorByKey = "subject" | "sex" | "age" | "file";
type Mode = "boxplots" | "correlation";

const COLOR_BY_OPTIONS: { key: ColorByKey; label: string }[] = [
  { key: "subject", label: "subject" },
  { key: "sex", label: "sex" },
  { key: "age", label: "age" },
  { key: "file", label: "file" },
];

export default function PopulationPanel() {
  const { data, status } = useSpikesData();

  const [xCol, setXCol] = useState<FeatureColumn>("peak_width");
  const [yCol, setYCol] = useState<FeatureColumn>("exp_lambda");
  const [colorBy, setColorBy] = useState<ColorByKey>("subject");
  const [brushed, setBrushed] = useState<Set<number> | null>(null);
  const [mode, setMode] = useState<Mode>("boxplots");

  const rows: FeatureRow[] = data?.features.rows ?? [];

  const subjectMeta = useMemo(() => {
    const m = new Map<string, SubjectMeta>();
    for (const f of data?.meta.files ?? []) m.set(f.subject, f);
    return m;
  }, [data]);

  const groupOf = useCallback(
    (row: FeatureRow): string => {
      if (colorBy === "subject") return row.subject;
      if (colorBy === "file") return row.file;
      const m = subjectMeta.get(row.subject);
      if (colorBy === "sex") return m?.sex || "unknown";
      return m?.age || "unknown";
    },
    [colorBy, subjectMeta],
  );

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(groupOf(r));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rows, groupOf]);

  const groupColor = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g, i) => m.set(g, CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]));
    return m;
  }, [groups]);

  const selectedRows = useMemo(() => {
    if (!brushed) return rows;
    const out: FeatureRow[] = [];
    for (const idx of brushed) {
      const r = rows[idx];
      if (r) out.push(r);
    }
    return out;
  }, [brushed, rows]);

  const plottedCount = useMemo(() => {
    let n = 0;
    for (const r of rows) {
      const xv = r[xCol];
      const yv = r[yCol];
      if (xv != null && isFinite(xv) && yv != null && isFinite(yv)) n++;
    }
    return n;
  }, [rows, xCol, yCol]);

  if (status === "loading" || !data) {
    return <div className="skLoading">Loading population table ({status})…</div>;
  }
  if (status === "error") {
    return <div className="skLoading">Couldn&rsquo;t load the population data.</div>;
  }

  return (
    <div className="skPopRoot">
      <div className="skPopTop">
        <div className="skPopScatterCol">
          <div className="skRow skPopControls">
            <label className="skPopField">
              <span className="skLabel">X axis</span>
              <select className="skPopSelect" value={xCol} onChange={(e) => setXCol(e.target.value as FeatureColumn)}>
                {FEATURE_COLUMNS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="skPopField">
              <span className="skLabel">Y axis</span>
              <select className="skPopSelect" value={yCol} onChange={(e) => setYCol(e.target.value as FeatureColumn)}>
                {FEATURE_COLUMNS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="skPopField">
              <span className="skLabel">Color by</span>
              <select className="skPopSelect" value={colorBy} onChange={(e) => setColorBy(e.target.value as ColorByKey)}>
                {COLOR_BY_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="skBtn" onClick={() => setBrushed(null)} disabled={!brushed}>
              Clear brush
            </button>
          </div>

          <div className="skPopLegend">
            {groups.map((g) => (
              <span key={g} className="skChip skPopLegendChip">
                <span className="skPopSwatch" style={{ background: groupColor.get(g) }} />
                {g}
              </span>
            ))}
          </div>

          <Scatter rows={rows} xCol={xCol} yCol={yCol} groupOf={groupOf} groupColor={groupColor} brushed={brushed} onBrushChange={setBrushed} />

          <p className="skNote">
            {plottedCount} of {rows.length} spikes plotted (rows missing {xCol} or {yCol} are dropped) ·{" "}
            {brushed ? <span className="skMono">{brushed.size} brushed</span> : "drag a rectangle to brush — everything below is scoped to the brush"}
          </p>
        </div>

        <div className="skPopWaveCol">
          <div className="skRow skPopWaveHead">
            <span className="skLabel">Real waveforms</span>
            <span className="skBadge">{selectedRows.length} selected</span>
            <span className="skBadge">{selectedRows.filter((r) => r.wf != null).length} with waveform</span>
          </div>
          <WaveformOverlay rows={selectedRows} waveforms={data.waveforms} />
        </div>
      </div>

      <div className="skPopBottom">
        <div className="skRow skPopModeRow">
          <button type="button" className="skBtn" data-active={mode === "boxplots"} onClick={() => setMode("boxplots")}>
            Boxplots
          </button>
          <button type="button" className="skBtn" data-active={mode === "correlation"} onClick={() => setMode("correlation")}>
            Correlation
          </button>
          {mode === "boxplots" ? (
            <>
              <span className="skChip">mirrors boxplots_by_Param</span>
              <span className="skNote skPopBoxNote">
                feature: <span className="skMono">{yCol}</span> (the Y axis) · grouped by <span className="skMono">{colorBy}</span>
              </span>
            </>
          ) : (
            <span className="skChip">mirrors plot_correlation_heatmaps</span>
          )}
        </div>

        {mode === "boxplots" ? (
          <GroupBoxplots rows={rows} feature={yCol} groups={groups} groupOf={groupOf} groupColor={groupColor} brushed={brushed} />
        ) : (
          <CorrelationHeatmap rows={selectedRows} />
        )}
      </div>

      <div className="skPopFigures">
        <span className="skLabel">Real figures — 2024 analysis</span>
        <div className="skFigStrip">
          {data.figures.map((fig) => (
            <figure key={fig.file}>
              <img src={`/demos/spikes/${fig.file}`} alt={fig.caption} width={fig.w} height={fig.h} loading="lazy" />
              <figcaption>
                {fig.caption} <span className="skPopRealTag">real figure · 2024 analysis</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="skNote">
          The 2024 figures include macaque groups (Macaca, LIP) from a pre-release of the dataset; the live table above is rebuilt from
          the current all-marmoset public release (DANDI:001776).
        </p>
      </div>
    </div>
  );
}
