/**
 * HardHack 2026 break-in simulator — the whole system as one deterministic sim.
 *
 * The controller half is a direct port of `intrusion_uno.ino` (iterations 1–2) /
 * `intrusion_esp32_consolidated.ino` (iteration 3): same constants, same moving
 * average, same 3-consecutive-readings confirmation, same armed-state gate, same
 * JSON packet strings from comm_protocol.h. The gateway half models the UART link
 * (9600 baud → visible travel time), the WiFi/MQTT hop, reconnects, and the phone.
 *
 * Pure TypeScript, no DOM. Drive it with tick(sim, dtMs); render from the fields.
 */

// ---------------------------------------------------------------- constants (config.h)

export const SecurityState = { NORMAL: 0, ALERT: 1, LOCKDOWN: 2, ERROR: 3 } as const;
export type SecurityStateT = (typeof SecurityState)[keyof typeof SecurityState];
export const STATE_NAMES = ["NORMAL", "ALERT", "LOCKDOWN", "ERROR"] as const;

export type Iteration = 1 | 2 | 3;

/** Firmware constants per iteration (config.h / consolidated #defines). */
export interface FirmwareConfig {
  thresholdCm: number; // INTRUSION_THRESHOLD_CM (12.0 uno, 11.0 consolidated)
  minDistanceCm: number; // MIN_DISTANCE_CM 2.0
  maxDistanceCm: number; // MAX_DISTANCE_CM 200.0
  bufferSize: number; // READING_BUFFER_SIZE 2
  confirmationCount: number; // INTRUSION_CONFIRMATION_COUNT 3
  sensorIntervalMs: number; // SENSOR_READ_INTERVAL_MS 500
  statusIntervalMs: number; // status to gateway/broker every 5000 ms
  heartbeatIntervalMs: number; // MQTT heartbeat 60000 ms
  uartBaud: number; // 9600
}

export function defaultConfig(iteration: Iteration): FirmwareConfig {
  return {
    thresholdCm: iteration === 3 ? 11.0 : 12.0,
    minDistanceCm: 2.0,
    maxDistanceCm: 200.0,
    bufferSize: 2,
    confirmationCount: 3,
    sensorIntervalMs: 500,
    statusIntervalMs: 5000,
    heartbeatIntervalMs: 60000,
    uartBaud: 9600,
  };
}

// ---------------------------------------------------------------- packets

export type LinkId = "uart-up" | "uart-down" | "wifi-up" | "wifi-down";
export type PacketKind = "S" | "A" | "K" | "C" | "E" | "HB";

export interface Packet {
  id: number;
  kind: PacketKind;
  /** Rendered JSON string (exact firmware format). */
  payload: string;
  link: LinkId;
  /** 0..1 along the link. */
  progress: number;
  /** ms to traverse the link. */
  travelMs: number;
  /** True for the deliberately corrupted UART-noise packet. */
  malformed?: boolean;
}

export interface LogLine {
  t: number;
  text: string;
  tone: "info" | "send" | "recv" | "alert" | "error";
}

// ---------------------------------------------------------------- sim state

export interface SimState {
  t: number; // ms since boot
  iteration: Iteration;
  cfg: FirmwareConfig;

  // --- scene (written by the house panel) ---
  doorAngleDeg: number; // 0 closed .. 90 open
  intruderDistCm: number; // distance from sensor along the cone; > 200 = out of range
  intruderActive: boolean;

  // --- controller (intrusion_uno.ino port) ---
  state: SecurityStateT;
  armed: boolean;
  consecutiveReadings: number;
  distanceBuffer: number[];
  bufferIndex: number;
  bufferFilled: number;
  currentDistance: number;
  lastRawDistance: number;
  motionDetected: boolean; // VCNL4040 OR'd into the alert condition
  alarmOn: boolean;
  ledGreen: boolean;
  ledRed: boolean;
  servoLocked: boolean;
  lastSensorRead: number;
  lastStatusSend: number;
  suppressedAlert: boolean; // last alert arrived while disarmed

