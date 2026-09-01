"use client";

/**
 * The house — hero panel of the HardHack demo.
 *
 * A schematic one-room cutaway: floor, roof, a left wall with the front door
 * (hinged, draggable, drawn at sim.doorAngleDeg), a window, the HC-SR04 beside
 * the frame with its detection cone, a servo lock on the door, buzzer + status
 * LEDs and the boards on a back-wall table, and — iteration 3 only — a WS2812
 * strip along the roofline. A draggable intruder figure walks a marked cm path
 * toward the sensor. A wiring overlay toggle draws the real pin map over it,
 * and a mini serial console mirrors the live sim log.
 *
 * Layout is intentionally schematic (see hardhack meta / spec: "the design of
 * the house isn't important") — coordinates below are illustrative, not to
 * scale. Physical realism was traded for a picture that reads clearly at a
 * glance and animates well.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSimHandle, useSimTick } from "../sim/store";
import { SecurityState, STATE_NAMES } from "../sim/core";
import { WIRING, type ComponentWiring } from "../sim/wiring";
import "./house.css";

// ------------------------------------------------------------------ layout

const VB_W = 960;
const VB_H = 420;

// Wall / room
const WALL_X = 122;
const FLOOR_Y = 380;
const CEIL_Y = 72;
const ROOM_R = 850;

// Door
const DOOR_TOP_Y = 182; // top of the doorway opening (frame lintel)
const HINGE = { x: WALL_X, y: FLOOR_Y };
const DOOR_LEN = 178;

// Sensor
const SENSOR = { x: 152, y: 196 };
const CONE_HALF_ANGLE = 26; // degrees
const CONE_DIR = { x: -0.28, y: 1 }; // aims down-and-out across the doorway toward the approach path

// VCNL4040
const VCNL = { x: 100, y: 262 };

// Window
const WINDOW = { x: WALL_X - 6, y: 96, w: 14, h: 56 };

// Table + boards
const TABLE = { x: 606, y: 356, w: 232, h: 10 };
const BOARD_W = 66;
const BOARD_H = 36;
const BOARD_Y = 316;

const BOARD_TARGETS: Record<string, Record<1 | 2 | 3, { x: number; y: number; opacity: number }>> = {
  "Arduino Uno": {
    1: { x: 648, y: BOARD_Y, opacity: 1 },
    2: { x: 648, y: BOARD_Y, opacity: 1 },
    3: { x: 648, y: 400, opacity: 0 },
  },
  "ESP32-S3-Mini": {
    1: { x: 734, y: BOARD_Y, opacity: 1 },
    2: { x: 734, y: 400, opacity: 0 },
    3: { x: 688, y: BOARD_Y, opacity: 1 },
  },
  "Arduino R4 WiFi": {
    1: { x: 734, y: 400, opacity: 0 },
    2: { x: 734, y: BOARD_Y, opacity: 1 },
    3: { x: 734, y: 400, opacity: 0 },
  },
};

// Buzzer + LEDs
const BUZZER = { x: 588, y: 348 };
const LED_GREEN = { x: 578, y: 322 };
const LED_RED = { x: 598, y: 322 };

// UART link chip (iterations 1–2 only — no physical icon, just an overlay anchor)
const UART_ANCHOR = { x: 700, y: 296 };

// LED strip (iteration 3)
const STRIP_Y = 74;
const STRIP_X0 = 140;
const STRIP_X1 = 820;
const STRIP_DOTS = 16;

// Intruder path (0 cm at the sensor threshold, 200+ cm outside)
const PATH_Y = 344;
const PATH_X_NEAR = 300; // 0 cm
const PATH_X_FAR = 40; // 200 cm
const PATH_RANGE_CM = 200;

function xToCm(x: number): number {
  const t = (PATH_X_NEAR - x) / (PATH_X_NEAR - PATH_X_FAR);
  return Math.max(0, t * PATH_RANGE_CM);
}
function cmToX(cm: number): number {
  const t = Math.min(1.15, cm / PATH_RANGE_CM);
  return PATH_X_NEAR - t * (PATH_X_NEAR - PATH_X_FAR);
}

function componentPos(id: string, doorAngleDeg: number): { x: number; y: number } {
  if (id === "servo") {
    const a = (doorAngleDeg * Math.PI) / 180;
    const frac = 0.3;
    return { x: HINGE.x + Math.sin(a) * DOOR_LEN * frac, y: HINGE.y - Math.cos(a) * DOOR_LEN * frac };
  }
  switch (id) {
    case "hcsr04":
      return SENSOR;
    case "vcnl4040":
      return VCNL;
    case "buzzer":
      return BUZZER;
    case "leds":
      return { x: (LED_GREEN.x + LED_RED.x) / 2, y: LED_GREEN.y };
    case "uart":
      return UART_ANCHOR;
    case "ledstrip":
      return { x: (STRIP_X0 + STRIP_X1) / 2, y: STRIP_Y };
    default:
      return { x: 480, y: 210 };
  }
}

function boardAnchor(name: string, iteration: 1 | 2 | 3): { x: number; y: number } {
  const t = BOARD_TARGETS[name]?.[iteration];
  if (!t) return { x: 720, y: BOARD_Y };
  return { x: t.x + BOARD_W / 2, y: t.y + BOARD_H / 2 };
}

// ------------------------------------------------------------------ helpers

function svgPointFromEvent(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const loc = pt.matrixTransform(ctm.inverse());
  return { x: loc.x, y: loc.y };
}

function wedgePath(apex: { x: number; y: number }, dir: { x: number; y: number }, lenPx: number, halfAngleDeg: number): string {
  const baseAngle = Math.atan2(dir.y, dir.x);
  const half = (halfAngleDeg * Math.PI) / 180;
  const a1 = baseAngle - half;
  const a2 = baseAngle + half;
  const p1 = { x: apex.x + Math.cos(a1) * lenPx, y: apex.y + Math.sin(a1) * lenPx };
  const p2 = { x: apex.x + Math.cos(a2) * lenPx, y: apex.y + Math.sin(a2) * lenPx };
  return `M ${apex.x.toFixed(1)} ${apex.y.toFixed(1)} L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${lenPx.toFixed(1)} ${lenPx.toFixed(1)} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} Z`;
}

// ------------------------------------------------------------------ component

export default function HousePanel() {
  const sim = useSimTick();
  const { actions } = useSimHandle();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const [wiringOn, setWiringOn] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragRef = useRef<"door" | "intruder" | null>(null);

  const iteration = sim.iteration;
  const wiring = WIRING[iteration];
  const isAlert = sim.state === SecurityState.ALERT && sim.alarmOn;
  const doorAngle = sim.doorAngleDeg;

  // ---- pointer drag (door + intruder) ----
  const onPointerMoveWindow = useCallback(
    (e: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg || !dragRef.current) return;
      const p = svgPointFromEvent(svg, e.clientX, e.clientY);
      if (dragRef.current === "door") {
        const dx = p.x - HINGE.x;
        const dy = HINGE.y - p.y;
        let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
        deg = Math.max(0, Math.min(90, deg));
        actions.setDoorAngle(deg);
      } else if (dragRef.current === "intruder") {
        const cm = xToCm(p.x);
        actions.setIntruder(cm <= PATH_RANGE_CM, cm);
      }
    },
    [actions],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMoveWindow);
    window.removeEventListener("pointerup", endDrag);
  }, [onPointerMoveWindow]);

  const startDrag = useCallback(
    (which: "door" | "intruder") => (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = which;
      window.addEventListener("pointermove", onPointerMoveWindow);
      window.addEventListener("pointerup", endDrag, { once: true });
    },
    [onPointerMoveWindow, endDrag],
  );

  useEffect(() => () => endDrag(), [endDrag]);

  // ---- console auto-follow (never scrollIntoView — it scrolls the page) ----
  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sim.serialLog.length]);

  // ---- derived visuals ----
  const doorTip = {
    x: HINGE.x + Math.sin((doorAngle * Math.PI) / 180) * DOOR_LEN,
    y: HINGE.y - Math.cos((doorAngle * Math.PI) / 180) * DOOR_LEN,
  };
  const doorOpenEnd = { x: HINGE.x + DOOR_LEN, y: HINGE.y };
  const coneLenPx = 60 + Math.min(sim.currentDistance, 130) * 1.35;
  const conePath = wedgePath(SENSOR, CONE_DIR, coneLenPx, CONE_HALF_ANGLE);
  const hornAngle = isAlert ? 55 : 0;
  const servoPos = componentPos("servo", doorAngle);

  const intruderX = sim.intruderActive ? cmToX(Math.min(sim.intruderDistCm, PATH_RANGE_CM)) : PATH_X_FAR - 40;

  const stripHue = ((sim.t / 3000) * 360) % 360;

  const hoveredComponent: ComponentWiring | undefined = hoveredId ? wiring.components.find((c) => c.id === hoveredId) : undefined;

  return (
    <div>
      <div className="hhRow">
        <button type="button" className={"hhBtn" + (wiringOn ? " hhBtnActive" : "")} data-active={wiringOn} onClick={() => setWiringOn((v) => !v)}>
          {wiringOn ? "Wiring: on" : "Wiring"}
        </button>
        <span className="hhLabel">Iteration {iteration}</span>
        <span className="hhNote">{wiring.title}</span>
      </div>

      <div className="hhHouseStageWrap hhCanvasWrap">
        <svg
          ref={svgRef}
          className="hhHouseSvg"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          role="img"
          aria-label="Schematic cutaway of the HardHack house"
        >
          {/* ---- floor / walls / roof ---- */}
          <rect className="hhHouseFloor" x={70} y={FLOOR_Y} width={ROOM_R - 70} height={22} />
          <line className="hhHouseFloorLine" x1={70} y1={FLOOR_Y} x2={ROOM_R} y2={FLOOR_Y} />
          <path className="hhHouseRoofLine" d={`M 70 ${CEIL_Y} L 480 26 L ${ROOM_R} ${CEIL_Y}`} />
          <line className="hhHouseRoofLine" x1={WALL_X} y1={CEIL_Y} x2={ROOM_R - 10} y2={CEIL_Y} />

          {/* left wall (with door + window openings) */}
          <rect className="hhHouseWallFill" x={WALL_X - 8} y={CEIL_Y} width={16} height={DOOR_TOP_Y - CEIL_Y} />
          <line className="hhHouseWallLine" x1={WALL_X} y1={CEIL_Y} x2={WALL_X} y2={DOOR_TOP_Y} />
          {/* door frame lintel */}
          <line className="hhHouseWallLine" x1={WALL_X - 8} y1={DOOR_TOP_Y} x2={WALL_X + 8} y2={DOOR_TOP_Y} />

          {/* window */}
          <rect className="hhHouseWindowGlass" x={WINDOW.x} y={WINDOW.y} width={WINDOW.w} height={WINDOW.h} />
          <line className="hhHouseWindowMullion" x1={WINDOW.x} y1={WINDOW.y + WINDOW.h / 2} x2={WINDOW.x + WINDOW.w} y2={WINDOW.y + WINDOW.h / 2} />

          {/* back wall */}
          <line className="hhHouseWallLine" x1={ROOM_R} y1={CEIL_Y} x2={ROOM_R} y2={FLOOR_Y} />

          {/* ---- LED strip (iteration 3) ---- */}
          {iteration === 3 &&
            Array.from({ length: STRIP_DOTS }).map((_, i) => {
              const x = STRIP_X0 + (i / (STRIP_DOTS - 1)) * (STRIP_X1 - STRIP_X0);
              const hue = (stripHue + i * 4) % 360;
              return (
                <circle
                  key={i}
                  className="hhHouseStripDot"
                  cx={x}
                  cy={STRIP_Y}
                  r={4}
                  fill={`hsl(${hue.toFixed(0)}, 90%, 55%)`}
                  style={{ filter: `drop-shadow(0 0 3px hsla(${hue.toFixed(0)},90%,55%,0.8))` }}
                />
              );
            })}

          {/* ---- intruder approach path + cm scale ---- */}
          <line className="hhHousePath" x1={PATH_X_FAR - 20} y1={PATH_Y} x2={PATH_X_NEAR + 4} y2={PATH_Y} />
          {[0, 50, 100, 150, 200].map((cm) => {
            const x = cmToX(cm);
            return (
              <g key={cm}>
                <line className="hhHouseTick" x1={x} y1={PATH_Y - 5} x2={x} y2={PATH_Y + 5} />
                <text className="hhHouseTickLabel" x={x} y={PATH_Y + 17} textAnchor="middle">
                  {cm}
                </text>
              </g>
            );
          })}

          {/* ---- sensor cone + pings ---- */}
          <path className={"hhHouseCone" + (isAlert ? " isAlert" : "")} d={conePath} />
          <circle className="hhHousePing" cx={SENSOR.x} cy={SENSOR.y} r={coneLenPx} style={{ animationDuration: `${sim.cfg.sensorIntervalMs}ms` }} />

          {/* ---- door (hinged group) ---- */}
          <g className="hhHouseDoorGroup">
            <path className="hhHouseDoorSwingArc" d={`M ${doorTip.x.toFixed(1)} ${doorTip.y.toFixed(1)} A ${DOOR_LEN} ${DOOR_LEN} 0 0 1 ${doorOpenEnd.x} ${doorOpenEnd.y}`} />
            <line className="hhHouseDoorLeaf" x1={HINGE.x} y1={HINGE.y} x2={doorTip.x} y2={doorTip.y} />
            <circle className="hhHouseHinge" cx={HINGE.x} cy={HINGE.y} r={3.5} />
            {/* servo lock, mounted on the door leaf */}
            <g transform={`translate(${servoPos.x.toFixed(1)}, ${servoPos.y.toFixed(1)})`}>
              <rect className="hhHouseServoBody" x={-6} y={-5} width={12} height={10} rx={1.5} />
              <line className="hhHouseServoHorn" x1={0} y1={0} x2={0} y2={-13} transform={`rotate(${hornAngle})`} />
            </g>
            {/* drag handle */}
            <circle
              className="hhHouseDoorHandle"
              cx={doorTip.x}
              cy={doorTip.y}
              r={8}
              onPointerDown={startDrag("door")}
            />
          </g>

          {/* ---- HC-SR04 ---- */}
          <g
            onMouseEnter={() => setHoveredId("hcsr04")}
            onMouseLeave={() => setHoveredId(null)}
          >
            <rect className="hhHouseSensorBody" x={SENSOR.x - 9} y={SENSOR.y - 6} width={18} height={12} rx={2} />
            <circle className="hhHouseSensorBody" cx={SENSOR.x - 4} cy={SENSOR.y + 6} r={3} />
            <circle className="hhHouseSensorBody" cx={SENSOR.x + 4} cy={SENSOR.y + 6} r={3} />
            <circle className="hhHouseHotspot" cx={SENSOR.x} cy={SENSOR.y} r={16} />
          </g>

          {/* ---- VCNL4040 ---- */}
          <g onMouseEnter={() => setHoveredId("vcnl4040")} onMouseLeave={() => setHoveredId(null)}>
            <rect className="hhHouseVcnl" x={VCNL.x - 5} y={VCNL.y - 5} width={10} height={10} rx={2} />
            <circle className="hhHouseHotspot" cx={VCNL.x} cy={VCNL.y} r={13} />
          </g>

          {/* ---- buzzer ---- */}
          <g onMouseEnter={() => setHoveredId("buzzer")} onMouseLeave={() => setHoveredId(null)}>
            <circle className="hhHouseBuzzerRipple isOn hhHouseBuzzerRipple" style={{ animationPlayState: isAlert ? "running" : "paused", opacity: isAlert ? undefined : 0 }} cx={BUZZER.x} cy={BUZZER.y} r={8} />
            <circle className="hhHouseBuzzer" cx={BUZZER.x} cy={BUZZER.y} r={7} />
            <circle className="hhHouseHotspot" cx={BUZZER.x} cy={BUZZER.y} r={14} />
          </g>

          {/* ---- LEDs ---- */}
          <g onMouseEnter={() => setHoveredId("leds")} onMouseLeave={() => setHoveredId(null)}>
            <circle className={"hhHouseLed" + (sim.ledGreen ? " isGreenOn" : "")} cx={LED_GREEN.x} cy={LED_GREEN.y} r={5} />
            <circle className={"hhHouseLed" + (sim.ledRed && isAlert ? " isRedStrobe" : sim.ledRed ? " isRedOn" : "")} cx={LED_RED.x} cy={LED_RED.y} r={5} />
            <circle className="hhHouseHotspot" cx={(LED_GREEN.x + LED_RED.x) / 2} cy={LED_GREEN.y} r={16} />
          </g>

          {/* ---- table + boards ---- */}
          <rect className="hhHouseTable" x={TABLE.x} y={TABLE.y} width={TABLE.w} height={TABLE.h} rx={2} />
          <line className="hhHouseTableLeg" x1={TABLE.x + 8} y1={TABLE.y + TABLE.h} x2={TABLE.x + 8} y2={FLOOR_Y} />
          <line className="hhHouseTableLeg" x1={TABLE.x + TABLE.w - 8} y1={TABLE.y + TABLE.h} x2={TABLE.x + TABLE.w - 8} y2={FLOOR_Y} />

          {Object.entries(BOARD_TARGETS).map(([name, byIter]) => {
            const t = byIter[iteration];
            return (
              <g
                key={name}
                className="hhHouseBoard"
                style={{ transform: `translate(${t.x}px, ${t.y}px)`, opacity: t.opacity }}
              >
                <rect className="hhHouseBoardBody" x={0} y={0} width={BOARD_W} height={BOARD_H} rx={4} />
                <text className="hhHouseBoardLabel" x={BOARD_W / 2} y={BOARD_H / 2 + 3} textAnchor="middle">
                  {name.length > 14 ? name.replace(/-Mini$/, "") : name}
                </text>
              </g>
            );
          })}

          {/* ---- intruder figure ---- */}
          <g
            className="hhHouseIntruder"
            transform={`translate(${intruderX.toFixed(1)}, ${PATH_Y})`}
            onPointerDown={startDrag("intruder")}
          >
            <circle className={"hhHouseIntruderBody" + (sim.intruderActive ? " isActive" : "")} cx={0} cy={-24} r={6} />
            <line className={"hhHouseIntruderBody" + (sim.intruderActive ? " isActive" : "")} x1={0} y1={-18} x2={0} y2={0} strokeWidth={5} stroke="currentColor" />
            <line className={"hhHouseIntruderBody" + (sim.intruderActive ? " isActive" : "")} x1={0} y1={0} x2={-6} y2={16} strokeWidth={5} stroke="currentColor" />
            <line className={"hhHouseIntruderBody" + (sim.intruderActive ? " isActive" : "")} x1={0} y1={0} x2={6} y2={16} strokeWidth={5} stroke="currentColor" />
          </g>

          {/* ---- wiring overlay ---- */}
          {wiringOn &&
            wiring.components.flatMap((comp) => {
              const from = componentPos(comp.id, doorAngle);
              return comp.wires.map((w, i) => {
                const to = boardAnchor(w.board, iteration);
                const isHot = hoveredId === comp.id;
                const isDim = hoveredId !== null && !isHot;
                const cx = (from.x + to.x) / 2 + i * 6 - 6;
                const cy = Math.min(from.y, to.y) - 34 - i * 6;
                const d = `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
                const midX = 0.25 * from.x + 0.5 * cx + 0.25 * to.x;
                const midY = 0.25 * from.y + 0.5 * cy + 0.25 * to.y;
                return (
                  <g key={`${comp.id}-${i}`}>
                    <path className={"hhHouseWire" + (isDim ? " isDim" : "") + (isHot ? " isHot" : "")} d={d} stroke={w.color} />
                    <text className={"hhHouseWireLabel" + (isHot ? " isHot" : "")} x={midX} y={midY} textAnchor="middle" opacity={isDim ? 0.15 : 1}>
                      {w.from} → {w.to}
                    </text>
                  </g>
                );
              });
            })}

          {/* ---- one-shot alert flash ---- */}
          <rect key={sim.alertCount} className="hhHouseFlash" x={0} y={0} width={VB_W} height={VB_H} />
        </svg>

        {wiringOn && hoveredComponent && (
          <div className="hhHousePinCard">
            <h4>{hoveredComponent.name}</h4>
            {hoveredComponent.wires.map((w, i) => (
              <div key={i} className="hhHousePinRow">
                <span>
                  {w.from} → {w.to}
                </span>
                <span className="hhHousePinNote">{w.board}</span>
              </div>
            ))}
            {hoveredComponent.wires.some((w) => w.note) && (
              <div className="hhHousePinNote" style={{ marginTop: 4 }}>
                {hoveredComponent.wires.find((w) => w.note)?.note}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="hhRow">
        <label className="hhSlider">
          Door
          <input
            type="range"
            min={0}
            max={90}
            value={Math.round(doorAngle)}
            onChange={(e) => actions.setDoorAngle(Number(e.target.value))}
          />
          <span className="hhMono">{Math.round(doorAngle)}°</span>
        </label>
        <label className="hhSlider">
          Intruder
          <input
            type="range"
            min={0}
            max={230}
            value={Math.round(Math.min(sim.intruderDistCm, 230))}
            onChange={(e) => {
              const cm = Number(e.target.value);
              actions.setIntruder(cm <= PATH_RANGE_CM, cm);
            }}
          />
          <span className="hhMono">{sim.intruderActive ? `${sim.intruderDistCm.toFixed(0)} cm` : "away"}</span>
        </label>
      </div>

      <div className="hhHouseReadout hhRow">
        <span>
          distance <b className="hhMono">{sim.currentDistance.toFixed(1)} cm</b>
        </span>
        <span>
          threshold <b className="hhMono">{sim.cfg.thresholdCm.toFixed(1)} cm</b>
        </span>
        <span className={"hhHouseState" + (isAlert ? " isAlert" : "")}>{STATE_NAMES[sim.state]}</span>
        <span className={"hhHouseArmedPill" + (sim.armed ? "" : " isDisarmed")}>{sim.armed ? "ARMED" : "DISARMED"}</span>
      </div>

      <div ref={consoleRef} className="hhConsole">
        {sim.serialLog.slice(-12).map((line, i) => (
          <div key={i} className={line.tone}>
            {line.text}
          </div>
        ))}
      </div>

      <p className="hhNote">No photos of the house survived the weekend — this cutaway is a schematic redrawing; the wiring is real.</p>
    </div>
  );
}
