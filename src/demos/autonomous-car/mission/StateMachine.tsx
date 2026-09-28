"use client";

/**
 * lane_guidance_node3.py's obstacle logic as a state diagram. The flags are the node's
 * own (obstacle_too_large, is_sweeping, is_avoiding, avoidance_step, the resume_delay
 * sleep); the edge labels are the conditions in check_for_obstacles,
 * check_sweep_and_avoidance_status, execute_avoidance_step and finish_avoidance_maneuver.
 */
import type { MState } from "./run";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Edge {
  d: string;
  label: string[];
  lx: number;
  ly: number;
  anchor?: "start" | "middle" | "end";
  rot?: number;
  dashed?: boolean;
  /** the live state this edge leaves from */
  from: MState;
}

interface Layout {
  vb: [number, number];
  nodes: Record<Exclude<MState, "avoid">, Box> & { avoid: Box };
  edges: Edge[];
  loop: { d: string; lx: number; ly: number };
  font: number;
}

const WIDE: Layout = {
  vb: [760, 280],
  font: 11.5,
  nodes: {
    drive: { x: 20, y: 44, w: 150, h: 62 },
    stopped: { x: 285, y: 44, w: 150, h: 62 },
    sweeping: { x: 550, y: 44, w: 150, h: 62 },
    avoid: { x: 300, y: 180, w: 400, h: 84 },
    blocked: { x: 20, y: 190, w: 150, h: 62 },
  },
  edges: [
    { from: "drive", d: "M170,75 H279", label: ["width > 200 px"], lx: 227, ly: 66 },
    { from: "stopped", d: "M435,75 H544", label: ["same callback:", "Popen(sweeper)"], lx: 490, ly: 58 },
    { from: "sweeping", d: "M650,106 V174", label: ["5.0 s elapsed", "(0.1 s timer)"], lx: 658, ly: 136, anchor: "start" },
    { from: "avoid", d: "M580,180 V112", label: ["width > 200 px", "again"], lx: 572, ly: 136, anchor: "end", dashed: true },
    { from: "avoid", d: "M300,221 H176", label: ["step 5 done:", "time.sleep(1.2)"], lx: 238, ly: 208 },
    { from: "blocked", d: "M95,190 V112", label: ["sleep returns,", "queue drains"], lx: 103, ly: 146, anchor: "start" },
  ],
  loop: { d: "M62,44 C56,6 128,6 122,40", lx: 135, ly: 18 },
};

const TALL: Layout = {
  vb: [360, 600],
  font: 12.5,
  nodes: {
    drive: { x: 100, y: 34, w: 160, h: 62 },
    stopped: { x: 100, y: 146, w: 160, h: 62 },
    sweeping: { x: 100, y: 258, w: 160, h: 62 },
    avoid: { x: 30, y: 376, w: 318, h: 96 },
    blocked: { x: 100, y: 522, w: 160, h: 62 },
  },
  edges: [
    { from: "drive", d: "M180,96 V140", label: ["width > 200 px"], lx: 190, ly: 122, anchor: "start" },
    { from: "stopped", d: "M180,208 V252", label: ["same callback:", "Popen(sweeper)"], lx: 190, ly: 226, anchor: "start" },
    { from: "sweeping", d: "M180,320 V370", label: ["elapsed ≥ 5.0 s"], lx: 172, ly: 350, anchor: "end" },
    { from: "avoid", d: "M300,376 V289 H266", label: ["width > 200", "again"], lx: 294, ly: 336, anchor: "end", dashed: true },
    { from: "avoid", d: "M180,472 V516", label: ["step 5 done: sleep(1.2)"], lx: 190, ly: 498, anchor: "start" },
    { from: "blocked", d: "M100,553 H14 V65 H94", label: ["sleep returns, queue drains"], lx: 28, ly: 300, rot: -90 },
  ],
  loop: { d: "M260,52 C300,40 300,84 266,80", lx: 96, ly: 22 },
};

const TITLES: Record<MState, [string, string]> = {
  drive: ["DRIVE", "PID toward the detection"],
  stopped: ["STOPPED", "zero throttle"],
  sweeping: ["SWEEPING", "servo_sweeper, 5 s"],
  avoid: ["AVOID", "5 timed steps, open loop"],
  blocked: ["BLOCKED", "sleep inside the timer"],
};

const STEP_SHORT = ["turn R", "fwd", "back", "turn L", "fwd"];

