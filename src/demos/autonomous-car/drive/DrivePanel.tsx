"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNearViewport } from "../ui/useFitCanvas";
import CameraInsetRaw from "./CameraInset";
import LotViewRaw from "./LotView";
import StripChartsRaw from "./StripCharts";
import ThrottlePlotRaw from "./ThrottlePlot";
import { TEAM_GAINS, useDriveSim, type Gains, type Readout } from "./useDriveSim";
import "./drive.css";

const LotView = memo(LotViewRaw);
const CameraInset = memo(CameraInsetRaw);
const StripCharts = memo(StripChartsRaw);
const ThrottlePlot = memo(ThrottlePlotRaw);

interface Preset {
  id: string;
  label: string;
  gains: Gains;
  note: string;
}

const PRESETS: Preset[] = [
  {
    id: "team",
    label: "Team's gains (Kp 0.2, Kd 0.1)",
    gains: TEAM_GAINS,
    note: "racer_calibration2.yaml: Kp 0.2, Ki 0, Kd 0.1, error_threshold 0.15, throttle 0.2 on the straights falling to 0.1 at |e| = 1.",
  },
  {
    id: "p",
    label: "P only",
    gains: { ...TEAM_GAINS, Kd_steering: 0 },
    note: "Kd 0. The spikes in angular.z at every dash edge disappear; the path itself barely changes.",
  },
  {
    id: "highkp",
    label: "High Kp (0.8)",
    gains: { ...TEAM_GAINS, Kp_steering: 0.8 },
    note: "Kp 0.8. The car rides the tape much closer (the curve needs a smaller |e| to hold the same steering) and the derivative spikes at dash edges grow.",
  },
  {
    id: "flat",
    label: "No throttle schedule (0.2 flat)",
    gains: { ...TEAM_GAINS, min_throttle: 0.2 },
    note: "min_throttle 0.2, the default declared in lane_guidance_node3.py before the yaml set 0.1: linear.x stays 0.2 (1 m/s here) through the curves.",
  },
];

const same = (a: Gains, b: Gains) => (Object.keys(a) as (keyof Gains)[]).every((k) => Math.abs(a[k] - b[k]) < 1e-9);

interface SliderDef {
  key: keyof Gains;
  label: string;
  min: number;
  max: number;
  step: number;
  digits: number;
  hint?: string;
}

const SLIDERS: SliderDef[] = [
  { key: "Kp_steering", label: "Kp_steering", min: 0, max: 1.2, step: 0.01, digits: 2, hint: "angular.z per unit of e" },
  { key: "Ki_steering", label: "Ki_steering", min: 0, max: 0.5, step: 0.01, digits: 2, hint: "the node clamps the integral to ±1e-8, so Ki does nothing" },
  { key: "Kd_steering", label: "Kd_steering", min: 0, max: 0.5, step: 0.01, digits: 2, hint: "multiplies (e minus previous e) / Ts" },
  { key: "max_throttle", label: "max_throttle", min: 0.05, max: 0.4, step: 0.01, digits: 2, hint: "linear.x while |e| < error_threshold (x5 m/s here)" },
  { key: "min_throttle", label: "min_throttle", min: 0, max: 0.4, step: 0.01, digits: 2, hint: "linear.x at |e| = 1" },
  { key: "error_threshold", label: "error_threshold", min: 0, max: 0.6, step: 0.01, digits: 2, hint: "|e| where the throttle starts to fall" },
];

const SPEEDS = [1, 2, 4] as const;

function fmtS(t: number) {
  return `${t.toFixed(1)} s`;
}

function Metrics({ r, speed }: { r: Readout | null; speed: number }) {
  const cm = (m: number) => `${(m * 100).toFixed(1)} cm`;
  const behind = r && r.achieved < speed * 0.85;
  return (
    <div className="acDrMetrics">
      <div className="acDrTile">
        <span className="acDrTileK">Lap {r ? r.laps + 1 : 1}</span>
        <span className="acDrTileV acMono">{r ? fmtS(r.lapElapsed) : "0.0 s"}</span>
        <span className="acDrTileS">of about 90 m</span>
      </div>
      <div className="acDrTile">
        <span className="acDrTileK">Last lap</span>
        <span className="acDrTileV acMono">{r?.lastLap ? fmtS(r.lastLap.time) : "not yet"}</span>
        <span className="acDrTileS acMono">
          {r?.lastLap ? `mean ${cm(r.lastLap.mean)}, max ${cm(r.lastLap.max)}` : "simulated seconds"}
        </span>
      </div>
      <div className="acDrTile">
        <span className="acDrTileK">Mean |CTE| this lap</span>
        <span className="acDrTileV acMono">{r ? cm(r.mean) : "0.0 cm"}</span>
        <span className="acDrTileS acMono">now {r && Number.isFinite(r.cte) ? `${r.cte >= 0 ? "+" : ""}${(r.cte * 100).toFixed(1)} cm` : "off course"}</span>
      </div>
      <div className="acDrTile">
        <span className="acDrTileK">Max |CTE| this lap</span>
        <span className="acDrTileV acMono">{r ? cm(r.max) : "0.0 cm"}</span>
        <span className="acDrTileS">lost past 28 cm</span>
      </div>
      <div className="acDrTile">
        <span className="acDrTileK">Speed</span>
        <span className="acDrTileV acMono">{r ? `${r.v.toFixed(2)} m/s` : "0.00 m/s"}</span>
        <span className={`acDrTileS acMono${behind ? " acDrWarn" : ""}`}>
          {behind ? `sim ${r!.achieved.toFixed(1)}x (CPU bound)` : `sim ${speed}x`}
          {r && r.lostCount > 0 ? `, ${r.lostCount} lost` : ""}
        </span>
      </div>
    </div>
  );
}