  // --- gateway (ESP32 / R4 / consolidated) ---
  wifiUp: boolean;
  mqttUp: boolean;
  wifiReconnects: number;
  mqttReconnects: number;
  reconnectingUntil: number; // >t while the reconnect sequence plays
  lastHeartbeat: number;
  queued: Packet[]; // packets held at the gateway while the link is down

  // --- faults (written by the wire panel) ---
  faultWifiDown: boolean;
  faultUartNoiseOnce: boolean;

  // --- phone ---
  phoneOnline: boolean;
  phoneLastSeen: number;
  phoneLog: LogLine[];

  // --- output streams ---
  packets: Packet[];
  serialLog: LogLine[];
  packetSeq: number;

  /** Bumped on every NORMAL→ALERT so panels can trigger one-shot animations. */
  alertCount: number;

  rng: () => number;
}

export function createSim(iteration: Iteration = 1, seed = 2026): SimState {
  return {
    t: 0,
    iteration,
    cfg: defaultConfig(iteration),
    doorAngleDeg: 0,
    intruderDistCm: 400,
    intruderActive: false,
    state: SecurityState.NORMAL,
    armed: true,
    consecutiveReadings: 0,
    distanceBuffer: [0, 0, 0, 0, 0],
    bufferIndex: 0,
    bufferFilled: 0,
    currentDistance: 0,
    lastRawDistance: 0,
    motionDetected: false,
    alarmOn: false,
    ledGreen: true,
    ledRed: false,
    servoLocked: true,
    lastSensorRead: 0,
    lastStatusSend: 0,
    suppressedAlert: false,
    wifiUp: true,
    mqttUp: true,
    wifiReconnects: 0,
    mqttReconnects: 0,
    reconnectingUntil: 0,
    lastHeartbeat: 0,
    queued: [],
    faultWifiDown: false,
    faultUartNoiseOnce: false,
    phoneOnline: true,
    phoneLastSeen: 0,
    phoneLog: [],
    packets: [],
    serialLog: [],
    packetSeq: 0,
    alertCount: 0,
    rng: mulberry32(seed),
  };
}

