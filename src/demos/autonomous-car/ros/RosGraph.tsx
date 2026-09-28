"use client";

/**
 * The live node/topic graph. Structure renders through React (only when the layout,
 * mode, probe stage or selection changes); message dots, pill flashes and node status
 * lines are driven imperatively from the panel's rAF loop through `apiRef`.
 */
import { memo, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import type { BusMessage } from "../core/sim";
import { OBJ, LANE, TOPICS, type Mode, type RosRuntime, type TopicName } from "./runtime";
import { LAYOUTS, NODES, TOPIC_TYPE, bez, bezLen, pathD, type EdgeDef, type Layout, type NodeId, type Pt } from "./rosData";

export interface GraphApi {
  onBus(m: BusMessage): void;
  frame(dt: number): void;
  clear(): void;
}

/** what the structure depends on */
export type GraphPhase = "probe" | "spin" | "run";

type EdgeState = "on" | "chosen" | "faint" | "off" | "probe" | "wait" | "spawn" | "nopub";

interface Props {
  layoutName: "wide" | "tall";
  mode: Mode;
  phase: GraphPhase;
  chosen: string;
  selected: NodeId;
  focused: TopicName;
  onSelect(id: NodeId): void;
  onFocus(t: TopicName): void;
  rtRef: MutableRefObject<RosRuntime | null>;
  apiRef: MutableRefObject<GraphApi | null>;
}

const DOT_CLASS: Record<string, string> = {
  "/object_detections/image": "img",
  "/object_detections/centroid": "f32",
  "/object_detections/depth": "f32",
  "/centroid": "f32",
  "/object_detections/flag": "bool",
  "/cmd_vel": "twist",
  spawn: "spawn",
};

function edgeState(e: EdgeDef, mode: Mode, phase: GraphPhase, chosen: string): { s: EdgeState; label?: string } {
  const detOff = mode === "a";
  switch (e.id) {
    case "det-oc":
    case "det-dep":
    case "det-flag":
      return { s: detOff ? "off" : "on" };
    case "cen-guid":
      if (phase !== "run") return { s: "wait", label: "no subscription yet" };
      return chosen === LANE ? { s: "chosen", label: "controller" } : { s: "faint", label: "not subscribed this run" };
    case "oc-guid":
      if (phase === "spin") return { s: "probe", label: "test subscription" };
      if (phase === "probe") return { s: "wait", label: detOff ? "topic not found" : "no subscription yet" };
      if (detOff) return { s: "off", label: "not subscribed this run" };
      return chosen === OBJ ? { s: "chosen", label: "controller" } : { s: "faint", label: "not subscribed this run" };
    case "dep-guid":
      if (phase !== "run") return { s: "wait", label: "no subscription yet" };
      return detOff ? { s: "nopub", label: "width_callback (no publisher)" } : { s: "on", label: "width_callback" };
    case "spawn":
      return { s: "spawn", label: e.label?.text };
    default:
      return { s: "on", label: e.label?.text };
  }
}

interface Dot {
  el: SVGCircleElement;
  c: [Pt, Pt, Pt, Pt];
  t0: number;
  dur: number;
  done?: () => void;
}

function RosGraphImpl({ layoutName, mode, phase, chosen, selected, focused, onSelect, onFocus, rtRef, apiRef }: Props) {
  const L: Layout = LAYOUTS[layoutName];
  const dotsG = useRef<SVGGElement | null>(null);
  const flashEls = useRef(new Map<string, SVGElement>());
  const statusEls = useRef(new Map<NodeId, SVGTextElement>());
  const servoBox = useRef<SVGGElement | null>(null);
  const edges = useMemo(() => L.edges.map((e) => ({ e, len: bezLen(e.c), ...edgeState(e, mode, phase, chosen) })), [L, mode, phase, chosen]);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // imperative animation state
  const st = useRef({ clock: 0, dots: [] as Dot[], pool: [] as SVGCircleElement[], flash: new Map<string, number>(), lastStatus: -1, shown: new Map<string, number>() });

  useEffect(() => {
    const speed = L.name === "wide" ? 900 : 380;
    const S = st.current;
    // a layout switch moves every path: drop dots that were in flight on the old ones
    const g0 = dotsG.current;
    while (g0?.firstChild) g0.removeChild(g0.firstChild);
    S.dots = [];
    S.pool = [];
    S.shown.clear();
    const spawnDot = (c: [Pt, Pt, Pt, Pt], len: number, cls: string, done?: () => void) => {
      const g = dotsG.current;
      if (!g) return;
      if (S.dots.length > 90) return;
      let el = S.pool.pop();
      if (!el) {
        el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        g.appendChild(el);
      }
      el.setAttribute("r", L.name === "wide" ? "4" : "3.2");
      el.setAttribute("class", `acRoDot acRoDot-${cls}`);
      el.style.display = "";
      const p = c[0];
      el.setAttribute("cx", p[0].toFixed(1));
      el.setAttribute("cy", p[1].toFixed(1));
      S.dots.push({ el, c, t0: S.clock, dur: Math.max(0.16, Math.min(0.6, len / speed)), done });
    };
    const flash = (key: string) => S.flash.set(key, S.clock);

    const api: GraphApi = {
      onBus(m) {
        const E = edgesRef.current;
        if (m.topic === "servo_sweeper") {
          if (m.value.startsWith("spawned")) {
            const sp = E.find((x) => x.e.id === "spawn");
            flash("node:guid");
            if (sp) spawnDot(sp.e.c, sp.len, "spawn", () => flash("node:servo"));
          } else flash("node:servo");
          return;
        }
        const topic = m.topic as TopicName;
        const pub = E.find((x) => x.e.kind === "pub" && x.e.topic === topic);
        if (!pub) return;
        flash(`node:${pub.e.node}`);
        spawnDot(pub.e.c, pub.len, DOT_CLASS[topic] ?? "f32", () => {
          flash(`topic:${topic}`);
          const rt = rtRef.current;
          for (const x of edgesRef.current) {
            if (x.e.kind !== "sub" || x.e.topic !== topic) continue;
            if (x.e.node === "guid" && !(rt?.subscribed(topic) ?? false)) continue;
            spawnDot(x.e.c, x.len, DOT_CLASS[topic] ?? "f32", () => flash(`node:${x.e.node}`));
          }
        });
      },
      frame(dt) {
        S.clock += Math.min(dt, 0.1);
        const now = S.clock;
        const keep: Dot[] = [];
        const finished: Dot[] = [];
        for (const d of S.dots) {
          const u = (now - d.t0) / d.dur;
          if (u >= 1) {
            finished.push(d);
            continue;
          }
          const p = bez(d.c, u);
          d.el.setAttribute("cx", p[0].toFixed(1));
          d.el.setAttribute("cy", p[1].toFixed(1));
          keep.push(d);
        }
        S.dots = keep;
        for (const d of finished) {
          d.el.style.display = "none";
          S.pool.push(d.el);
          d.done?.();
        }
        // pill + node flashes
        for (const [key, el] of flashEls.current) {
          const t = S.flash.get(key);
          const v = t === undefined ? 0 : Math.max(0, 1 - (now - t) / (key.startsWith("node:") ? 0.22 : 0.3));
          const q = Math.round(v * 20) / 20;
          if (S.shown.get(key) !== q) {
            S.shown.set(key, q);
            el.style.opacity = String(q);
          }
        }
        // status lines at ~10 Hz
        const tick = Math.floor(now * 10);
        if (tick !== S.lastStatus) {
          S.lastStatus = tick;
          const rt = rtRef.current;
          if (rt) {
            for (const [id, el] of statusEls.current) {
              const s = nodeStatus(id, rt);
              if (el.textContent !== s) el.textContent = s;
            }
            const sv = servoBox.current;
            if (sv) sv.dataset.on = String(rt.sim.servoOn);
          }
        }
      },
      clear() {
        for (const d of S.dots) {
          d.el.style.display = "none";
          S.pool.push(d.el);
        }
        S.dots = [];
        S.flash.clear();
      },
    };
    apiRef.current = api;
    return () => {
      if (apiRef.current === api) apiRef.current = null;
    };
  }, [L, apiRef, rtRef]);

  const regFlash = (key: string) => (el: SVGElement | null) => {
    if (el) flashEls.current.set(key, el);
    else flashEls.current.delete(key);
  };
  const regStatus = (id: NodeId) => (el: SVGTextElement | null) => {
    if (el) statusEls.current.set(id, el);
    else statusEls.current.delete(id);
  };

  const fs = L.font;
  const keyAct = (fn: () => void) => (ev: React.KeyboardEvent) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      fn();
    }
  };

  return (
    <svg
      className="acRoSvg"
      data-layout={L.name}
      viewBox={`0 0 ${L.vw} ${L.vh}`}
      role="group"
      aria-label="ROS 2 node and topic graph"
      style={{ fontSize: fs }}
    >
      {/* edges */}
      <g>
        {edges.map(({ e, s }) => (
          <path key={e.id} d={pathD(e.c)} className="acRoEdge" data-s={s} />
        ))}
      </g>
      <g>
        {edges.map(({ e, s, label }) => {
          if (!label || !e.label) return null;
          if (s === "off" && e.id !== "oc-guid") return null;
          return (
            <text key={e.id} x={e.label.at[0]} y={e.label.at[1]} textAnchor={e.label.anchor ?? "middle"} className="acRoEdgeLabel" data-s={s}>
              {label}
            </text>
          );
        })}
      </g>

      {/* topic pills */}
      {TOPICS.map((t) => {
        const b = L.topics[t];
        const absent = mode === "a" && (t === OBJ || t === "/object_detections/depth" || t === "/object_detections/flag");
        const r = b.h / 2;
        return (
          <g
            key={t}
            className="acRoPill"
            data-absent={absent}
            data-focus={focused === t}
            role="button"
            tabIndex={0}
            aria-label={`Echo ${t}`}
            onClick={() => onFocus(t)}
            onKeyDown={keyAct(() => onFocus(t))}
          >
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={r} className="acRoPillBg" />
            <rect ref={regFlash(`topic:${t}`)} x={b.x} y={b.y} width={b.w} height={b.h} rx={r} className="acRoPillFlash" style={{ opacity: 0 }} />
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 + fs * 0.36} textAnchor="middle" className="acRoPillText">
              {t}
            </text>
            {L.typeBelow && (
              <text x={b.x + b.w / 2} y={b.y + b.h + fs * 1.05} textAnchor="middle" className="acRoPillType">
                {absent
                  ? "not advertised"
                  : t === "/object_detections/depth"
                    ? "Float32, bbox width in px"
                    : t === "/object_detections/flag"
                      ? "std_msgs/Bool, no subscriber"
                      : TOPIC_TYPE[t]}
              </text>
            )}
          </g>
        );
      })}
      {/* nodes */}
      {(Object.keys(L.nodes) as NodeId[]).map((id) => {
        const b = L.nodes[id];
        const info = NODES[id];
        const tag = id === "vesc" ? "course package" : id === "servo" ? "spawned on demand" : id === "det" ? "OAK-D Lite" : null;
        return (
          <g
            key={id}
            ref={id === "servo" ? servoBox : undefined}
            className="acRoNode"
            data-id={id}
            data-sel={selected === id}
            data-off={id === "det" && mode === "a" ? "partial" : undefined}
            role="button"
            tabIndex={0}
            aria-label={`Show ${info.name}`}
            onClick={() => onSelect(id)}
            onKeyDown={keyAct(() => onSelect(id))}
          >
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={9} className="acRoNodeBg" />
            <rect ref={regFlash(`node:${id}`)} x={b.x} y={b.y} width={b.w} height={b.h} rx={9} className="acRoNodeFlash" style={{ opacity: 0 }} />
            <rect x={b.x + 1} y={b.y + 1} width={b.w - 2} height={4} rx={2} className="acRoNodeStripe" />
            <text x={b.x + 12} y={b.y + 12 + fs * 1.15} className="acRoNodeName">
              {info.name}
            </text>
            <text x={b.x + 12} y={b.y + 12 + fs * 2.4} className="acRoNodeFile">
              {id === "vesc" ? "ucsd_robocar actuator" : info.file.replace("Code/", "").replace(" (class PathPlanner)", "")}
            </text>
            <text ref={regStatus(id)} x={b.x + 12} y={b.y + b.h - 12} className="acRoNodeStatus">
              {id === "det" && mode === "a" ? "camera only, detector off" : " "}
            </text>
            {tag && (
              <text x={b.x + b.w - 2} y={b.y - 6} textAnchor="end" className="acRoNodeTag">
                {tag}
              </text>
            )}
          </g>
        );
      })}
      <g ref={dotsG} className="acRoDots" />
    </svg>
  );
}

