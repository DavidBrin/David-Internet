"use client";

/**
 * #vex -- the VEXcode VR simulator. Prefix mV.
 *
 * Drives programs.ts's six generator-based ports of the vexcode.ts API
 * against a small rAF loop: each frame either integrates manual "drive it
 * yourself" input, or steps the active Runner by dtMs*speed of sim time, then
 * redraws the canvas (render.ts) and -- only when the highlighted line, brain
 * output, or run state actually changed -- bumps a small React state counter
 * so the listing/brain/controls re-render. The canvas itself is drawn
 * imperatively every frame; no per-frame React state for robot pose.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createVexApi, Sim, Runner, type Rng } from "./vexcode";
import { PROGRAM_CONFIGS, makeRunRng } from "./programs";
import { drawScene, ensureCanvasSize } from "./render";
import "./vex.css";

interface ListingLine {
  d: number;
  t: string;
}

interface ProgramJson {
  id: string;
  title: string;
  kind: "blocks" | "python";
  playground: string;
  screenshot: string | null;
  blurb: string;
  listing: ListingLine[];
  python?: string;
  reconstructed?: boolean;
}

interface ProgramsResponse {
  programs: ProgramJson[];
}

const ACCENT = "#F59E0B";
const SPEEDS = [1, 3, 8] as const;
type Speed = (typeof SPEEDS)[number];
const FRONT_SENSOR_PROGRAMS = new Set(["maze", "random", "artcanvas"]);
const MANUAL_SPEED_MM_S = 260;
const MANUAL_TURN_DEG_S = 160;
const DEFAULT_PROGRAM = "maze";
const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export default function VexPanel() {
  const [data, setData] = useState<ProgramsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [programId, setProgramId] = useState(DEFAULT_PROGRAM);
  const [speed, setSpeed] = useState<Speed>(1);
  const [driveYourself, setDriveYourself] = useState(false);
  const [uiTick, setUiTick] = useState(0);

  const simRef = useRef<Sim | null>(null);
  const runnerRef = useRef<Runner | null>(null);
  const runCounterRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const lastSizeRef = useRef<{ w: number; h: number } | null>(null);
  const pressedRef = useRef<Set<string>>(new Set());
  const runningRef = useRef(false);
  const driveYourselfRef = useRef(false);
  const speedRef = useRef<number>(1);
  const programIdRef = useRef(programId);
  const prevLineRef = useRef<number | null>(null);
  const prevBrainLenRef = useRef(0);
  const prevRunningRef = useRef(false);
  const prevFinishedRef = useRef(false);
  const autoRanRef = useRef(false);

  useEffect(() => {
    driveYourselfRef.current = driveYourself;
  }, [driveYourself]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    programIdRef.current = programId;
  }, [programId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/demos/modeling/vex/programs.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: ProgramsResponse) => {
        if (!cancelled) setData(j);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** (Re)build a fresh Sim + Runner for `id`, optionally starting it running
   * immediately (auto-run / Run button). Idle loads (program picker, mount)
   * pass auto=false so the field just shows the robot parked at its start. */
  const startFresh = useCallback((id: string, auto: boolean, speedOverride?: Speed) => {
    const cfg = PROGRAM_CONFIGS[id];
    if (!cfg) return;
    const sim = new Sim(cfg.world, cfg.startX, cfg.startY, cfg.startHeading);
    const vapi = createVexApi(sim);
    const rng: Rng = makeRunRng(runCounterRef.current);
    runCounterRef.current += 1;
    const gen = cfg.createGenerator(vapi, rng);
    simRef.current = sim;
    runnerRef.current = new Runner(gen, sim);
    runningRef.current = auto;
    lastSizeRef.current = null;
    prevLineRef.current = null;
    prevBrainLenRef.current = 0;
    prevRunningRef.current = auto;
    prevFinishedRef.current = false;
    if (speedOverride !== undefined) {
      speedRef.current = speedOverride;
      setSpeed(speedOverride);
    }
    setUiTick((t) => t + 1);
  }, []);

  // idle (re)load whenever the selected program changes (including on mount)
  useEffect(() => {
    startFresh(programId, false);
  }, [programId, startFresh]);

  // auto-run the maze once, the first time the panel is ~30% visible.
  // Depends on `data` because the element carrying wrapRef only renders after
  // programs.json loads - on mount the ref is still null and the effect must
  // re-run once the field exists (this was a real missed-auto-run bug).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting || entry.intersectionRatio < 0.3) return;
        if (autoRanRef.current) return;
        autoRanRef.current = true;
        io.disconnect();
        startFresh(DEFAULT_PROGRAM, true, 3);
      },
      { threshold: [0, 0.3, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [startFresh, data]);

  // the animation loop: mounted once, reads everything through refs so it
  // never needs to be torn down/rebuilt when program/speed/mode change.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(now - last, 50);
      last = now;

      const sim = simRef.current;
      const runner = runnerRef.current;
      if (!sim) return;

      if (driveYourselfRef.current) {
        const keys = pressedRef.current;
        if (keys.has("ArrowUp")) sim.moveAlongHeading(1, (MANUAL_SPEED_MM_S * dt) / 1000);
        if (keys.has("ArrowDown")) sim.moveAlongHeading(-1, (MANUAL_SPEED_MM_S * dt) / 1000);
        if (keys.has("ArrowLeft")) sim.turnBy(-(MANUAL_TURN_DEG_S * dt) / 1000);
        if (keys.has("ArrowRight")) sim.turnBy((MANUAL_TURN_DEG_S * dt) / 1000);
      } else if (runningRef.current && runner && !runner.finished) {
        runner.tick(dt * speedRef.current);
        if (runner.finished) runningRef.current = false;
      }

      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (canvas && wrap) {
        const { w, h } = ensureCanvasSize(canvas, wrap, lastSizeRef.current);
        lastSizeRef.current = { w, h };
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const showRay = FRONT_SENSOR_PROGRAMS.has(programIdRef.current);
          drawScene(ctx, w, h, sim.world, sim.robot, {
            accent: ACCENT,
            showSensorRay: showRay,
            sensorDistMm: showRay ? sim.distanceGetDistance() : null,
          });
        }
      }

      const line = runner ? runner.currentLine : null;
      const brainLen = sim.brain.length;
      const isRunning = runningRef.current;
      const isFinished = runner ? runner.finished : false;
      if (
        line !== prevLineRef.current ||
        brainLen !== prevBrainLenRef.current ||
        isRunning !== prevRunningRef.current ||
        isFinished !== prevFinishedRef.current
      ) {
        prevLineRef.current = line;
        prevBrainLenRef.current = brainLen;
        prevRunningRef.current = isRunning;
        prevFinishedRef.current = isFinished;
        setUiTick((t) => t + 1);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleRun = useCallback(() => {
    setDriveYourself(false);
    driveYourselfRef.current = false;
    startFresh(programIdRef.current, true);
  }, [startFresh]);

  const handleReset = useCallback(() => {
    startFresh(programIdRef.current, false);
  }, [startFresh]);

  const toggleDriveYourself = useCallback(() => {
    setDriveYourself((v) => {
      const next = !v;
      driveYourselfRef.current = next;
      if (next) runningRef.current = false;
      setUiTick((t) => t + 1);
      return next;
    });
  }, []);

  const selectProgram = useCallback((id: string) => {
    setDriveYourself(false);
    driveYourselfRef.current = false;
    setProgramId(id);
  }, []);

  const onCanvasKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!driveYourselfRef.current) return;
    if (ARROW_KEYS.has(e.key)) {
      e.preventDefault();
      pressedRef.current.add(e.key);
    } else if ((e.key === "p" || e.key === "P") && !e.repeat) {
      const sim = simRef.current;
      if (sim) {
        sim.setPen(sim.robot.penDown ? "up" : "down");
        setUiTick((t) => t + 1);
      }
    }
  }, []);

  const onCanvasKeyUp = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    pressedRef.current.delete(e.key);
  }, []);

  const activeProgram = data?.programs.find((p) => p.id === programId) ?? null;
  const runner = runnerRef.current;
  const sim = simRef.current;
  const currentLine = runner ? runner.currentLine : null;
  const isRunning = runningRef.current;
  const isFinished = runner ? runner.finished && !isRunning : false;
  const brainLines = sim ? sim.brain : [];

  return (
    <div className="mdPanel mVPanel">
      <h2 className="mdH2">The VEX robot simulator</h2>
      <p className="mdIntro">
        A TypeScript port of the VEXcode VR API (vexcode.ts) drives these six programs for real: dead reckoning,
        wall-following, pen trails, and sensor arithmetic. Pick a program, hit Run, or drive the field yourself with
        the arrow keys.
      </p>

      {error && <p className="mdNote">Could not load programs.json ({error}).</p>}

      {data && (
        <>
          <div className="mdRow mVPicker">
            {data.programs.map((p) => (
              <button
                key={p.id}
                type="button"
                className="mdBtn mVChipBtn"
                data-active={programId === p.id}
                onClick={() => selectProgram(p.id)}
              >
                {p.title}
                {p.reconstructed && <span className="mdChip mVReconChip">reconstructed</span>}
              </button>
            ))}
          </div>

          <div className="mVLayout">
            <div className="mVSimCol">
              <div
                className="mVCanvasWrap"
                ref={wrapRef}
                tabIndex={0}
                role="application"
                aria-label="VEX field. When Drive it yourself is on, use the arrow keys to drive and P to toggle the pen."
                onKeyDown={onCanvasKeyDown}
                onKeyUp={onCanvasKeyUp}
              >
                <canvas ref={canvasRef} className="mVCanvas" />
              </div>

              <div className="mdRow mVControls">
                <button type="button" className="mdBtn mdBtnPrimary" onClick={handleRun} disabled={isRunning}>
                  {isRunning ? "Running..." : "Run"}
                </button>
                <button type="button" className="mdBtn" onClick={handleReset}>
                  Reset
                </button>
                <span className="mVSpeedGroup">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="mdBtn mVSpeedBtn"
                      data-active={speed === s}
                      onClick={() => setSpeed(s)}
                    >
                      {s}x
                    </button>
                  ))}
                </span>
                <button type="button" className="mdBtn" data-active={driveYourself} onClick={toggleDriveYourself}>
                  Drive it yourself
                </button>
              </div>

              <div className="mVBrain">
                <div className="mVBrainHead">brain screen</div>
                <div className="mVBrainBody">
                  {brainLines.length === 0 && !isFinished && <span className="mVBrainDim">(no output yet)</span>}
                  {brainLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                  {isFinished && <div className="mVBrainDone">-- run finished --</div>}
                </div>
              </div>
            </div>

            <div className="mVListingCol">
              <div className="mVListing mdMono">
                {activeProgram?.listing.map((ln, i) => (
                  <div
                    key={i}
                    className="mVListingLine"
                    data-current={i === currentLine}
                    style={{ paddingLeft: 8 + ln.d * 14 }}
                  >
                    {ln.t.length > 0 ? ln.t : " "}
                  </div>
                ))}
              </div>

              {activeProgram?.screenshot && (
                <figure className="mVShot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/demos/modeling/${activeProgram.screenshot}`} alt={`${activeProgram.title} original run`} />
                  <figcaption>the original block program</figcaption>
                </figure>
              )}
            </div>
          </div>

          {activeProgram && <p className="mdNote">{activeProgram.blurb}</p>}
          <p className="mdNote">Playgrounds are approximations drawn for this page - no VEX assets copied.</p>
          {activeProgram?.reconstructed && (
            <p className="mdNote">This block file did not survive - the listing above is reconstructed from the screenshot.</p>
          )}
        </>
      )}
    </div>
  );
}