export default function DrivePanel() {
  const [gains, setGains] = useState<Gains>(TEAM_GAINS);
  const [hz, setHz] = useState<10 | 20>(10);
  const [tsTrue, setTsTrue] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [follow, setFollow] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(true);

  const { ref: nearRef, near } = useNearViewport<HTMLDivElement>("300px");
  const rootEl = useRef<HTMLDivElement | null>(null);
  const autoStarted = useRef(false);

  const { world, readout, lost, reset, engine } = useDriveSim({
    gains,
    hz,
    tsTrue,
    speed,
    running: playing && visible && near,
    load: near,
  });

  // auto-start once, the first time the panel comes near the viewport
  useEffect(() => {
    if (near && world && !autoStarted.current) {
      autoStarted.current = true;
      setPlaying(true);
    }
  }, [near, world]);

  // phones: the whole lot is too small to see the car, so start zoomed in
  useEffect(() => {
    if (window.innerWidth < 600) setFollow(true);
  }, []);

  // pause while the panel is far off-screen
  useEffect(() => {
    const el = rootEl.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setVisible(es.some((e) => e.isIntersecting)), { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const setRoot = useCallback(
    (el: HTMLDivElement | null) => {
      rootEl.current = el;
      nearRef(el);
    },
    [nearRef],
  );

  // redraw the static views when a parameter changes while paused
  useEffect(() => {
    for (const f of engine.bus.current) f();
  }, [gains, follow, engine]);

  const setGain = (key: keyof Gains, v: number) =>
    setGains((g) => {
      const n = { ...g, [key]: v };
      // keep min <= max so the schedule stays the line the node computes
      if (key === "max_throttle" && n.min_throttle > v) n.min_throttle = v;
      if (key === "min_throttle" && n.max_throttle < v) n.max_throttle = v;
      return n;
    });

  const active = PRESETS.find((p) => same(p.gains, gains));
  const effKd = gains.Kd_steering * (tsTrue ? 1 : (1 / hz) / (1 / 20));

  return (
    <div ref={setRoot} className="acPanel acDr">
      <div className="acDrBar">
        <div className="acRow">
          <button type="button" className="acBtn acBtnPrimary acDrPlay" onClick={() => setPlaying((p) => !p)} disabled={!world}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="acBtn" onClick={reset} disabled={!world}>
            Reset car
          </button>
        </div>
        <div className="acDrSeg" role="group" aria-label="View">
          <button type="button" className="acBtn" data-active={!follow} onClick={() => setFollow(false)}>
            Whole lot
          </button>
          <button type="button" className="acBtn" data-active={follow} onClick={() => setFollow(true)}>
            Follow car
          </button>
        </div>
        <div className="acDrSeg" role="group" aria-label="Simulation speed">
          <span className="acDrSegK">Sim speed</span>
          {SPEEDS.map((s) => (
            <button key={s} type="button" className="acBtn" data-active={speed === s} onClick={() => setSpeed(s)}>
              {s}x
            </button>
          ))}
        </div>
        <div className="acDrSeg" role="group" aria-label="Camera rate">
          <span className="acDrSegK">Camera</span>
          {([10, 20] as const).map((r) => (
            <button key={r} type="button" className="acBtn" data-active={hz === r} onClick={() => setHz(r)}>
              {r} Hz
            </button>
          ))}
        </div>
      </div>

      <div className="acDrPresetBar">
        <div className="acDrPresets" role="group" aria-label="Presets">
          <span className="acDrSegK">Presets</span>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="acBtn" data-active={active?.id === p.id} onClick={() => setGains(p.gains)}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="acDrPresetNote">{active ? active.note : "Custom gains. The node reads its parameters once at startup; here they apply on the next frame."}</p>
      </div>

      <div className="acDrTop">
        <div className="acDrMapCol">
          <div className="acDrMapWrap">
            {world ? (
              <LotView world={world} engine={engine} follow={follow} />
            ) : (
              <div className="acDrMapPlaceholder acLoading">{near ? "Painting the lot and baking the tape texture..." : "The simulation starts when this section scrolls into view."}</div>
            )}
            {lost && (
              <div className="acDrLost" role="status">
                <strong>{lost.title}</strong>
                <span>{lost.why}</span>
                <em>Back to the start line in 1.5 s.</em>
              </div>
            )}
          </div>
        </div>

        <div className="acDrSide">
          <div className="acDrCapRow">
            <span className="acDrH">Onboard camera</span>
            <span className="acChip">lane_detection_node</span>
          </div>
          {world ? <CameraInset engine={engine} /> : <div className="acDrCamPlaceholder acScreen" />}
          <ul className="acDrKey">
            <li>
              <i className="acDrSw acDrSwBand" /> crop band, rows 240 to 336
            </li>
            <li>
              <i className="acDrSw acDrSwRed" /> threshold lines (0.16)
            </li>
            <li>
              <i className="acDrSw acDrSwCenter" /> camera_centerline 0.55
            </li>
            <li>
              <i className="acDrSw acDrSwDot" /> tracked centroid
            </li>
          </ul>
        </div>
      </div>

      <Metrics r={readout} speed={speed} />

      <div className="acDrBottom">
        <div className="acDrChartsCol">
          <div className="acDrCapRow">
            <span className="acDrH">Last 20 s of the loop</span>
            <span className="acDrSmall acDrInline">shaded: ±error_threshold; red ticks: frames with no /centroid message</span>
          </div>
          {world ? <StripCharts engine={engine} /> : <div className="acDrChartsPlaceholder" />}
        </div>

        <div className="acDrSide">
          <div className="acDrCapRow">
            <span className="acDrH">Throttle schedule</span>
            <span className="acChip">controller()</span>
          </div>
          {world ? <ThrottlePlot engine={engine} gains={gains} /> : <div className="acDrSchedPlaceholder" />}
          <p className="acDrSmall">
            Flat at max_throttle while |e| is under error_threshold, then a straight line down to min_throttle at |e| = 1. The dot is the
            last /centroid value and the linear.x it produced.
          </p>

          <div className="acDrTs">
            <span className="acDrSegK">Derivative timestep</span>
            <div className="acDrPresets">
              <button type="button" className="acBtn" data-active={!tsTrue} onClick={() => setTsTrue(false)}>
                Ts fixed at 1/20 s (as written)
              </button>
              <button type="button" className="acBtn" data-active={tsTrue} onClick={() => setTsTrue(true)}>
                Ts = true frame period ({(1 / hz).toFixed(2)} s at {hz} Hz)
              </button>
            </div>
            <p className="acDrSmall">
              The node divides the change in error by Ts = 1/20 s, but frames arrive from a 10 Hz timer, so the derivative term is twice as
              strong as Kd says. Measured per real frame period, Kd is now <b className="acMono">{effKd.toFixed(2)}</b>
              {hz === 20 ? " (at 20 Hz the two settings agree)." : "."}
            </p>
          </div>
        </div>
      </div>

      <div className="acDrControls">
        <div className="acDrCapRow">
          <span className="acDrH">lane_guidance_node parameters</span>
          <span className="acDrSmall acDrInline">applied live to the running node</span>
        </div>
        <div className="acDrSliders">
          {SLIDERS.map((s) => (
            <label key={s.key} className="acDrSlider">
              <span className="acDrSliderName acMono">{s.label}</span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={gains[s.key]}
                onChange={(e) => setGain(s.key, Number(e.target.value))}
              />
              <span className="acDrSliderVal acMono">{gains[s.key].toFixed(s.digits)}</span>
              <span className="acDrSliderHint">{s.hint ?? ""}</span>
            </label>
          ))}
        </div>
      </div>

      <p className="acNote">
        The car is a kinematic bicycle model with assumed constants, because the repository has no vehicle model: 0.33 m wheelbase, 26 degree
        steering lock at |angular.z| = 1, 5 m/s per unit of linear.x, a 0.3 s speed lag and an 80 ms steering lag. The controller and the lane
        code are David&apos;s nodes (lane_guidance_node3.py, lane_detection_node.py) ported line for line and fixture-tested against the
        originals. The course is a synthetic stadium loop (20 m straights, 8 m radius ends, about 90 m a lap) sized for the team&apos;s gain;
        the camera sees it through an assumed OAK-D Lite mount, and the inset shows the node&apos;s real crop pixels over a half-resolution
        backdrop.
      </p>
    </div>
  );
}