function Diagram({ L, state, step, progress, idle, id }: { L: Layout; state: MState; step: number; progress: number; idle: boolean; id: string }) {
  const node = (s: MState) => {
    const b = L.nodes[s];
    const on = state === s;
    const [title, sub] = TITLES[s];
    const isAvoid = s === "avoid";
    return (
      <g key={s} className={`acMiSmNode${on ? " acMiSmOn" : ""}`}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} filter={on ? `url(#${id}glow)` : undefined} />
        <text x={isAvoid ? b.x + 14 : b.x + b.w / 2} y={b.y + 24} textAnchor={isAvoid ? "start" : "middle"} className="acMiSmTitle" fontSize={L.font + 2}>
          {title}
        </text>
        <text
          x={isAvoid ? b.x + b.w - 14 : b.x + b.w / 2}
          y={isAvoid ? b.y + 24 : b.y + 44}
          textAnchor={isAvoid ? "end" : "middle"}
          className="acMiSmSub"
          fontSize={L.font - 0.5}
        >
          {s === "drive" && on && idle ? "no detection: holds last cmd" : sub}
        </text>
        {isAvoid &&
          STEP_SHORT.map((t, i) => {
            const n = i + 1;
            const gap = 6;
            const pw = (b.w - 28 - gap * 4) / 5;
            const px = b.x + 14 + i * (pw + gap);
            const py = b.y + 38;
            const ph = b.h - 50;
            const cur = on && step === n;
            const doneStep = on && step > n;
            return (
              <g key={n} className={`acMiSmPill${cur ? " acMiSmPillOn" : ""}${doneStep ? " acMiSmPillDone" : ""}`}>
                <rect x={px} y={py} width={pw} height={ph} rx={6} />
                {cur && <rect x={px} y={py + ph - 4} width={pw * Math.min(1, progress)} height={4} rx={2} className="acMiSmPillBar" />}
                <text x={px + pw / 2} y={py + ph / 2 - 2} textAnchor="middle" fontSize={L.font} className="acMiSmPillN">
                  {n}
                </text>
                <text x={px + pw / 2} y={py + ph / 2 + 11} textAnchor="middle" fontSize={L.font - 2} className="acMiSmPillT">
                  {t}
                </text>
              </g>
            );
          })}
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${L.vb[0]} ${L.vb[1]}`} className="acMiSmSvg" role="img" aria-label={`guidance node state: ${state}`}>
      <defs>
        <filter id={`${id}glow`} x="-30%" y="-40%" width="160%" height="180%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id={`${id}arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="acMiSmArrowHead" />
        </marker>
        <marker id={`${id}arrowOn`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="acMiSmArrowHeadOn" />
        </marker>
      </defs>
      <path
        d={L.loop.d}
        className={`acMiSmEdge${state === "drive" && !idle ? " acMiSmEdgeLive" : ""}`}
        markerEnd={`url(#${id}${state === "drive" && !idle ? "arrowOn" : "arrow"})`}
      />
      <text x={L.loop.lx} y={L.loop.ly} className="acMiSmEdgeLabel" fontSize={L.font - 1}>
        each centroid msg: PID → /cmd_vel
      </text>
      {L.edges.map((e, i) => (
        <g key={i}>
          <path
            d={e.d}
            className={`acMiSmEdge${e.dashed ? " acMiSmEdgeDashed" : ""}${state === e.from && !e.dashed ? " acMiSmEdgeLive" : ""}`}
            markerEnd={`url(#${id}${state === e.from && !e.dashed ? "arrowOn" : "arrow"})`}
          />
          <text
            x={e.lx}
            y={e.ly}
            textAnchor={e.anchor ?? "middle"}
            className="acMiSmEdgeLabel"
            fontSize={L.font - 1}
            transform={e.rot ? `rotate(${e.rot} ${e.lx} ${e.ly})` : undefined}
          >
            {e.label.map((l, j) => (
              <tspan key={j} x={e.lx} dy={j === 0 ? 0 : L.font + 1}>
                {l}
              </tspan>
            ))}
          </text>
        </g>
      ))}
      {(["drive", "stopped", "sweeping", "avoid", "blocked"] as MState[]).map(node)}
    </svg>
  );
}

export default function StateMachine(props: { state: MState; step: number; progress: number; idle: boolean }) {
  return (
    <div className="acMiSm">
      <div className="acMiSmWide">
        <Diagram L={WIDE} id="acMiSmW" {...props} />
      </div>
      <div className="acMiSmTall">
        <Diagram L={TALL} id="acMiSmT" {...props} />
      </div>
    </div>
  );
}
