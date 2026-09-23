"use client";

/**
 * lane_guidance_node's console, the way `ros2 launch` prints a node with
 * output='screen'. The startup block is __init__'s own logging (probe, subscriptions,
 * the parameter dump); everything after it is PathPlanner.logs as the run produces it.
 * Scrolling only ever moves this box, never the page.
 */
import { memo, useLayoutEffect, useRef } from "react";
import type { LogLine } from "../core/control";
import type { PathPlanner } from "../core/control";

const PREFIX = "[lane_guidance_node-3]";

/** simulated time, not a wall clock: this is the page's run, not a recorded log */
function stamp(t: number) {
  return `t=${t.toFixed(2)}`;
}

/** the multi-line parameter dump __init__ logs after the subscriptions */
function initLines(p: PathPlanner): string[] {
  const g = p.p;
  return [
    `Subscribed to topic: ${p.topic}`,
    `Subscribed to width topic: /object_detections/depth`,
    "",
    `Kp_steering: ${g.Kp_steering}`,
    `Ki_steering: ${g.Ki_steering}`,
    `Kd_steering: ${g.Kd_steering}`,
    `error_threshold: ${g.error_threshold}`,
    `zero_throttle: ${g.zero_throttle}`,
    `max_throttle: ${g.max_throttle}`,
    `min_throttle: ${g.min_throttle}`,
    `max_right_steering: ${g.max_right_steering}`,
    `max_left_steering: ${g.max_left_steering}`,
    `width_threshold: ${g.width_threshold}`,
    `sweep_duration: ${g.sweep_duration}`,
    `final_forward_distance: ${g.final_forward_distance}`,
    `turn_duration: ${p.turnDuration.toFixed(2)}s`,
    `forward_duration: ${p.forwardDuration.toFixed(2)}s`,
    `reverse_duration: ${p.reverseDuration.toFixed(2)}s`,
    `final_forward_duration: ${p.finalForwardDuration.toFixed(2)}s`,
  ];
}

function pyFloat(v: number) {
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
}

interface Row {
  key: string;
  level: "INFO" | "WARN" | "";
  text: string;
}

function build(planner: PathPlanner, logs: LogLine[]): Row[] {
  const rows: Row[] = [];
  const head = (l: LogLine, i: number, text = l.msg) =>
    rows.push({ key: `l${i}`, level: l.level, text: `${PREFIX} [${l.level}] [${stamp(l.t)}] [lane_guidance_node]: ${text}` });
  // the probe lines come first, then the subscriptions and the parameter dump
  let i = 0;
  while (i < logs.length && logs[i].t === 0 && !logs[i].msg.startsWith("Object width")) {
    head(logs[i], i);
    i++;
  }
  const init = initLines(planner).map((s) => s.replace(/: (-?\d+)$/, (_, n) => `: ${pyFloat(Number(n))}`));
  const t0: LogLine = { t: 0, level: "INFO", msg: "" };
  head(t0, -1, init[0]);
  head(t0, -2, init[1]);
  head(t0, -3, "");
  for (let j = 3; j < init.length; j++) rows.push({ key: `p${j}`, level: "", text: init[j] });
  for (; i < logs.length; i++) head(logs[i], i);
  return rows;
}

function LogTerminalInner({ planner, count }: { planner: PathPlanner; count: number }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);
  const rows = build(planner, planner.logs);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight; // this box only
  }, [count, planner]);

  return (
    <div className="acMiTerm acScreen">
      <div className="acMiTermBar">
        <span className="acMiTermDots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="acMono">lane_guidance_node · output=&apos;screen&apos; · this page&apos;s simulated run, sim time in s</span>
      </div>
      <div
        className="acMiTermBody acMono"
        ref={boxRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        tabIndex={0}
        aria-label="guidance node log"
      >
        {rows.map((r) => (
          <div key={r.key} className={r.level === "WARN" ? "acMiTermWarn" : undefined}>
            {r.text || " "}
          </div>
        ))}
      </div>
    </div>
  );
}

/** re-renders only when a line was added */
const LogTerminal = memo(LogTerminalInner, (a, b) => a.planner === b.planner && a.count === b.count);
export default LogTerminal;