export function setIteration(sim: SimState, iteration: Iteration): void {
  const keepArmed = sim.armed;
  const kept = { doorAngleDeg: sim.doorAngleDeg, intruderDistCm: sim.intruderDistCm, intruderActive: sim.intruderActive };
  const fresh = createSim(iteration);
  Object.assign(sim, fresh, kept, { armed: keepArmed });
  log(sim, "info", `[BOOT] iteration ${iteration} flashed — ${iteration === 3 ? "ESP32-S3 consolidated" : iteration === 2 ? "Uno + Arduino R4 WiFi" : "Uno + ESP32-S3 gateway"}`);
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- scene → sensor

/**
 * Distance the HC-SR04 beside the door frame reports (before smoothing).
 * The beam looks across the doorway: with the door shut it sees the opposite
 * frame (~85 cm). As the door swings open its panel sweeps into the beam and the
 * reading collapses; an intruder in the cone is whatever is nearest.
 */
export function sceneDistance(sim: SimState): number {
  const doorDist = sim.doorAngleDeg <= 5 ? 85 : Math.max(4, 85 - (sim.doorAngleDeg / 90) * 81);
  const intruder = sim.intruderActive ? sim.intruderDistCm : Infinity;
  const d = Math.min(doorDist, intruder);
  return d + (sim.rng() - 0.5); // ±0.5 cm HC-SR04 noise
}

/** VCNL4040 proximity: trips when something is close to the frame (5% over baseline). */
export function sceneMotion(sim: SimState): boolean {
  return (sim.intruderActive && sim.intruderDistCm < 25) || sim.doorAngleDeg > 70;
}

// ---------------------------------------------------------------- firmware port

/** applyMovingAverage() — READING_BUFFER_SIZE-sample smoothing, exact port. */
function applyMovingAverage(sim: SimState, raw: number): number {
  sim.distanceBuffer[sim.bufferIndex] = raw;
  sim.bufferIndex = (sim.bufferIndex + 1) % sim.cfg.bufferSize;
  sim.bufferFilled = Math.min(sim.bufferFilled + 1, sim.cfg.bufferSize);
  let sum = 0;
  for (let i = 0; i < sim.cfg.bufferSize; i++) sum += sim.distanceBuffer[i];
  return sum / sim.cfg.bufferSize;
}

/** updateIntrusionStatus() — exact port (distance OR motion, 3-reading confirm). */
function updateIntrusionStatus(sim: SimState): void {
  const distanceAlert = sim.currentDistance < sim.cfg.thresholdCm && sim.bufferFilled > 0;
  if (distanceAlert || sim.motionDetected) {
    sim.consecutiveReadings++;
    if (sim.consecutiveReadings >= sim.cfg.confirmationCount && sim.state === SecurityState.NORMAL) {
      setSecurityState(sim, SecurityState.ALERT);
    }
  } else {
    sim.consecutiveReadings = 0;
    if (sim.state === SecurityState.ALERT) {
      setSecurityState(sim, SecurityState.NORMAL);
    }
  }
}

/** setSecurityState() — exact port including the armed-state gate. */
function setSecurityState(sim: SimState, next: SecurityStateT): void {
  if (next === sim.state) return;
  const prev = sim.state;
  sim.state = next;
  log(sim, "info", `[STATE] ${STATE_NAMES[prev]} → ${STATE_NAMES[next]}`);
  if (next === SecurityState.ALERT) {
    if (sim.armed) {
      sim.alarmOn = true;
      sim.ledRed = true;
      sim.ledGreen = false;
      sim.servoLocked = true;
      sim.suppressedAlert = false;
      sim.alertCount++;
      log(sim, "alert", "[ALARM] ACTIVATED");
      sendAlert(sim);
    } else {
      sim.suppressedAlert = true;
      sim.ledRed = false;
      sim.ledGreen = true;
      log(sim, "info", "[ALERT] Intrusion detected but system DISARMED - alarm suppressed");
    }
  } else if (next === SecurityState.NORMAL) {
    sim.alarmOn = false;
    sim.suppressedAlert = false;
    sim.ledRed = false;
    sim.ledGreen = true;
    log(sim, "info", "[NORMAL] Alarm deactivated, system normal");
    if (sim.iteration === 3) sendStatus(sim); // consolidated force-publishes state changes
  }
}

/** handleESP32Command() — exact port of the indexOf-based parse. */
export function handleCommand(sim: SimState, cmdJson: string): void {
  log(sim, "recv", `[←GATEWAY] ${cmdJson}`);
  if (cmdJson.indexOf('"cmd":"ON"') !== -1) {
    sim.armed = true;
    sim.ledGreen = true;
    sim.ledRed = false;
    sim.alarmOn = false;
    log(sim, "info", "[ARDUINO] SYSTEM ON");
  } else if (cmdJson.indexOf('"cmd":"OFF"') !== -1) {
    sim.armed = false;
    sim.ledGreen = false;
    sim.ledRed = false;
    sim.alarmOn = false;
    if (sim.state === SecurityState.ALERT) sim.state = SecurityState.NORMAL;
    log(sim, "info", "[ARDUINO] SYSTEM OFF");
  }
}

// ---------------------------------------------------------------- packets & links

function uartTravelMs(sim: SimState, payload: string): number {
  // 10 bits per char at 9600 baud ≈ 1.04 ms/char.
  return (payload.length * 10 * 1000) / sim.cfg.uartBaud;
}

const WIFI_TRAVEL_MS = 350;

function emit(sim: SimState, kind: PacketKind, payload: string, link: LinkId, malformed = false): Packet {
  const p: Packet = {
    id: ++sim.packetSeq,
    kind,
    payload,
    link,
    progress: 0,
    travelMs: link.startsWith("uart") ? uartTravelMs(sim, payload) + 60 : WIFI_TRAVEL_MS,
    malformed,
  };
  sim.packets.push(p);
  return p;
}

function sendStatus(sim: SimState): void {
  const up = Math.floor(sim.t / 1000);
  const dist = sim.currentDistance.toFixed(1);
  if (sim.iteration === 3) {
    const payload = `{"armed":${sim.armed},"state":${sim.state},"distance":${dist},"motion":${sim.motionDetected},"timestamp":${Math.floor(sim.t)}}`;
    publishMqtt(sim, "S", payload);
  } else {
    const payload = `{"type":"S","ts":${Math.floor(sim.t)},"dist":${dist},"st":${sim.state},"up":${up}}`;
    const noise = sim.faultUartNoiseOnce;
    sim.faultUartNoiseOnce = false;
    emit(sim, "S", noise ? corrupt(payload) : payload, "uart-up", noise);
    log(sim, "send", `[→GATEWAY] ${payload}`);
  }
}

function sendAlert(sim: SimState): void {
  const dist = sim.currentDistance.toFixed(1);
  if (sim.iteration === 3) {
    const payload = `{"armed":${sim.armed},"state":1,"distance":${dist},"motion":${sim.motionDetected},"timestamp":${Math.floor(sim.t)}}`;
    publishMqtt(sim, "A", payload);
  } else {
    const payload = `{"type":"A","ts":${Math.floor(sim.t)},"dist":${dist},"st":1}`;
    const noise = sim.faultUartNoiseOnce;
    sim.faultUartNoiseOnce = false;
    emit(sim, "A", noise ? corrupt(payload) : payload, "uart-up", noise);
    log(sim, "alert", `[→GATEWAY ALERT] ${payload}`);
  }
}

function corrupt(payload: string): string {
  return payload.slice(0, Math.floor(payload.length / 2)) + "Ø§#" + payload.slice(Math.floor(payload.length / 2) + 4);
}

function publishMqtt(sim: SimState, kind: PacketKind, payload: string): void {
  const p = emit(sim, kind, payload, "wifi-up");
  if (!sim.wifiUp || !sim.mqttUp) {
    sim.packets.pop();
    sim.queued.push(p);
    log(sim, "error", `[MQTT] Not connected - ${kind === "HB" ? "heartbeat skipped" : "status queued"}`);
  }
}

// ---------------------------------------------------------------- tick

export const TICK_MS = 50;

/** Advance the whole system by dtMs (call with TICK_MS steps). */
export function tick(sim: SimState, dtMs: number): void {
  sim.t += dtMs;
  const t = sim.t;

  // --- controller sensor loop (SENSOR_READ_INTERVAL_MS) ---
  if (t - sim.lastSensorRead >= sim.cfg.sensorIntervalMs) {
    sim.lastSensorRead = t;
    const raw = sceneDistance(sim);
    sim.lastRawDistance = raw;
    if (raw > 0 && raw >= sim.cfg.minDistanceCm && raw <= sim.cfg.maxDistanceCm) {
      sim.currentDistance = applyMovingAverage(sim, raw);
    }
    sim.motionDetected = sceneMotion(sim);
    log(sim, "info", `[SENSOR] Distance: ${sim.currentDistance.toFixed(1)} cm${sim.motionDetected ? " | Motion: YES" : ""}`);
    updateIntrusionStatus(sim);
  }

  // --- periodic status (5 s) ---
  if (t - sim.lastStatusSend >= sim.cfg.statusIntervalMs) {
    sim.lastStatusSend = t;
    sendStatus(sim);
  }

  // --- MQTT heartbeat (60 s, gateway/consolidated) ---
  if (t - sim.lastHeartbeat >= sim.cfg.heartbeatIntervalMs) {
    sim.lastHeartbeat = t;
    const payload = `{"type":"heartbeat","armed":${sim.armed},"state":${sim.state},"uptime":${Math.floor(t / 1000)}}`;
    publishMqtt(sim, "HB", payload);
  }

  // --- WiFi drop / reconnect ---
  if (sim.faultWifiDown && sim.wifiUp) {
    sim.wifiUp = false;
    sim.mqttUp = false;
    log(sim, "error", "[WIFI] Connection lost");
  }
  if (!sim.faultWifiDown && !sim.wifiUp && sim.reconnectingUntil === 0) {
    // connectToWiFi() + connectToMQTT() sequence
    sim.reconnectingUntil = t + 2000;
    log(sim, "info", "[WIFI] Attempting reconnect...");
  }
  if (sim.reconnectingUntil > 0 && t >= sim.reconnectingUntil) {
    sim.reconnectingUntil = 0;
    sim.wifiUp = true;
    sim.mqttUp = true;
    sim.wifiReconnects++;
    sim.mqttReconnects++;
    log(sim, "info", `[WIFI] Reconnected (wifi_reconnects=${sim.wifiReconnects})`);
    // flush the queue
    for (const p of sim.queued) {
      p.progress = 0;
      sim.packets.push(p);
    }
    sim.queued = [];
  }

  // --- packet motion + delivery ---
  const arrived: Packet[] = [];
  for (const p of sim.packets) {
    p.progress += dtMs / p.travelMs;
    if (p.progress >= 1) arrived.push(p);
  }
  sim.packets = sim.packets.filter((p) => p.progress < 1);
  for (const p of arrived) deliver(sim, p);

  // --- phone online pill: goes OFFLINE if nothing heard for 12 s ---
  sim.phoneOnline = t - sim.phoneLastSeen < 12000 && sim.wifiUp;

  trim(sim.serialLog);
  trim(sim.phoneLog);
}

function deliver(sim: SimState, p: Packet): void {
  switch (p.link) {
    case "uart-up": {
      // gateway received a controller packet
      if (p.malformed) {
        emit(sim, "E", `{"type":"E","err":"parse","raw":"...garbled..."}`, "uart-down");
        log(sim, "error", "[GATEWAY] Malformed UART message - E sent, waiting UART_MESSAGE_TIMEOUT_MS (2000)");
        return;
      }
      emit(sim, "K", `{"type":"K","ok":1}`, "uart-down");
      publishMqtt(sim, p.kind, p.payload);
      break;
    }
    case "uart-down": {
      if (p.kind === "C") handleCommand(sim, p.payload);
      // K acks and E just land in the log
      if (p.kind === "K") log(sim, "recv", `[←GATEWAY] {"type":"K","ok":1}`);
      break;
    }
    case "wifi-up": {
      // broker → phone
      sim.phoneLastSeen = sim.t;
      phoneLog(sim, p.kind === "HB" ? "recv" : p.kind === "A" ? "alert" : "recv", p.payload);
      break;
    }
    case "wifi-down": {
      // broker → gateway (command). Consolidated handles it directly; else forward on UART.
      if (sim.iteration === 3) handleCommand(sim, p.payload);
      else emit(sim, "C", p.payload, "uart-down");
      break;
    }
  }
}

// ---------------------------------------------------------------- phone actions

/** ARMED toggle on the phone → C command published down the chain. */
export function phoneSetArmed(sim: SimState, on: boolean): void {
  const payload = `{"type":"C","cmd":"${on ? "ON" : "OFF"}"}`;
  phoneLog(sim, "send", `publish → ${payload}`);
  if (!sim.wifiUp) {
    phoneLog(sim, "error", "broker unreachable - command lost");
    return;
  }
  emit(sim, "C", payload, "wifi-down");
}

/** "Reset Network Link" — replay the connectToWiFi()/connectToMQTT() sequence. */
export function phoneResetNetwork(sim: SimState): void {
  phoneLog(sim, "info", "Reset Network Link");
  sim.wifiUp = false;
  sim.mqttUp = false;
  sim.reconnectingUntil = 0; // tick() will start the reconnect
}

// ---------------------------------------------------------------- logs

const LOG_MAX = 60;

function log(sim: SimState, tone: LogLine["tone"], text: string): void {
  sim.serialLog.push({ t: sim.t, text, tone });
}

function phoneLog(sim: SimState, tone: LogLine["tone"], text: string): void {
  sim.phoneLog.push({ t: sim.t, text, tone });
}

function trim(lines: LogLine[]): void {
  if (lines.length > LOG_MAX) lines.splice(0, lines.length - LOG_MAX);
}
