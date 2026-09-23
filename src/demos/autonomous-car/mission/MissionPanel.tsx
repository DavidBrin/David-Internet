"use client";

/**
 * #mission, "The garbage run" (prefix acMi). A CarSim in garbage mode on the south
 * straight: the detector stand-in feeds camera_driver2's math, lane_guidance_node3's
 * PathPlanner drives, stops at 200 px, spawns the servo sweep, runs the five timed
 * steps and sleeps 1.2 s, three times. The sim and all drawing run from one rAF loop
 * on refs; React re-renders the readouts at about 8 Hz.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { World } from "../core/world";
import { useFitCanvas, useRaf } from "../ui/useFitCanvas";
import CommandTimeline from "./CommandTimeline";
import { CameraRenderer, drawCameraFrame, drawScene, followCam, type SceneCam } from "./draw";
import LogTerminal from "./LogTerminal";
import { MissionRun, START, type AvoidMode, type MState } from "./run";
import ServoDial from "./ServoDial";
import StateMachine from "./StateMachine";
import WidthGauge from "./WidthGauge";
import "./mission.css";

const SPEEDS = [1, 2, 4] as const;
const STATE_TEXT: Record<MState, string> = {
  drive: "DRIVE",
  stopped: "STOPPED",
  sweeping: "SWEEPING",
  avoid: "AVOID",
  blocked: "BLOCKED",
};

export default function MissionPanel() {
  const [mode, setMode] = useState<AvoidMode>("twist");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [inView, setInView] = useState(false);
  const [, setTick] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<World | null>(null);
  const runRef = useRef<MissionRun | null>(null);
  const camRef = useRef<SceneCam>({ cx: START.x + 1.2, cy: START.y });
  const camR = useRef<CameraRenderer | null>(null);
  const autoStarted = useRef(false);
  const acc = useRef({ cam: 1, ui: 0, lastFrameSeq: -1 });

  // ---------------------------------------------------------------- canvases
  const drawSceneCb = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    drawScene(ctx, w, h, runRef.current, camRef.current);
  }, []);
  const { canvasRef: sceneCanvasRef, wrapRef: sceneWrapRef, redraw: sceneRedraw } = useFitCanvas(drawSceneCb, 2);

  const drawCamCb = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    drawCameraFrame(ctx, w, h, camR.current?.canvas ?? null, runRef.current?.sim.lastDetect ?? null);
  }, []);
  const { canvasRef: camCanvasRef, wrapRef: camWrapRef, redraw: camRedraw } = useFitCanvas(drawCamCb, 4 / 3);

  const renderCameraFrame = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    if (!camR.current) camR.current = new CameraRenderer();
    camR.current.render(run.sim.world, run.framePose);
    camRedraw();
  }, [camRedraw]);

  // ---------------------------------------------------------------- visibility
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setInView(es.some((e) => e.isIntersecting)), { rootMargin: "250px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // build the World (about 370 ms the first time) only once the panel is near the viewport
  const building = useRef(false);
  useEffect(() => {
    if (!inView || building.current) return;
    building.current = true;
    setStatus("loading");
    // let the loading line paint before the bake blocks the main thread
    window.setTimeout(() => {
      worldRef.current = new World({ garbage: [] });
      runRef.current = new MissionRun(worldRef.current, "twist");
      setStatus("ready");
    }, 40);
  }, [inView]);

  useEffect(() => {
    if (status !== "ready") return;
    renderCameraFrame();
    sceneRedraw();
    if (!autoStarted.current) {
      autoStarted.current = true;
      setPlaying(true);
    }
  }, [status, renderCameraFrame, sceneRedraw]);

  const restart = useCallback(
    (m: AvoidMode) => {
      const world = worldRef.current;
      if (!world) return;
      runRef.current = new MissionRun(world, m);
      camRef.current = { cx: START.x + 1.2, cy: START.y };
      acc.current = { cam: 1, ui: 0, lastFrameSeq: -1 };
      renderCameraFrame();
      sceneRedraw();
      setPlaying(true);
      setTick((n) => n + 1);
    },
    [renderCameraFrame, sceneRedraw],
  );

  // ---------------------------------------------------------------- loop
  const run = runRef.current;
  const running = status === "ready" && playing && inView && !!run && !run.done;
  useRaf((dt) => {
    const r = runRef.current;
    if (!r) return;
    r.advance(dt * speed);
    followCam(camRef.current, r.sim.pose, Math.min(1, dt * 3));
    sceneRedraw();
    const a = acc.current;
    a.cam += dt;
    if (a.cam >= 0.2 && r.frameSeq !== a.lastFrameSeq) {
      a.cam = 0;
      a.lastFrameSeq = r.frameSeq;
      renderCameraFrame();
    }
    a.ui += dt;
    if (a.ui >= 0.125 || r.done) {
      a.ui = 0;
      setTick((n) => n + 1);
    }
  }, running);

  // ---------------------------------------------------------------- readouts
  const loading = status !== "ready" || !run;
  const sim = run?.sim;
  const planner = sim?.planner;
  const state: MState = run ? run.state : "drive";
  const step = planner?.avoidanceStep ?? 0;
  const stepDur = planner && step > 0 ? planner.steps()[step - 1].duration : 1;
  const stepProgress = planner && planner.avoidanceStart !== null ? (sim!.t - planner.avoidanceStart) / stepDur : 0;
  const noDetection = !!sim && !(sim.lastDetect?.preds.length ?? 0);
  const collected = sim?.collected.length ?? 0;
  const done = !!run?.done;
  const allThree = collected === 3;

  return (
    <div className="acPanel acMi" ref={rootRef}>
      <div className="acMiBar">
        <div className="acRow">
          <button className="acBtn acBtnPrimary" onClick={() => restart(mode)} disabled={loading}>
            Restart
          </button>
          <button className="acBtn" onClick={() => setPlaying((p) => !p)} disabled={loading || done} aria-pressed={!playing}>
            {playing ? "Pause" : "Play"}
          </button>
          <div className="acMiSeg" role="group" aria-label="simulation speed">
            {SPEEDS.map((s) => (
              <button key={s} className="acBtn" data-active={speed === s} onClick={() => setSpeed(s)}>
                {s}x
              </button>
            ))}
          </div>
        </div>
        <div className="acMiSeg acMiMode" role="group" aria-label="how the maneuver's Twists move the car">
          <button
            className="acBtn"
            data-active={mode === "twist"}
            onClick={() => {
              setMode("twist");
              restart("twist");
            }}
            disabled={loading}
          >
            In Twist units (as written)
          </button>
          <button
            className="acBtn"
            data-active={mode === "actuator"}
            onClick={() => {
              setMode("actuator");
              restart("actuator");
            }}
            disabled={loading}
          >
            Through the course actuator
          </button>
        </div>
      </div>

      <div className="acMiTop">
        <div className="acMiSceneCol">
          <div className="acMiScene" ref={sceneWrapRef}>
            <canvas ref={sceneCanvasRef} aria-label="top-down view of the car on the south straight" />
            {loading && <div className="acLoading acMiOverlay">Building the lot and placing three pieces of garbage…</div>}
            {done && (
              <div className="acMiDone">
                <p>
                  {allThree
                    ? "All three collected. No detections: the guidance node publishes nothing, so the car holds its last command (zero)."
                    : `${collected} of 3 collected. No detections in view: the guidance node publishes nothing, so the car holds its last command (zero).`}
                </p>
                <button className="acBtn acBtnPrimary" onClick={() => restart(mode)}>
                  Restart
                </button>
              </div>
            )}
          </div>
          <div className="acMiHud acMono">
            <span>
              t <b>{sim ? sim.t.toFixed(1) : "0.0"} s</b>
            </span>
            <span className={`acMiHudState acMiHud_${state}`}>
              {STATE_TEXT[state]}
              {state === "avoid" ? ` ${step}/5` : ""}
            </span>
            <span>
              /cmd_vel linear.x <b>{sim ? sim.cmd.linear.toFixed(3) : "0.000"}</b> angular.z <b>{sim ? sim.cmd.angular.toFixed(3) : "0.000"}</b>
            </span>
            <span>
              collected <b>{collected}/3</b>
            </span>
          </div>
          <div className="acMiLegend">
            <span>
              <i className="acMiSwatch acMiSwDrive" /> path under PID
            </span>
            <span>
              <i className="acMiSwatch acMiSwAvoid" /> path during the steps
            </span>
            <span>
              <i className="acMiSwatch acMiSwPlan" /> steps 1 to 5 in Twist units
            </span>
          </div>
          <div className="acNote acMiModeNote">
            {mode === "twist" ? (
              <>
                <b>In Twist units (as written).</b> The steps read linear.x in m/s and angular.z in rad/s, the way the step list
                describes them, and the car is drawn pivoting in place for steps 1 and 4.
              </>
            ) : (
              <>
                <b>Through the course actuator.</b> Every /cmd_vel message is read the way the PID path uses it: linear.x as throttle
                and angular.z as steering from -1 to 1, positive right. Steps 1 and 4 then only swing the wheels, and step 2 at
                throttle 0.15 covers more than 0.4 m, so the next item can pass 200 px mid-maneuver: check_for_obstacles still runs,
                starts a new sweep, and the car keeps its last command until that sweep ends.
              </>
            )}{" "}
            The steps are open loop: timed from distance / speed, with no odometry. Steps 1 and 4 command angular.z with linear.x = 0,
            a turn in place for a differential-drive robot, which an Ackermann car like this one can only express as a steering swing
            while stopped. They also use ROS&apos;s negative-is-right sign, while the PID path uses the course actuator&apos;s
            positive-is-right.
          </div>
        </div>

        <div className="acMiSide">
          <div className="acMiCam acScreen">
            <div className="acMiCamBar acMono">
              <span>Frame</span>
              <span className="acMiCamSub">cv2.imshow, camera_driver2.py</span>
            </div>
            <div ref={camWrapRef} className="acMiCamWrap">
              <canvas ref={camCanvasRef} aria-label="annotated OAK-D frame" />
            </div>
            <div className="acMiCamFoot acMono">
              {sim?.lastDetect?.flag ? (
                <>
                  /object_detections/centroid <b>{sim.lastDetect.centroid!.toFixed(3)}</b> · target {sim.lastDetect.targetIndex + 1} of{" "}
                  {sim.lastDetect.preds.length}
                </>
              ) : (
                <>/object_detections/flag false · nothing published</>
              )}
            </div>
          </div>
          <div className="acMiCard">{run ? <WidthGauge run={run} /> : <div className="acMiPlaceholder" />}</div>
        </div>
      </div>

      <div className="acMiMid">
        <div className="acMiCard">
          <div className="acMiCardHead">
            <span className="acMiLabel">guidance node state</span>
            <span className="acChip">mirrors check_for_obstacles + the 0.1 s timer</span>
          </div>
          <StateMachine state={state} step={step} progress={Math.max(0, stepProgress)} idle={noDetection} />
          <p className="acMiCaption">
            STOPPED and SWEEPING begin in the same width callback: obstacle_too_large and is_sweeping are set together, and the
            controller answers every detection with zero throttle until the sweep ends. STOPPED is lit while the car coasts to a
            halt.
          </p>
        </div>
        <div className="acMiCard">
          <div className="acMiCardHead">
            <span className="acMiLabel">scoop arm servo</span>
            <span className="acChip">servo_sweeper.py · PCA9685 ch 0 · 50 Hz · I2C</span>
          </div>
          <ServoDial angle={sim?.servoAngle ?? 0} phase={run?.servoPhase ?? "idle"} />
          <p className="acMiCaption">
            Spawned with subprocess.Popen, stdout and stderr to DEVNULL, so its own log lines never reach the console below.
            The guidance node terminates it at 5 s; by then it has disabled the PWM and shut down.
          </p>
        </div>
      </div>

      <div className="acMiCard">
        <div className="acMiCardHead">
          <span className="acMiLabel">/cmd_vel during the maneuver</span>
          <span className="acChip">mirrors execute_avoidance_step</span>
        </div>
        {run ? <CommandTimeline run={run} /> : <div className="acMiPlaceholder" />}
      </div>

      {planner ? <LogTerminal planner={planner} count={planner.logs.length} /> : <div className="acMiTerm acScreen acMiPlaceholder" />}

      <div className="acNote">
        Detections here are a stand-in: the garbage&apos;s outline projected into the virtual camera, because the Roboflow model
        (garbage-dxrv3 v3) runs on the OAK-D Lite&apos;s own processor. The scoop collecting the item as the arm reaches 100° is
        per David. The state machine, the timings, the servo maths and every /cmd_vel command are the nodes&apos; own code, ported
        and fixture-tested against the originals.
      </div>
    </div>
  );
}
