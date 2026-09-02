"use client";

import { useState } from "react";
import type { BinaryModel } from "./types";

/** X-axis lower bound. All 8 models score above this, so the truncation is
 * called out explicitly in the UI rather than left implicit. */
const AXIS_MIN = 65;

interface BarsChartProps {
  binary: BinaryModel[];
  mcnnMembers: Record<string, number[]>;
}

function axisMaxFor(binary: BinaryModel[]): number {
  const maxAcc = binary.reduce((m, b) => Math.max(m, b.acc), 0);
  return Math.max(80, Math.ceil(maxAcc / 5) * 5);
}

/** Percent-of-track position (0..100) for a value under the current axis domain. */
function pct(v: number, axisMax: number): number {
  return Math.max(0, ((v - AXIS_MIN) / (axisMax - AXIS_MIN)) * 100);
}

export default function BarsChart({ binary, mcnnMembers }: BarsChartProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const axisMax = axisMaxFor(binary);
  const ticks: number[] = [];
  for (let t = AXIS_MIN; t <= axisMax; t += 5) ticks.push(t);

  function toggle(model: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  }

  return (
    <div className="pR-bars">
      <p className="pR-axisNote">Axis starts at {AXIS_MIN}%; no model here scores below it.</p>

      <div className="pR-axisRow" aria-hidden="true">
        <div className="pR-labelCol" />
        <div className="pR-trackCol pR-axisTrack">
          {ticks.map((t) => (
            <span key={t} className="pR-tick" style={{ left: `${pct(t, axisMax)}%` }}>
              {t}%
            </span>
          ))}
        </div>
        <div className="pR-valueCol" />
      </div>

      {binary.map((m) => {
        const members = mcnnMembers[m.model];
        const isMcnn = members !== undefined;
        const isOpen = isMcnn && expanded.has(m.model);
        const beat = members ? members.filter((v) => v < m.acc).length : 0;

        return (
          <div key={m.model} className="pR-barGroup">
            <div
              className={`pR-row${isMcnn ? " pR-rowClickable" : ""}`}
              onClick={isMcnn ? () => toggle(m.model) : undefined}
              role={isMcnn ? "button" : undefined}
              tabIndex={isMcnn ? 0 : undefined}
              aria-expanded={isMcnn ? isOpen : undefined}
              onKeyDown={
                isMcnn
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(m.model);
                      }
                    }
                  : undefined
              }
            >
              <div className="pR-labelCol">
                <span className="pR-modelName">
                  {m.model}
                  {isMcnn && <span className="pR-caret">{isOpen ? "▾" : "▸"}</span>}
                </span>
                <span className="ppChip">{m.channels}</span>
              </div>
              <div
                className="pR-trackCol"
                title={m.desc}
                aria-label={`${m.model}: ${m.acc.toFixed(2)} percent weighted accuracy, ${m.channels}. ${m.desc}`}
              >
                <svg className="pR-barSvg" viewBox="0 0 100 26" preserveAspectRatio="none" role="presentation">
                  <rect className="pR-track" x={0} y={3} width={100} height={20} rx={4} />
                  <rect
                    className={`pR-fill${isMcnn ? " pR-fillMcnn" : ""}`}
                    x={0}
                    y={3}
                    width={pct(m.acc, axisMax)}
                    height={20}
                    rx={4}
                  />
                </svg>
              </div>
              <span className="pR-value ppMono">{m.acc.toFixed(1)}%</span>
            </div>

            {isMcnn && isOpen && members && (
              <div className="pR-subBars">
                {members.map((v, i) => (
                  <div className="pR-subRow" key={i}>
                    <div className="pR-labelCol">
                      <span className="pR-subLabel">member {i + 1}</span>
                    </div>
                    <div className="pR-trackCol">
                      <svg className="pR-barSvg pR-subSvg" viewBox="0 0 100 14" preserveAspectRatio="none" role="presentation">
                        <rect className="pR-track" x={0} y={2} width={100} height={10} rx={3} />
                        <rect className="pR-fillSub" x={0} y={2} width={pct(v, axisMax)} height={10} rx={3} />
                      </svg>
                    </div>
                    <span className="pR-subValue ppMono">{v.toFixed(1)}%</span>
                  </div>
                ))}
                <p className="pR-subCaption">
                  {m.model} ({m.acc.toFixed(1)}%){" "}
                  {beat === members.length
                    ? `beats all ${members.length} members it averages together`
                    : `beats ${beat} of the ${members.length} members it averages together`}{" "}
                  (the point of ensembling).
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
