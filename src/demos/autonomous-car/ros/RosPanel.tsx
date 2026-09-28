"use client";

/**
 * #ros panel (prefix acRo): the car's ROS 2 graph running live. A headless CarSim
 * (camera → detector + lane node → guidance → /cmd_vel) steps in real time; every
 * publish animates along the graph and lands in the echo pane. Each restart replays the
 * guidance node's startup probe in one of three configurations.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRaf } from "../ui/useFitCanvas";
import RosGraph, { type GraphApi, type GraphPhase } from "./RosGraph";
import EchoPane from "./EchoPane";
import ProbeCard from "./ProbeCard";
import NodeCard from "./NodeCard";
import GuidanceLog from "./GuidanceLog";
import LaunchStrip from "./LaunchStrip";
import { OBJ, RosRuntime, type Mode, type TopicName } from "./runtime";
import type { NodeId } from "./rosData";
import "./ros.css";

const MODES: { id: Mode; label: string; sub: string }[] = [
  { id: "a", label: "Detector off", sub: "topic not found, uses /centroid" },
  { id: "b", label: "Detector on, nothing in view", sub: "no data in 3.0 s, uses /centroid" },
  { id: "c", label: "Garbage in view at startup", sub: "data arrives, uses the object topic" },
];

const MODE_NOTE: Record<Mode, string> = {
  a: "The camera node publishes frames for the lane node but no detection topics, so /object_detections/centroid is not in the topic list and the probe falls back at once. Nothing publishes the width either, so nothing can stop this car.",
  b: "The detector is running, but it only publishes a centroid when it sees garbage. The parked car sees none for 3.0 s, so the node settles on /centroid. Garbage sits on the tape, and the width topic still stops the car at each item.",
  c: "The car starts 2.4 m short of a 0.26 m cardboard box on the south straight, so a centroid arrives on the first spin. The node steers at the box, stops when its width passes 200 px, sweeps, runs the five steps, then has nothing left to follow.",
};

export default function RosPanel() {
  const [mode, setMode] = useState<Mode>("b");
  const [playing, setPlaying] = useState(true);
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [layoutName, setLayoutName] = useState<"wide" | "tall">("wide");
  const [selected, setSelected] = useState<NodeId>("guid");
  const [focused, setFocused] = useState<TopicName>("/cmd_vel");
  const [, setTick] = useState(0);
  const [restarts, setRestarts] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const graphWrap = useRef<HTMLDivElement | null>(null);
  const rtRef = useRef<RosRuntime | null>(null);
  const apiRef = useRef<GraphApi | null>(null);
  const started = useRef(false);
  const acc = useRef(0);
  const autoRestarts = useRef(0);

  // near / on-screen tracking (auto-start once, pause when far away)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.some((e) => e.isIntersecting);
        setOnScreen(vis);
        if (vis) setNear(true);
      },
      { rootMargin: "250px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // graph layout follows the container width
  useEffect(() => {
    // measure the stage, not the wrapper: the tall layout caps the wrapper's width
    const el = graphWrap.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setLayoutName(el.clientWidth - 24 >= 640 ? "wide" : "tall"));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const boot = useCallback((m: Mode) => {
    apiRef.current?.clear();
    const rt = new RosRuntime(m);
    rt.onBus = (msg) => apiRef.current?.onBus(msg);
    rtRef.current = rt;
    setRestarts((r) => r + 1);
  }, []);

  // first construction after mount, once the panel is near the viewport (World bakes ~0.4 s)
  useEffect(() => {
    if (!near || started.current) return;
    started.current = true;
    const id = window.setTimeout(() => boot(mode), 30);
    return () => window.clearTimeout(id);
  }, [near, boot, mode]);

  const restart = useCallback(
    (m: Mode) => {
      setMode(m);
      setPlaying(true);
      autoRestarts.current = 0;
      boot(m);
    },
    [boot],
  );

  const rt = rtRef.current;
  const running = playing && onScreen && rt !== null;

  useRaf((dt) => {
    const r = rtRef.current;
    if (!r) return;
    r.step(dt);
    apiRef.current?.frame(dt);
    // lane-following runs loop forever; if the car ever leaves the tape, start over
    if (r.mode !== "c" && r.probe.stage === "done" && r.sim.lost()) {
      autoRestarts.current++;
      boot(r.mode);
      return;
    }
    acc.current += dt;
    if (acc.current >= 0.1) {
      acc.current = 0;
      setTick((x) => (x + 1) % 1e6);
    }
  }, running);

  const stage = rt?.probe.stage ?? "check";
  const phase: GraphPhase = stage === "done" || stage === "subscribed" ? "run" : stage === "spin" || stage === "found" ? "spin" : "probe";
  const chosen = rt?.probe.chosen ?? "/centroid";
  const sim = rt?.sim;
  const idle = rt?.idle ?? false;

  return (
    <div className="acPanel acRoPanel" ref={rootRef}>
      <div className="acRoControls">
        <div className="acRoModes" role="radiogroup" aria-label="Startup configuration">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              className="acRoMode"
              data-active={mode === m.id}
              onClick={() => restart(m.id)}
            >
              <span className="acRoModeKey acMono">{m.id}</span>
              <span>
                <span className="acRoModeLabel">{m.label}</span>
                <span className="acRoModeSub">{m.sub}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="acRoButtons">
          <button type="button" className="acBtn acBtnPrimary" onClick={() => setPlaying((p) => !p)} disabled={!rt}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="acBtn" onClick={() => restart(mode)} disabled={!rt}>
            Restart
          </button>
        </div>
      </div>

      <p className="acRoWhy">
        <b>Why it matters:</b> the choice is made once, at startup. A run is either lane-following or garbage-seeking, while
        the width topic can stop the car in both.
      </p>

      <div className="acRoStage">
        <div className="acRoStatus acMono" aria-live="off">
          {sim ? (
            <>
              <span>
                t <b>{sim.t.toFixed(1)} s</b>
              </span>
              <span>
                v <b>{Math.abs(sim.v).toFixed(2)} m/s</b>
              </span>
              <span>
                sub <b className="acRoY">{phase === "run" ? chosen : "choosing..."}</b>
              </span>
              {mode !== "c" && (
                <span>
                  lap <b>{Math.floor(sim.progress / rt!.world.length) + 1}</b>
                </span>
              )}
              <span>
                scooped <b>{sim.collected.length ? sim.collected.join(", ") : "none"}</b>
              </span>
              {!onScreen && <span className="acRoMuted">paused off-screen</span>}
              {!playing && <span className="acRoY">paused</span>}
            </>
          ) : (
            <span className="acRoMuted">waiting to start</span>
          )}
        </div>
        <div className="acRoGraphWrap" ref={graphWrap} data-layout={layoutName}>
          {rt ? (
            <RosGraph
              layoutName={layoutName}
              mode={rt.mode}
              phase={phase}
              chosen={chosen}
              selected={selected}
              focused={focused}
              onSelect={setSelected}
              onFocus={setFocused}
              rtRef={rtRef}
              apiRef={apiRef}
            />
          ) : (
            <div className="acLoading acRoLoading">Building the parking lot and starting four nodes...</div>
          )}
        </div>
        {idle && (
          <div className="acRoIdle" role="status">
            <div>
              <b>No detections: guidance publishes nothing, car holds its last command.</b>
              <span className="acMono">
                {" "}
                /cmd_vel last sent linear.x {sim!.cmd.linear.toFixed(3)}, angular.z {sim!.cmd.angular.toFixed(3)}
              </span>
              <div className="acRoIdleSub">
                The node subscribed to {OBJ} at startup, so the lane node&apos;s /centroid messages still flowing on the left reach nobody.
              </div>
            </div>
            <button type="button" className="acBtn acBtnPrimary" onClick={() => restart("c")}>
              Restart
            </button>
          </div>
        )}
        <div className="acRoLegend">
          <span>
            <i className="acRoLg acRoLg-img" /> Image
          </span>
          <span>
            <i className="acRoLg acRoLg-f32" /> Float32
          </span>
          <span>
            <i className="acRoLg acRoLg-bool" /> Bool
          </span>
          <span>
            <i className="acRoLg acRoLg-twist" /> Twist
          </span>
          <span>
            <i className="acRoLn acRoLn-chosen" /> chosen subscription
          </span>
          <span>
            <i className="acRoLn acRoLn-faint" /> not subscribed this run
          </span>
          <span>
            <i className="acRoLn acRoLn-probe" /> probe&apos;s test subscription
          </span>
          <span className="acRoLegendHint">Click a node for its card, a topic to echo it.</span>
        </div>
      </div>

      <div className="acNote acRoModeNote">
        <b>({mode})</b> {MODE_NOTE[mode]}
        {autoRestarts.current > 0 && ` Restarted ${autoRestarts.current} time${autoRestarts.current === 1 ? "" : "s"} after leaving the tape.`}
      </div>

      <div className="acRoGrid">
        <section className="acRoCol">
          <h3 className="acRoH3">Startup probe</h3>
          <ProbeCard rt={rt} key={`p${restarts}`} />
        </section>
        <section className="acRoCol">
          <h3 className="acRoH3">Topic echo</h3>
          <EchoPane rt={rt} focused={focused} onFocus={setFocused} />
        </section>
      </div>

      <div className="acRoGrid">
        <section className="acRoCol">
          <h3 className="acRoH3">Node</h3>
          <div className="acRoNodeTabs" role="tablist" aria-label="Nodes">
            {(["det", "lane", "guid", "servo", "vesc"] as NodeId[]).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={selected === id} className="acRoNodeTab acMono" data-active={selected === id} onClick={() => setSelected(id)}>
                {id === "det" ? "object_detection" : id === "lane" ? "lane_detection" : id === "guid" ? "lane_guidance" : id === "servo" ? "servo_sweeper" : "vesc_twist"}
              </button>
            ))}
          </div>
          <NodeCard id={selected} rt={rt} />
        </section>
        <section className="acRoCol">
          <h3 className="acRoH3">Guidance log</h3>
          <GuidanceLog rt={rt} version={rt?.termVersion ?? 0} />
        </section>
      </div>

      <h3 className="acRoH3">Launch</h3>
      <LaunchStrip />
    </div>
  );
}
