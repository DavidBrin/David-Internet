"use client";

/**
 * /object_detections/depth: despite the name, camera_driver2 publishes the widest
 * bounding box in pixels there (calculate_representative_width), and the guidance node
 * compares it with width_threshold = 200 px.
 */
import { GUIDANCE_PARAMS } from "../core/params";
import { CAMERA } from "../core/camera";
import type { MissionRun } from "./run";

const WINDOW = 14; // seconds of history
const SW = 320,
  SH = 96,
  TOP = 8,
  BOT = 16;
const MAXW = CAMERA.W;

export default function WidthGauge({ run }: { run: MissionRun }) {
  const now = run.sim.t;
  const det = run.sim.lastDetect;
  const w = det?.width ?? null;
  const thr = GUIDANCE_PARAMS.width_threshold;
  const pct = (v: number) => `${(Math.min(MAXW, v) / MAXW) * 100}%`;
  const over = w !== null && w > thr;

  const t0 = Math.max(0, now - WINDOW);
  const X = (t: number) => ((t - t0) / WINDOW) * SW;
  const Y = (v: number) => TOP + (1 - Math.min(MAXW, v) / MAXW) * (SH - TOP - BOT);
  // polyline segments, broken where nothing was detected
  const segs: string[] = [];
  let cur: string[] = [];
  for (const s of run.widths) {
    if (s.t < t0 - 0.2) continue;
    if (s.w === null) {
      if (cur.length > 1) segs.push(cur.join(" "));
      cur = [];
    } else cur.push(`${X(s.t).toFixed(1)},${Y(s.w).toFixed(1)}`);
  }
  if (cur.length > 1) segs.push(cur.join(" "));
  const cross = run.crossings.filter((c) => c.t >= t0 - 0.2);
  const last = run.crossings[run.crossings.length - 1];

  return (
    <div className="acMiGauge">
      <div className="acMiGaugeHead">
        <span className="acMiLabel">/object_detections/depth</span>
        <span className={`acMiGaugeVal acMono${over ? " acMiGaugeOver" : ""}`}>
          {w === null ? "no message" : `${w.toFixed(1)} px`}
        </span>
      </div>
      <div className="acMiGaugeBar" aria-hidden="true">
        <div className={`acMiGaugeFill${over ? " acMiGaugeFillOver" : ""}`} style={{ width: w === null ? 0 : pct(w) }} />
        <div className="acMiGaugeThr" style={{ left: pct(thr) }}>
          <span className="acMono">200 px</span>
        </div>
      </div>
      <div className="acMiGaugeScale acMono" aria-hidden="true">
        <span>0</span>
        <span>640 px (frame width)</span>
      </div>
      <svg viewBox={`0 0 ${SW} ${SH}`} className="acMiGaugeChart" role="img" aria-label="box width over the last 14 seconds">
        <line x1={0} x2={SW} y1={Y(thr)} y2={Y(thr)} className="acMiGaugeChartThr" />
        {segs.map((p, i) => (
          <polyline key={i} points={p} className="acMiGaugeLine" />
        ))}
        {cross.map((c) => (
          <g key={c.t}>
            <line x1={X(c.t)} x2={X(c.t)} y1={TOP} y2={SH - BOT} className="acMiGaugeCross" />
            <circle cx={X(c.t)} cy={Y(c.w)} r={3.5} className="acMiGaugeCrossDot" />
          </g>
        ))}
        <text x={2} y={SH - 3} className="acMiGaugeAxis">
          −{WINDOW} s
        </text>
        <text x={SW - 2} y={SH - 3} textAnchor="end" className="acMiGaugeAxis">
          now
        </text>
      </svg>
      <div className="acMiGaugeNote">
        {last ? (
          <>
            Threshold crossed at <b className="acMono">t = {last.t.toFixed(1)} s</b> with{" "}
            <b className="acMono">{last.w.toFixed(1)} px</b> (WARN in the log, red mark above).
          </>
        ) : (
          <>Published only when something is detected; the stop fires on the first value above 200 px.</>
        )}
      </div>
    </div>
  );
}
