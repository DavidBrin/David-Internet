"use client";

/**
 * State machine panel — the Uno firmware's SecurityState enum as a live diagram,
 * the confirmation counter + distance gauge that drive it, the tuning sliders,
 * and the armed gate. Reads sim/core.ts fields via useSimTick(); writes only
 * through useSimHandle().actions.setConfig (no local sim mutation).
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSimHandle, useSimTick } from "../sim/store";
import { SecurityState, STATE_NAMES } from "../sim/core";
import "./state.css";

const EDGE_TO_ALERT_D = "M122,50 Q180,16 238,50";
const EDGE_TO_NORMAL_D = "M238,70 Q180,104 122,70";

const TRACE_LEN = 60;
const TRACE_DOMAIN_CM = 100; // door-closed reading tops out ~85 cm

type PulseDir = "toAlert" | "toNormal";

function firmwareDefaults(iteration: 1 | 2 | 3) {
  return { thresholdCm: iteration === 3 ? 11 : 12, confirmationCount: 3, sensorIntervalMs: 500 };
}

function offsetPathStyle(d: string): CSSProperties {
  return { offsetPath: `path('${d}')` } as CSSProperties;
}

export default function StatePanel() {
  const sim = useSimTick();
  const { actions } = useSimHandle();

  // --- transition pulse: watch state changes across renders ---
  const prevState = useRef(sim.state);
  const pulseSeq = useRef(0);
  const [pulse, setPulse] = useState<{ key: number; dir: PulseDir } | null>(null);

  useEffect(() => {
    if (sim.state !== prevState.current) {
      const dir: PulseDir | null =
        sim.state === SecurityState.ALERT ? "toAlert" : sim.state === SecurityState.NORMAL ? "toNormal" : null;
      if (dir) {
        pulseSeq.current += 1;
        setPulse({ key: pulseSeq.current, dir });
      }
      prevState.current = sim.state;
    }
  }, [sim.state, sim.alertCount]);

  // --- sensor-reading trace (one point per actual sensor read, not per tick) ---
  const traceRef = useRef<number[]>([]);
  const lastSensorReadSeen = useRef(-1);
  useEffect(() => {
    if (sim.lastSensorRead !== lastSensorReadSeen.current) {
      lastSensorReadSeen.current = sim.lastSensorRead;
      const next = [...traceRef.current, sim.lastRawDistance];
      traceRef.current = next.length > TRACE_LEN ? next.slice(next.length - TRACE_LEN) : next;
    }
  }, [sim.lastSensorRead, sim.lastRawDistance]);

  const handleReset = () => {
    actions.setConfig(firmwareDefaults(sim.iteration));
  };

  const filledSlots = Math.min(sim.consecutiveReadings, sim.cfg.confirmationCount);
  const gaugePct = (v: number) => Math.max(0, Math.min(100, (v / TRACE_DOMAIN_CM) * 100));
  const belowThreshold = sim.currentDistance < sim.cfg.thresholdCm;

  const trace = traceRef.current;
  const tracePoints = trace
    .map((v, i) => {
      const x = trace.length > 1 ? (i / (trace.length - 1)) * 300 : 300;
      const y = 58 - gaugePct(v) * 0.58;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const thresholdY = (58 - gaugePct(sim.cfg.thresholdCm) * 0.58).toFixed(1);

  return (
    <div className="hhStatePanel">
      <div className="hhStateTop">
        <div className="hhStateDiagramWrap hhCanvasWrap">
          <svg viewBox="0 0 360 200" className="hhStateDiagram" role="img" aria-label="security state machine">
            <defs>
              <filter id="hhStateGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <marker id="hhStateArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
              </marker>
            </defs>

            <path d={EDGE_TO_ALERT_D} className="hhStateEdge" markerEnd="url(#hhStateArrow)" />
            <path d={EDGE_TO_NORMAL_D} className="hhStateEdge" markerEnd="url(#hhStateArrow)" />

            {pulse && (
              <circle
                key={pulse.key}
                r="5"
                className="hhStatePulse"
                style={offsetPathStyle(pulse.dir === "toAlert" ? EDGE_TO_ALERT_D : EDGE_TO_NORMAL_D)}
                onAnimationEnd={() => setPulse(null)}
              />
            )}

            {/* LOCKDOWN / ERROR — real enum values, never entered by the shipped firmware */}
            <circle cx="90" cy="160" r="24" className="hhStateNodeGhost" />
            <text x="90" y="164" textAnchor="middle" className="hhStateNodeLabel hhStateNodeLabelGhost">
              {STATE_NAMES[SecurityState.LOCKDOWN]}
            </text>
            <circle cx="270" cy="160" r="24" className="hhStateNodeGhost" />
            <text x="270" y="164" textAnchor="middle" className="hhStateNodeLabel hhStateNodeLabelGhost">
              {STATE_NAMES[SecurityState.ERROR]}
            </text>

            {/* NORMAL / ALERT — the two states the firmware actually uses */}
            <circle
              cx="90"
              cy="60"
              r="32"
              className={`hhStateNode hhStateNodeNormal${sim.state === SecurityState.NORMAL ? " hhStateNodeActive" : ""}`}
              filter={sim.state === SecurityState.NORMAL ? "url(#hhStateGlow)" : undefined}
            />
            <text x="90" y="65" textAnchor="middle" className="hhStateNodeLabel">
              {STATE_NAMES[SecurityState.NORMAL]}
            </text>

            <circle
              cx="270"
              cy="60"
              r="32"
              className={`hhStateNode hhStateNodeAlert${sim.state === SecurityState.ALERT ? " hhStateNodeActive" : ""}`}
              filter={sim.state === SecurityState.ALERT ? "url(#hhStateGlow)" : undefined}
            />
            <text x="270" y="65" textAnchor="middle" className="hhStateNodeLabel">
              {STATE_NAMES[SecurityState.ALERT]}
            </text>
          </svg>
          <p className="hhNote hhStateGhostCaption">
            LOCKDOWN and ERROR are defined in the firmware enum, never entered by the shipped code.
          </p>
        </div>

        <div className="hhStateSide">
          <div className="hhStateBlock">
            <div className="hhLabel">consecutive readings under threshold</div>
            <div className="hhStateSlots">
              {Array.from({ length: sim.cfg.confirmationCount }).map((_, i) => (
                <div key={i} className={`hhStateSlot${i < filledSlots ? " hhStateSlotFilled" : ""}`} />
              ))}
            </div>
          </div>

          <div className="hhStateBlock">
            <div className="hhLabel">distance vs threshold</div>
            <div className="hhStateGauge">
              <div
                className={`hhStateGaugeFill${belowThreshold ? " hhStateGaugeFillAlert" : ""}`}
                style={{ width: `${gaugePct(sim.currentDistance)}%` }}
              />
              <div className="hhStateGaugeThreshold" style={{ left: `${gaugePct(sim.cfg.thresholdCm)}%` }} />
            </div>
            <div className="hhMono hhStateGaugeReadout">
              {sim.currentDistance.toFixed(1)} cm
              <span className="hhStateGaugeThresholdLabel"> · threshold {sim.cfg.thresholdCm.toFixed(0)} cm</span>
            </div>
          </div>

          <div className="hhStateBlock hhStateLampRow">
            <span className={`hhStateLamp${sim.motionDetected ? " hhStateLampOn" : ""}`} aria-hidden="true" />
            <span className="hhMono">VCNL4040 motion{sim.motionDetected ? " — YES" : ""}</span>
          </div>

          <div className="hhStateBlock hhStateArmedStrip">
            <span className={`hhStateArmedBadge${sim.armed ? " hhStateArmedOn" : " hhStateArmedOff"}`}>
              {sim.armed ? "ARMED" : "DISARMED"}
            </span>
            {sim.suppressedAlert && (
              <span className="hhMono hhStateSuppressed">
                intrusion detected — alarm suppressed (system disarmed)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="hhStateControls">
        <div className="hhRow">
          <label className="hhSlider">
            threshold
            <input
              type="range"
              min={4}
              max={30}
              step={1}
              value={sim.cfg.thresholdCm}
              onChange={(e) => actions.setConfig({ thresholdCm: Number(e.target.value) })}
            />
            <span className="hhMono">{sim.cfg.thresholdCm.toFixed(0)} cm</span>
          </label>
          <label className="hhSlider">
            confirmation count
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={sim.cfg.confirmationCount}
              onChange={(e) => actions.setConfig({ confirmationCount: Number(e.target.value) })}
            />
            <span className="hhMono">{sim.cfg.confirmationCount}</span>
          </label>
          <label className="hhSlider">
            sensor interval
            <input
              type="range"
              min={100}
              max={1000}
              step={50}
              value={sim.cfg.sensorIntervalMs}
              onChange={(e) => actions.setConfig({ sensorIntervalMs: Number(e.target.value) })}
            />
            <span className="hhMono">{sim.cfg.sensorIntervalMs} ms</span>
          </label>
          <button type="button" className="hhBtn" onClick={handleReset}>
            Reset to firmware defaults
          </button>
        </div>
        <p className="hhNote">
          3 readings × 500 ms ≈ 1.5 s to confirm — slower to alarm, but a single hand-wave can&apos;t trip it.
          {sim.iteration === 3 && " Iteration ③ retuned the threshold to 11 cm."}
        </p>
      </div>

      <div className="hhStateTrace hhCanvasWrap">
        <div className="hhLabel">last {trace.length || "~60"} sensor readings</div>
        <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="hhStateTraceSvg">
          <line x1="0" x2="300" y1={thresholdY} y2={thresholdY} className="hhStateTraceThreshold" />
          {trace.length > 1 && <polyline points={tracePoints} className="hhStateTraceLine" />}
        </svg>
      </div>
    </div>
  );
}
