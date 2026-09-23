"use client";

/** check_topic_availability, step by step, from the runtime's probe state. */
import { OBJ, type RosRuntime } from "./runtime";

const SPIN_CODE = `# Wait for up to 3 seconds for a message
start_time = time.time()
timeout = 3.0

while not self.test_data_received and (time.time() - start_time) < timeout:
    rclpy.spin_once(self, timeout_sec=0.1)`;

const ORDER = ["check", "list", "found", "spin", "result", "subscribed", "done"] as const;

export default function ProbeCard({ rt }: { rt: RosRuntime | null }) {
  if (!rt) return <div className="acRoProbe acRoMuted">Starting the graph...</div>;
  const p = rt.probe;
  const at = ORDER.indexOf(p.stage);
  const reached = (s: (typeof ORDER)[number]) => at >= ORDER.indexOf(s);
  const det = rt.mode !== "a";
  const listed = [
    "/centroid",
    "/cmd_vel",
    ...(det ? ["/object_detections/centroid", "/object_detections/depth", "/object_detections/flag"] : []),
    "/object_detections/image",
    "/parameter_events",
    "/rosout",
  ];
  const logs = rt.planner.logs;
  const remaining = Math.max(0, 3 - p.ticks * 0.1);
  const decided = reached("result");
  const garbage = p.chosen === OBJ;

  return (
    <div className="acRoProbe">
      <div className="acRoProbeHead">
        <span className="acChip">lane_guidance_node3.py : check_topic_availability()</span>
      </div>

      <ol className="acRoSteps">
        <li data-on={reached("check")}>
          <span className="acRoStepN">1</span>
          <div>
            <div className="acMono acRoLogStr">{logs[0]?.msg}</div>
          </div>
        </li>
        <li data-on={reached("list")}>
          <span className="acRoStepN">2</span>
          <div>
            <div className="acMono acRoStepCode">dict(self.get_topic_names_and_types())</div>
            {reached("list") && (
              <div className="acRoTopicList">
                {listed.map((t) => (
                  <span key={t} className="acRoTopicChip acMono" data-hit={t === OBJ}>
                    {t}
                  </span>
                ))}
                {!det && (
                  <span className="acRoTopicChip acMono" data-miss="true">
                    {OBJ} missing
                  </span>
                )}
              </div>
            )}
          </div>
        </li>
        {det ? (
          <li data-on={reached("spin")}>
            <span className="acRoStepN">3</span>
            <div className="acRoGrow">
              <div className="acMono acRoLogStr">{reached("spin") ? logs[1]?.msg : "Topic found? Type std_msgs/msg/Float32?"}</div>
              <pre className="acRoCode acRoCodeSmall">{SPIN_CODE}</pre>
              <div className="acRoSpin" aria-label={`spin_once ticks: ${p.ticks} of 30`}>
                <div className="acRoTicks">
                  {Array.from({ length: 30 }, (_, i) => (
                    <i key={i} data-s={p.gotTick !== null && i === p.gotTick - 1 ? "msg" : i < p.ticks ? "done" : "wait"} />
                  ))}
                </div>
                <div className="acRoSpinRead acMono">
                  <span>
                    spin_once #{p.ticks}
                    <span className="acRoMuted">/30</span>
                  </span>
                  <span className="acRoCountdown">{remaining.toFixed(1)} s left</span>
                </div>
              </div>
            </div>
          </li>
        ) : null}
        <li data-on={decided}>
          <span className="acRoStepN">{det ? 4 : 3}</span>
          <div>
            <div className="acMono acRoLogStr">
              {decided ? (det ? logs[2]?.msg : logs[1]?.msg) : "waiting for the result..."}
            </div>
            {decided && (
              <div className="acRoVerdict" data-garbage={garbage}>
                <span className="acMono">create_subscription(Float32, &apos;{p.chosen}&apos;, self.controller, 10)</span>
                <b>{garbage ? "Garbage-seeking run" : "Lane-following run"}</b>
              </div>
            )}
          </div>
        </li>
      </ol>
    </div>
  );
}