function sgn(v: number, d = 3) {
  return (v >= 0 ? "+" : "") + v.toFixed(d);
}

export function nodeStatus(id: NodeId, rt: RosRuntime): string {
  const sim = rt.sim;
  const pl = rt.planner;
  switch (id) {
    case "det": {
      if (rt.mode === "a") return "camera only, detector off";
      const d = sim.lastDetect;
      if (!d || !d.flag) return "flag false, no boxes";
      return `flag true, w ${d.width?.toFixed(0)} px`;
    }
    case "lane": {
      const l = sim.lastLane;
      if (!l) return "waiting for a frame";
      if (l.error === null) return "no line, nothing sent";
      const n = l.contours.filter((c) => c.pass).length;
      return `err ${sgn(l.error)}, ${n} line${n === 1 ? "" : "s"}`;
    }
    case "guid": {
      const p = rt.probe;
      if (p.stage === "check" || p.stage === "list") return "check_topic_availability()";
      if (p.stage === "spin" || p.stage === "found") return `spin_once ${p.ticks}/30`;
      if (p.stage !== "done") return `chose ${p.chosen}`;
      if (rt.idle) return "no detections, silent";
      if (pl.isBlocked(sim.t)) return "time.sleep(1.2)";
      if (pl.isAvoiding) return `maneuver step ${pl.avoidanceStep}/5`;
      if (pl.isSweeping) return "stopped, sweeping";
      if (pl.obstacleTooLarge) return "stopped";
      return rt.probe.chosen === OBJ ? "seeking garbage" : "following the tape";
    }
    case "servo":
      return sim.servoOn ? `running, arm ${sim.servoAngle} deg` : "not running";
    case "vesc":
      return `lin ${sim.cmd.linear.toFixed(3)}  ang ${sgn(sim.cmd.angular)}`;
  }
}

const RosGraph = memo(RosGraphImpl);
export default RosGraph;
