"use client";

/**
 * Transport panel — the same live thermal frame drawn as packets moving
 * ESP32 -> laptop over three real ECE 140 transports:
 *   - Serial: tutorial1_serial_delay/esp32/src/main.cpp — 115200-baud CSV, delay(1000)
 *   - MQTT:   challenge1_mqtt_thermal (publish) + challenge2_mqtt_request (request/response)
 *             + ECE140_MQTT.cpp (reconnect behavior)
 *   - WebSocket: ta5_websocket_dataset_collection/lab_challenge (server.py broadcast +
 *             the browser labeling UI, replicated in miniature)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrames, SENSOR_FPS } from "../core/frameStore";
import { thermalColor, type ThermalFrame } from "../core/colormap";
import "./transport.css";

type Tab = "serial" | "mqtt" | "websocket";

const TABS: { id: Tab; label: string }[] = [
  { id: "serial", label: "SERIAL" },
  { id: "mqtt", label: "MQTT" },
  { id: "websocket", label: "WEBSOCKET" },
];

// --- real numbers mined from the course code ------------------------------

const BAUD = 115200;
const BITS_PER_BYTE = 10; // 1 start + 8 data + 1 stop — the spec's own framing
// tutorial1_serial_delay/esp32/src/main.cpp: `delay(1000)` at the bottom of loop()
const SERIAL_LOOP_DELAY_MS = 1000;

// challenge1_mqtt_thermal/esp32/src/main.cpp: TOPIC_PREFIX "ece140a/thermal",
// mqtt.publishMessage("thermal", message) -> "<prefix>/thermal"
const MQTT_BROKER = "broker.emqx.io";
const MQTT_PUBLISH_TOPIC = "ece140a/thermal/thermal";
// challenge2_mqtt_request: TOPIC_PREFIX "ece140a/thermal2"; subscribeTopic("request"),
// publishMessage("response", ...); python/thermal_controller.py mirrors these topics.
const MQTT_REQUEST_TOPIC = "ece140a/thermal2/request";
const MQTT_RESPONSE_TOPIC = "ece140a/thermal2/response";

// ECE140_MQTT.cpp loop(): if (!connected) { print(...); delay(1000); connectToBroker(); }
const MQTT_RECONNECT_STEPS: { text: string; ms: number }[] = [
  { text: "[MQTT] Connection lost. Attempting to reconnect...", ms: 750 },
  { text: "[MQTT] Connecting to broker...", ms: 950 },
  { text: "[MQTT] Connected successfully!", ms: 650 },
  { text: `[MQTT] Subscribing to ${MQTT_REQUEST_TOPIC}`, ms: 650 },
  { text: "[MQTT] Subscribed successfully", ms: 550 },
];

// ta5_websocket_dataset_collection/lab_challenge/python/server.py:
// broadcast_frames() polls `await asyncio.sleep(0.1)` between pushes.
const WS_BROADCAST_POLL_MS = 100;

// --- payload builders (honest — computed from the live frame) -------------

function meanTemp(px: Float32Array): number {
  let s = 0;
  for (let i = 0; i < px.length; i++) s += px[i];
  return s / px.length;
}

function csvLine(px: Float32Array): string {
  // main.cpp: `Serial.print(pixels[i], 2)` joined by commas
  return Array.from(px, (v) => v.toFixed(2)).join(",");
}

function mqttPublishPayload(px: Float32Array): string {
  // The AMG8833 thermistor (ambient) isn't in the shipped frame data; approximate
  // it a few degrees under the pixel mean, the way an idle ambient sensor reads.
  const thermistor = meanTemp(px) - 3;
  return JSON.stringify({
    thermistor: Number(thermistor.toFixed(2)),
    pixels: Array.from(px, (v) => Number(v.toFixed(2))),
  });
}

function wsFramePayload(px: Float32Array, stats: { total: number; empty: number; present: number }): string {
  return JSON.stringify({
    type: "frame",
    pixels: Array.from(px, (v) => Number(v.toFixed(2))),
    stats,
  });
}

function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

function fmt(n: number, d = 1): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

// --- shared SVG scene -------------------------------------------------------

function Chip({ x }: { x: number }) {
  return (
    <g transform={`translate(${x},38)`}>
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={`t${i}`} x={14 + i * 14} y={-6} width={6} height={6} className="etTransPin" />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={`b${i}`} x={14 + i * 14} y={70} width={6} height={6} className="etTransPin" />
      ))}
      <rect x={0} y={0} width={94} height={70} rx={9} className="etTransChip" />
      <circle cx={14} cy={14} r={3} className="etTransLed" />
      <text x={47} y={40} textAnchor="middle" className="etTransChipLabel">ESP32-S3</text>
      <text x={47} y={54} textAnchor="middle" className="etTransChipSub">AMG8833</text>
    </g>
  );
}

function Laptop({ x }: { x: number }) {
  return (
    <g transform={`translate(${x},34)`}>
      <rect x={4} y={0} width={92} height={62} rx={5} className="etTransLaptopScreen" />
      <rect x={12} y={8} width={76} height={46} rx={2} className="etTransLaptopGlass" />
      <path d="M -10 62 L 110 62 L 122 78 L -22 78 Z" className="etTransLaptopBase" />
      <text x={50} y={35} textAnchor="middle" className="etTransChipLabel">laptop</text>
    </g>
  );
}

interface SceneProps {
  tab: Tab;
  ribbonText: string;
  gapFrac: number;
  linkState: LinkState;
  retryPulse: number;
  requestPhase: RequestPhase;
  wsLabelPulse: number;
  wsLabelDir: "present" | "empty" | null;
}

function TransportScene({ tab, ribbonText, gapFrac, linkState, retryPulse, requestPhase, wsLabelPulse, wsLabelDir }: SceneProps) {
  const chipX = 16;
  const laptopX = 566;
  const midStart = 120;
  const midEnd = 566;
  const cy = 73;

  return (
    <svg className="etTransScene" viewBox="0 0 680 190" role="img" aria-label={`${tab} transport diagram`}>
      {tab === "serial" && (
        <>
          <line x1={midStart} y1={cy} x2={midEnd} y2={cy} className="etTransCable" />
          <foreignObject x={midStart + 4} y={cy - 14} width={midEnd - midStart - 8} height={28}>
            <div className="etTransRibbonWrap">
              <div
                className="etTransRibbon"
                style={{ "--gap-frac": gapFrac } as React.CSSProperties}
              >
                <span className="etTransRibbonBytes">{ribbonText}</span>
                <span className="etTransRibbonGap" />
                <span className="etTransRibbonBytes">{ribbonText}</span>
                <span className="etTransRibbonGap" />
              </div>
            </div>
          </foreignObject>
          <text x={(midStart + midEnd) / 2} y={cy + 34} textAnchor="middle" className="etTransMidCaption">
            USB / UART — one direct cable
          </text>
        </>
      )}

      {tab === "mqtt" && (
        <>
          <line x1={midStart} y1={cy} x2={318} y2={cy} className="etTransCable" data-dropped={linkState !== "connected"} />
          <line x1={352} y1={cy} x2={midEnd} y2={cy} className="etTransCable" />
          <g transform="translate(335,73)">
            <circle r={30} className="etTransBroker" data-state={linkState} />
            <text y={-40} textAnchor="middle" className="etTransTopicLabel">{MQTT_BROKER}</text>
            <text y={5} textAnchor="middle" className="etTransBrokerGlyph">☁</text>
          </g>
          <text x={(midStart + 318) / 2} y={cy - 12} textAnchor="middle" className="etTransTopicLabel">
            {MQTT_PUBLISH_TOPIC}
          </text>
          <circle key={`pub-${tab}`} cy={cy} r={4} className="etTransFlowDot etTransFlowPub" />
          {linkState !== "connected" && (
            <circle key={`retry-${retryPulse}`} cx={335} cy={40} r={5} className="etTransRetryPulse" />
          )}
          {requestPhase !== "idle" && (
            <g>
              <circle
                r={5}
                className="etTransReqDot"
                cx={
                  requestPhase === "request"
                    ? laptopX - 20
                    : requestPhase === "grab"
                      ? 335
                      : requestPhase === "response"
                        ? 335
                        : chipX + 47
                }
                cy={
                  requestPhase === "request" ? 96 : requestPhase === "grab" ? 96 : requestPhase === "response" ? 50 : 50
                }
              />
              <text x={(chipX + laptopX) / 2 + 47} y={cy + 34} textAnchor="middle" className="etTransMidCaption">
                {requestPhase === "request" && `${MQTT_REQUEST_TOPIC} →`}
                {requestPhase === "grab" && "ESP32 grabs the current live frame"}
                {requestPhase === "response" && `→ ${MQTT_RESPONSE_TOPIC}`}
                {requestPhase === "landed" && "payload landed"}
              </text>
            </g>
          )}
        </>
      )}

      {tab === "websocket" && (
        <>
          <line x1={midStart} y1={cy - 16} x2={midEnd} y2={cy - 16} className="etTransCable etTransCableThin" />
          <line x1={midStart} y1={cy + 16} x2={midEnd} y2={cy + 16} className="etTransCable etTransCableThin" />
          <text x={(midStart + midEnd) / 2} y={cy - 24} textAnchor="middle" className="etTransTopicLabel">
            frames — {SENSOR_FPS}/s →
          </text>
          <text x={(midStart + midEnd) / 2} y={cy + 34} textAnchor="middle" className="etTransTopicLabel">
            ← labels (p / e)
          </text>
          <circle key={`ws-${tab}`} cy={cy - 16} r={4} className="etTransFlowDot etTransFlowWs" />
          {wsLabelDir && (
            <circle
              key={`lbl-${wsLabelPulse}`}
              r={5}
              cy={cy + 16}
              className={`etTransLabelDot etTransLabelDot--${wsLabelDir}`}
            />
          )}
        </>
      )}

      <Chip x={chipX} />
      <Laptop x={laptopX} />
    </svg>
  );
}

type LinkState = "connected" | "dropped" | "retrying" | "resubscribing";
type RequestPhase = "idle" | "request" | "grab" | "response" | "landed";

export default function TransportPanel() {
  const { frame } = useFrames();
  const [tab, setTab] = useState<Tab>("serial");

  const frameRef = useRef<ThermalFrame | null>(frame);
  frameRef.current = frame;

  // --- MQTT: drop / reconnect ---------------------------------------------
  const [linkState, setLinkState] = useState<LinkState>("connected");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkLog, setLinkLog] = useState<string[]>([]);
  const [retryPulse, setRetryPulse] = useState(0);
  const linkTimers = useRef<number[]>([]);

  const clearLinkTimers = useCallback(() => {
    linkTimers.current.forEach((t) => window.clearTimeout(t));
    linkTimers.current = [];
  }, []);

  const dropTheLink = useCallback(() => {
    if (linkBusy) return;
    clearLinkTimers();
    setLinkBusy(true);
    setLinkState("dropped");
    setLinkLog([]);
    let elapsed = 0;
    MQTT_RECONNECT_STEPS.forEach((step, i) => {
      const t = window.setTimeout(() => {
        setLinkState(i < 3 ? (i === 0 ? "dropped" : "retrying") : "resubscribing");
        setLinkLog((log) => [...log.slice(-3), step.text]);
        setRetryPulse((p) => p + 1);
        if (i === MQTT_RECONNECT_STEPS.length - 1) {
          const t2 = window.setTimeout(() => {
            setLinkState("connected");
            setLinkBusy(false);
          }, step.ms);
          linkTimers.current.push(t2);
        }
      }, elapsed);
      linkTimers.current.push(t);
      elapsed += step.ms;
    });
  }, [linkBusy, clearLinkTimers]);

  useEffect(() => clearLinkTimers, [clearLinkTimers]);

  // --- MQTT: request a frame (challenge2 handshake) -----------------------
  const [requestPhase, setRequestPhase] = useState<RequestPhase>("idle");
  const [requestPayload, setRequestPayload] = useState<string | null>(null);
  const reqTimers = useRef<number[]>([]);

  const requestFrame = useCallback(() => {
    reqTimers.current.forEach((t) => window.clearTimeout(t));
    reqTimers.current = [];
    setRequestPayload(null);
    setRequestPhase("request");
    const push = (fn: () => void, ms: number) => {
      const t = window.setTimeout(fn, ms);
      reqTimers.current.push(t);
    };
    push(() => setRequestPhase("grab"), 550);
    push(() => {
      const f = frameRef.current;
      if (f) setRequestPayload(mqttPublishPayload(f.px));
      setRequestPhase("response");
    }, 1050);
    push(() => setRequestPhase("landed"), 1650);
    push(() => {
      setRequestPhase("idle");
      setRequestPayload(null);
    }, 3600);
  }, []);

  useEffect(() => () => reqTimers.current.forEach((t) => window.clearTimeout(t)), []);

  // --- WebSocket: mini labeling UI ----------------------------------------
  const [tally, setTally] = useState({ present: 0, empty: 0 });
  const [wsLabelDir, setWsLabelDir] = useState<"present" | "empty" | null>(null);
  const [wsLabelPulse, setWsLabelPulse] = useState(0);
  const [wsToast, setWsToast] = useState<string | null>(null);
  const wsHover = useRef(false);
  const wsFocus = useRef(false);
  const wsLabelTimer = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const doLabel = useCallback((label: "present" | "empty") => {
    setTally((t) => ({ ...t, [label]: t[label] + 1 }));
    setWsLabelDir(label);
    setWsLabelPulse((p) => p + 1);
    setWsToast(`labeled ${label} — chip sent back over the socket`);
    if (wsLabelTimer.current) window.clearTimeout(wsLabelTimer.current);
    wsLabelTimer.current = window.setTimeout(() => {
      setWsLabelDir(null);
      setWsToast(null);
    }, 900);
  }, []);

  useEffect(() => {
    if (tab !== "websocket") return;
    function onKey(e: KeyboardEvent) {
      if (!wsHover.current && !wsFocus.current) return;
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        doLabel("present");
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        doLabel("empty");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, doLabel]);

  useEffect(() => {
    return () => {
      if (wsLabelTimer.current) window.clearTimeout(wsLabelTimer.current);
    };
  }, []);

  // draw the mini thermal canvas — imperative, fixed size, no ResizeObserver needed
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;
    canvas.style.display = "block";
    const size = 112;
    const cell = size / 8;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < frame.px.length; i++) {
      const v = frame.px[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min || 1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const t = (frame.px[r * 8 + c] - min) / range;
        const [rr, gg, bb] = thermalColor(t);
        ctx.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`;
        ctx.fillRect(c * cell, r * cell, cell + 1, cell + 1);
      }
    }
  }, [frame]);

  // --- derived / honest numbers --------------------------------------------

  const csv = useMemo(() => (frame ? csvLine(frame.px) : ""), [frame]);
  const csvBytes = csv ? byteLen(csv) : 0;
  const serialTxMs = (csvBytes * BITS_PER_BYTE) / BAUD * 1000;
  const serialFrameMs = serialTxMs + SERIAL_LOOP_DELAY_MS;
  const gapFrac = Math.max(0.15, Math.min(0.9, SERIAL_LOOP_DELAY_MS / serialFrameMs));

  const mqttJson = useMemo(() => (frame ? mqttPublishPayload(frame.px) : ""), [frame]);
  const mqttBytes = mqttJson ? byteLen(mqttJson) : 0;

  const wsJson = useMemo(
    () => (frame ? wsFramePayload(frame.px, { total: tally.present + tally.empty, ...tally }) : ""),
    [frame, tally],
  );
  const wsBytes = wsJson ? byteLen(wsJson) : 0;

  const readout = useMemo(() => {
    if (tab === "serial") {
      return {
        bytes: csvBytes,
        latencyLabel: "wire time (1 hop)",
        latencyMs: serialTxMs,
        state: "streaming — direct cable",
      };
    }
    if (tab === "mqtt") {
      return {
        bytes: mqttBytes,
        latencyLabel: "modeled — 2 hops via public broker, not logged",
        latencyMs: 35 * 2,
        state:
          linkState === "connected"
            ? "connected"
            : linkState === "dropped"
              ? "link dropped"
              : linkState === "retrying"
                ? "reconnecting…"
                : "resubscribing…",
      };
    }
    return {
      bytes: wsBytes,
      latencyLabel: "server broadcast poll (1 hop, real number)",
      latencyMs: WS_BROADCAST_POLL_MS,
      state: "open — persistent duplex",
    };
  }, [tab, csvBytes, mqttBytes, wsBytes, serialTxMs, linkState]);

  return (
    <div className="etTransRoot">
      <div className="etRow etTransTabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="etBtn"
            data-active={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="etCanvasWrap etTransSceneWrap">
        <TransportScene
          tab={tab}
          ribbonText={csv}
          gapFrac={gapFrac}
          linkState={linkState}
          retryPulse={retryPulse}
          requestPhase={requestPhase}
          wsLabelPulse={wsLabelPulse}
          wsLabelDir={wsLabelDir}
        />
      </div>

      {tab === "serial" && (
        <div className="etTransTabBody">
          <div className="etRow">
            <span className="etLabel">bytes / frame</span>
            <span className="etMono">{csvBytes} B</span>
            <span className="etLabel">theoretical tx @ 115200 baud</span>
            <span className="etMono">{fmt(serialTxMs, 2)} ms</span>
            <span className="etLabel">delay() gap</span>
            <span className="etMono">{SERIAL_LOOP_DELAY_MS} ms</span>
          </div>
          <p className="etNote">
            <strong>tutorial1_serial_delay/esp32/src/main.cpp</strong>: <code>amg.readPixels(pixels)</code>{" "}
            then 64 <code>Serial.print(pixels[i], 2)</code> calls, comma-separated, followed by{" "}
            <code>delay(1000)</code>. At 115200 baud (10 bits/byte: start + 8 data + stop) the CSV line
            above takes ~{fmt(serialTxMs, 2)} ms to transmit — the {SERIAL_LOOP_DELAY_MS} ms{" "}
            <code>delay()</code> dominates the ~{fmt(serialFrameMs, 0)} ms loop period by a factor of{" "}
            {fmt(SERIAL_LOOP_DELAY_MS / serialTxMs, 0)}×. The gap in the ribbon above is compressed for
            visibility — it should be far longer relative to the flowing bytes.
          </p>
        </div>
      )}

      {tab === "mqtt" && (
        <div className="etTransTabBody">
          <div className="etRow">
            <button className="etBtn" onClick={requestFrame} disabled={requestPhase !== "idle"}>
              Request a frame
            </button>
            <button className="etBtn" data-active={linkBusy} onClick={dropTheLink} disabled={linkBusy}>
              Drop the link
            </button>
            <span className="etLabel">publish topic</span>
            <span className="etMono">{MQTT_PUBLISH_TOPIC}</span>
          </div>
          {requestPayload && requestPhase === "landed" && (
            <div className="etTransPayloadBox">
              <span className="etLabel">response payload</span>
              <pre className="etMono etTransPayloadPre">{requestPayload}</pre>
            </div>
          )}
          {linkLog.length > 0 && (
            <div className="etTransLog">
              {linkLog.map((line, i) => (
                <div key={i} className="etMono etTransLogLine">
                  {line}
                </div>
              ))}
            </div>
          )}
          <p className="etNote">
            <strong>challenge1_mqtt_thermal</strong> publishes every frame to{" "}
            <code>{MQTT_PUBLISH_TOPIC}</code> on <code>{MQTT_BROKER}</code>. <strong>challenge2_mqtt_request</strong>{" "}
            adds a request/response pair — <code>{MQTT_REQUEST_TOPIC}</code> wakes the ESP32&apos;s callback
            (<code>dataRequested = true</code>), it grabs one live reading and answers on{" "}
            <code>{MQTT_RESPONSE_TOPIC}</code>. &quot;Drop the link&quot; replays{" "}
            <strong>ECE140_MQTT.cpp</strong>&apos;s <code>loop()</code>: when{" "}
            <code>!_mqttClient-&gt;connected()</code> it logs, waits, and calls{" "}
            <code>connectToBroker()</code> again.
          </p>
        </div>
      )}

      {tab === "websocket" && (
        <div className="etTransTabBody">
          <p className="etNote">
            Mini replica of <strong>ta5_websocket_dataset_collection/lab_challenge</strong>&apos;s labeling
            page: the FastAPI server broadcasts the current frame over <code>/ws</code> every{" "}
            {WS_BROADCAST_POLL_MS} ms; this page&apos;s keys are <code>p</code>/<code>e</code> (present /
            empty) — the lab itself used <code>1</code>/<code>0</code>. Labels here are kept in local
            state only, nothing is posted anywhere.
          </p>
          <div
            className="etTransLabelUI"
            tabIndex={0}
            onMouseEnter={() => (wsHover.current = true)}
            onMouseLeave={() => (wsHover.current = false)}
            onFocus={() => (wsFocus.current = true)}
            onBlur={() => (wsFocus.current = false)}
          >
            <div className="etCanvasWrap etTransLabelCanvasWrap">
              <canvas ref={canvasRef} width={112} height={112} className="etTransLabelCanvas" />
              {frame && (
                <span className={`etBadge ${frame.label === "present" ? "etBadgePresent" : "etBadgeEmpty"}`}>
                  {frame.label}
                </span>
              )}
            </div>
            <div className="etTransLabelBtns">
              <div className="etRow">
                <button className="etBtn" onClick={() => doLabel("present")}>
                  Present (p)
                </button>
                <button className="etBtn" onClick={() => doLabel("empty")}>
                  Empty (e)
                </button>
              </div>
              <div className="etRow">
                <span className="etLabel">session tally</span>
                <span className="etMono">present {tally.present}</span>
                <span className="etMono">empty {tally.empty}</span>
              </div>
              {wsToast && <div className="etTransToast">{wsToast}</div>}
              <span className="etNote etTransHint">
                hover or focus this box, then press <code>p</code> / <code>e</code>
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="etTransReadouts">
        <div className="etTransReadout">
          <span className="etLabel">bytes / frame</span>
          <span className="etMono">{readout.bytes} B</span>
        </div>
        <div className="etTransReadout">
          <span className="etLabel">frames / s</span>
          <span className="etMono">{SENSOR_FPS}</span>
        </div>
        <div className="etTransReadout">
          <span className="etLabel">{readout.latencyLabel}</span>
          <span className="etMono">{fmt(readout.latencyMs, readout.latencyMs < 10 ? 2 : 0)} ms</span>
        </div>
        <div className="etTransReadout">
          <span className="etLabel">connection</span>
          <span className="etMono">{readout.state}</span>
        </div>
      </div>
    </div>
  );
}
