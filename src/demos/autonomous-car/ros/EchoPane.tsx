"use client";

/** `ros2 topic echo`-style pane: latest value per topic, and the last 12 messages of one. */
import { useLayoutEffect, useRef } from "react";
import { TOPICS, simStamp, type Held, type RosRuntime, type TopicName } from "./runtime";
import { TOPIC_TYPE } from "./rosData";

function num(s: string): number | null {
  const m = /data:\s*(-?[\d.]+)/.exec(s);
  return m ? Number(m[1]) : null;
}

function twist(s: string): [number, number] | null {
  const m = /linear\.x:\s*(-?[\d.]+)\s+angular\.z:\s*(-?[\d.]+)/.exec(s);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function image(s: string): { w: number; h: number; seq: number } | null {
  const m = /(\d+)x(\d+)\s+bgr8\s+#(\d+)/.exec(s);
  return m ? { w: Number(m[1]), h: Number(m[2]), seq: Number(m[3]) } : null;
}

/** one-line summary for the topic list */
export function summary(topic: string, v: string): string {
  if (topic === "/object_detections/image") {
    const im = image(v);
    return im ? `${im.w}x${im.h} bgr8, frame ${im.seq}` : v;
  }
  if (topic === "/cmd_vel") {
    const tw = twist(v);
    return tw ? `linear.x ${tw[0].toFixed(3)}  angular.z ${tw[1].toFixed(3)}` : v;
  }
  if (topic === "/object_detections/flag") return v;
  const n = num(v);
  if (n === null) return v;
  return topic === "/object_detections/depth" ? `data: ${n.toFixed(1)}` : `data: ${n.toFixed(4)}`;
}

/** full ros2 topic echo rendering of one message */
function echo(topic: string, m: Held): string {
  if (topic === "/object_detections/image") {
    const im = image(m.value) ?? { w: 640, h: 480, seq: 0 };
    const { sec, nanosec } = simStamp(m.t);
    return [
      "header:",
      "  stamp:",
      `    sec: ${sec}`,
      `    nanosec: ${nanosec}`,
      "  frame_id: oakd_camera_frame",
      `height: ${im.h}`,
      `width: ${im.w}`,
      "encoding: bgr8",
      "is_bigendian: 0",
      `step: ${im.w * 3}`,
      `data: '<sequence type: uint8, length: ${im.w * im.h * 3}>'`,
      "---",
    ].join("\n");
  }
  if (topic === "/cmd_vel") {
    const tw = twist(m.value) ?? [0, 0];
    return ["linear:", `  x: ${pyf(tw[0])}`, "  y: 0.0", "  z: 0.0", "angular:", "  x: 0.0", "  y: 0.0", `  z: ${pyf(tw[1])}`, "---"].join("\n");
  }
  if (topic === "/object_detections/flag") return `${m.value}\n---`;
  const n = num(m.value);
  return `data: ${n === null ? m.value : pyf(n)}\n---`;
}

/** float the way ros2 topic echo prints it: always a decimal point */
function pyf(v: number): string {
  if (Number.isInteger(v)) return v.toFixed(1);
  return String(Number(v.toPrecision(7)));
}

function age(dt: number): string {
  if (dt < 0.05) return "now";
  return `${dt.toFixed(1)} s ago`;
}

interface Props {
  rt: RosRuntime | null;
  focused: TopicName;
  onFocus(t: TopicName): void;
}

export default function EchoPane({ rt, focused, onFocus }: Props) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);
  const hist = rt?.hist.get(focused) ?? [];
  const last = hist[hist.length - 1];
  const key = `${focused}:${last?.t ?? -1}`;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [key]);

  useLayoutEffect(() => {
    stick.current = true;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [focused]);

  const t = rt?.sim.t ?? 0;
  const absent = (topic: string) => rt?.mode === "a" && topic.startsWith("/object_detections/") && topic !== "/object_detections/image";

  return (
    <div className="acScreen acRoEcho">
      <div className="acRoTermBar">
        <span className="acRoTermDots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="acMono">ros2 topic echo</span>
        <span className="acRoTermHint">click a topic</span>
      </div>
      <div className="acRoEchoList" role="list">
        {TOPICS.map((topic) => {
          const h = rt?.hist.get(topic);
          const m = h?.[h.length - 1];
          const hz = rt?.hz(topic) ?? null;
          const subs = rt ? subCount(rt, topic) : 0;
          return (
            <button
              key={topic}
              type="button"
              role="listitem"
              className="acRoEchoRow"
              data-focus={focused === topic}
              data-absent={absent(topic)}
              onClick={() => onFocus(topic)}
            >
              <span className="acRoEchoName acMono">{topic}</span>
              <span className="acRoEchoMeta acMono">
                {absent(topic) ? (
                  "not advertised"
                ) : (
                  <>
                    {hz === null ? "silent" : `${hz.toFixed(1)} Hz`}
                    <span className="acRoEchoPub">  pub 1</span>
                    {`  sub ${subs}`}
                  </>
                )}
              </span>
              <span className="acRoEchoVal acMono">{m ? summary(topic, m.value) : absent(topic) ? "" : "(no messages yet)"}</span>
              <span className="acRoEchoAge acMono">{m ? age(t - m.t) : ""}</span>
            </button>
          );
        })}
      </div>
      <div className="acRoEchoFocusHead acMono">
        <span className="acRoPrompt">$</span> ros2 topic echo {focused}
        {focused === "/object_detections/image" ? " --no-arr" : ""}
        <span className="acRoEchoType">{TOPIC_TYPE[focused]}</span>
      </div>
      <div
        className="acRoEchoStream acMono"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 28;
        }}
      >
        {hist.length === 0 ? (
          <div className="acRoMuted">
            {absent(focused)
              ? `WARNING: topic [${focused}] does not appear to be published yet`
              : "waiting for the first message..."}
          </div>
        ) : (
          hist.map((m, i) => (
            <pre key={`${m.t}-${i}`} className="acRoEchoMsg" data-new={i === hist.length - 1}>
              {echo(focused, m)}
            </pre>
          ))
        )}
      </div>
    </div>
  );
}

/** subscription count as `ros2 topic info` would report it this run */
function subCount(rt: RosRuntime, topic: string): number {
  if (topic === "/object_detections/image") return 1;
  if (topic === "/object_detections/flag") return 0;
  if (topic === "/cmd_vel") return 1;
  return rt.subscribed(topic) ? 1 : 0;
}
