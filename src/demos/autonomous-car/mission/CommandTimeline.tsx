"use client";

/**
 * The five avoidance steps as execute_avoidance_step publishes them, plus the
 * resume_delay sleep in finish_avoidance_maneuver. Durations are the node's own:
 * turn = radians(80) / 0.5, forward = 0.4 / 0.15, reverse = abs(0.4 / -0.15),
 * final = 0.34 / 0.15. Each step ends on the first 0.1 s timer tick past its duration.
 */
import type { MissionRun } from "./run";

type Status = "todo" | "live" | "done" | "paused";

export default function CommandTimeline({ run }: { run: MissionRun }) {
  const s = run.sim;
  const p = s.planner;
  const steps = p.steps();
  const g = p.p;
  const twist = run.mode === "twist";
  const blocked = p.isBlocked(s.t);
  const afterManeuver = !p.isAvoiding && !p.isSweeping && Number.isFinite(p.blockedUntil);

  const formula = [
    `${g.turn_angle_deg}° / ${g.turn_speed} rad/s`,
    `${g.forward_distance} m / ${g.forward_speed} m/s`,
    `${g.reverse_distance} m / ${Math.abs(g.reverse_speed)} m/s`,
    `${g.turn_angle_deg}° / ${g.turn_speed} rad/s`,
    `${g.final_forward_distance} m / ${g.forward_speed} m/s`,
  ];
  const readAs = twist
    ? ["turn in place, right", "forward", "reverse", "turn in place, left", "forward"]
    : ["steer 0.5 left, throttle 0", "throttle 0.15", "throttle −0.15", "steer 0.5 right, throttle 0", "throttle 0.15"];

  const rows = steps.map((st) => {
    let status: Status = "todo";
    let progress = 0;
    if (p.isAvoiding) {
      if (p.avoidanceStep > st.n) status = "done";
      else if (p.avoidanceStep === st.n) {
        status = p.isSweeping ? "paused" : "live";
        progress = p.avoidanceStart === null ? 0 : Math.min(1, (s.t - p.avoidanceStart) / st.duration);
      }
    } else if (afterManeuver) status = "done";
    if (status === "done") progress = 1;
    return { st, status, progress };
  });
  const blockStatus: Status = blocked ? "live" : afterManeuver ? "done" : "todo";
  const blockProgress = blocked ? 1 - (p.blockedUntil - s.t) / g.resume_delay : blockStatus === "done" ? 1 : 0;
  const total = steps.reduce((a, b) => a + b.duration, 0) + g.resume_delay;

  const cols = [...steps.map((st) => `${st.duration.toFixed(2)}fr`), `${g.resume_delay}fr`].join(" ");
  const fmt = (v: number) => (v === 0 ? "0.00" : v.toFixed(2));

  const segs = [
    ...rows.map(({ st, status, progress }) => ({ key: String(st.n), n: String(st.n), dur: st.duration, status, progress })),
    { key: "b", n: "II", dur: g.resume_delay, status: blockStatus, progress: Math.max(0, Math.min(1, blockProgress)) },
  ];

  return (
    <div className="acMiTl">
      <div className="acMiTlStrip" style={{ ["--acMiCols" as string]: cols }} aria-hidden="true">
        {segs.map((sg) => (
          <div key={sg.key} className={`acMiTlSeg acMiTl_${sg.status}${sg.key === "b" ? " acMiTlSegBlock" : ""}`}>
            <div className="acMiTlFill" style={{ width: `${sg.progress * 100}%` }} />
            <span className="acMono">
              {sg.n}
              <span className="acMiTlSegDur"> · {sg.dur.toFixed(2)} s</span>
            </span>
          </div>
        ))}
      </div>
      <div className="acMiTlGrid">
        {rows.map(({ st, status }, i) => (
          <div key={st.n} className={`acMiTlBar acMiTl_${status}`}>
            <div className="acMiTlBody">
              <div className="acMiTlHead">
                <span className="acMiTlN">{st.n}</span>
                <span className="acMiTlLabel">{st.label}</span>
              </div>
              <div className="acMiTlTwist acMono">
                linear.x <b>{fmt(st.twist.linear)}</b>
                <br />
                angular.z <b>{fmt(st.twist.angular)}</b>
              </div>
              <div className="acMiTlDur acMono">
                {formula[i]}
                <br />= <b>{st.duration.toFixed(2)} s</b>
              </div>
              <div className="acMiTlRead">{status === "paused" ? "paused: a new sweep is running" : readAs[i]}</div>
            </div>
          </div>
        ))}
        <div className={`acMiTlBar acMiTlBlock acMiTl_${blockStatus}`}>
          <div className="acMiTlBody">
            <div className="acMiTlHead">
              <span className="acMiTlN acMiTlNBlock">II</span>
              <span className="acMiTlLabel">BLOCKED</span>
            </div>
            <div className="acMiTlTwist acMono">
              zero Twist,
              <br />
              then time.sleep
            </div>
            <div className="acMiTlDur acMono">
              resume_delay
              <br />= <b>{g.resume_delay.toFixed(1)} s</b>
            </div>
            <div className="acMiTlRead">callbacks queue meanwhile</div>
          </div>
        </div>
      </div>
      <div className="acMiTlFoot acMono">
        {steps.length} steps + sleep = {total.toFixed(2)} s nominal · each step ends on the first 0.1 s timer tick past its
        duration, and a zero Twist goes out between steps
      </div>
    </div>
  );
}
