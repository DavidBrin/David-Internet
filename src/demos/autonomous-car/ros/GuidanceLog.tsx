"use client";

/** lane_guidance_node's log, the way `ros2 launch` prints it. */
import { useLayoutEffect, useRef } from "react";
import { logTime, type RosRuntime } from "./runtime";

export default function GuidanceLog({ rt, version }: { rt: RosRuntime | null; version: number }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [version, rt]);

  useLayoutEffect(() => {
    stick.current = true;
  }, [rt]);

  const lines = rt?.term ?? [];
  return (
    <div className="acScreen acRoLog">
      <div className="acRoTermBar">
        <span className="acRoTermDots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="acMono">ros2 launch output, lane_guidance_node</span>
        <span className="acRoTermHint">this page&apos;s simulated run, sim time in s</span>
      </div>
      <div
        className="acRoLogBody acMono"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 28;
        }}
      >
        {lines.map((l, i) => (
          <div key={i} className="acRoLogLine" data-level={l.level}>
            <span className="acRoLogProc">[lane_guidance_node-3] </span>
            <span className="acRoLogLevel">[{l.level}]</span> <span className="acRoLogTime">[{logTime(l.t)}]</span>
            <span className="acRoLogProc"> [lane_guidance_node]</span>: {l.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
