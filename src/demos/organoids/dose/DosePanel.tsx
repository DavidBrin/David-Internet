"use client";

/**
 * Chapter 3 — "Dose and time" (Plate D, 5-MeO-DMT). The plate gains a dose
 * overlay + day slider (PlateView) and a windowed Welch/FOOOF sub-panel
 * (WindowedAnalysis), then a strip of the real per-day-notebook figures.
 */
import { useState } from "react";
import { PLATE_D } from "../core/plate";
import { useOrgFigures, figureUrl } from "../figures";
import PlateView from "./PlateView";
import WindowedAnalysis from "./WindowedAnalysis";
import "./dose.css";

function dayLabel(d: number): string {
  return d === -1 ? "D-1 (baseline)" : `D${d}`;
}

export default function DosePanel() {
  const [day, setDay] = useState<number>(PLATE_D.days[0]);
  const figs = useOrgFigures("dose");

  return (
    <div className="ogDose">
      <div className="ogDoseLegendRow ogRow">
        <span className="ogLabel">Dose groups</span>
        {PLATE_D.groups.map((g) => (
          <span key={g.key} className="ogDoseLegendItem">
            <span className="ogDoseSwatch" style={{ background: g.color }} />
            {g.label}
          </span>
        ))}
        <span className="ogSynthBadge">illustrative data — dose/day trends are parameterized for the demo</span>
      </div>

      <div className="ogRow">
        <span className="ogLabel">Day</span>
        <div className="ogDoseDayChips">
          {PLATE_D.days.map((d) => (
            <button
              key={d}
              type="button"
              className="ogBtn ogDoseDayChip"
              data-active={d === day}
              onClick={() => setDay(d)}
            >
              {d === -1 ? "D-1" : `D${d}`}
            </button>
          ))}
        </div>
        <span className="ogNote">{dayLabel(day)}</span>
      </div>

      <PlateView day={day} />

      <WindowedAnalysis day={day} />

      <div className="ogDoseFigures">
        <span className="ogLabel">Real figures — Plate D notebooks</span>
        <div className="ogFigStrip">
          {figs.map((f) => (
            <figure key={f.file}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={figureUrl(f)} alt={f.caption} loading="lazy" />
              <figcaption>
                <span className="ogFigReal">real figure</span> {f.caption}
                <div className="ogMono ogDoseFigSource">{f.source}</div>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="ogNote">
          one well, one day, one notebook &mdash; the per-day notebooks reached 39 MB each; these figures
          are pulled from them.
        </p>
      </div>
    </div>
  );
}
