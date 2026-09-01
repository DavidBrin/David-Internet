/**
 * Pin maps for the three hardware iterations, transcribed from the hand-written
 * ASCII diagrams in demos/hardhack2026_intrusion_system_raw/intrusion-system/
 * (WIRING_DIAGRAM.md, CONSOLIDATED_WIRING.md, LED_STRIP_INTEGRATION.md).
 * MQTT topics are scrubbed to <team> per the demo spec.
 */
import type { Iteration } from "./core";

export interface Wire {
  /** Component-side pin label, e.g. "TRIG". */
  from: string;
  /** Board-side pin, e.g. "D9" / "GPIO17". */
  to: string;
  /** Which board the wire lands on. */
  board: string;
  /** Wire color used in the overlay. */
  color: string;
  note?: string;
}

export interface ComponentWiring {
  /** Stable id the house SVG uses, e.g. "hcsr04". */
  id: string;
  name: string;
  wires: Wire[];
}

export interface IterationWiring {
  iteration: Iteration;
  title: string;
  boards: string[];
  why: string;
  components: ComponentWiring[];
  /** One-line link descriptions for the wire strip. */
  links: { label: string; detail: string }[];
}

const C = {
  sig: "#e11d48",
  echo: "#0ea5e9",
  pwr: "#dc2626",
  gnd: "#374151",
  i2c: "#8b5cf6",
  uart: "#f59e0b",
  data: "#10b981",
};

export const WIRING: Record<Iteration, IterationWiring> = {
  1: {
    iteration: 1,
    title: "Uno + ESP32-S3 (UART gateway)",
    boards: ["Arduino Uno", "ESP32-S3-Mini"],
    why: "The Uno owns the sensors and the state machine; the ESP32 exists only to give it WiFi. A JSON-over-UART protocol at 9600 baud connects them - with a 1kΩ/2kΩ voltage divider so the Uno's 5 V TX doesn't cook the ESP32's 3.3 V input.",
    components: [
      {
        id: "hcsr04",
        name: "HC-SR04 ultrasonic",
        wires: [
          { from: "TRIG", to: "D9", board: "Arduino Uno", color: C.sig },
          { from: "ECHO", to: "D10", board: "Arduino Uno", color: C.echo },
          { from: "VCC", to: "5V", board: "Arduino Uno", color: C.pwr },
          { from: "GND", to: "GND", board: "Arduino Uno", color: C.gnd },
        ],
      },
      {
        id: "vcnl4040",
        name: "VCNL4040 proximity (I2C)",
        wires: [
          { from: "SDA", to: "A4", board: "Arduino Uno", color: C.i2c, note: "4.7kΩ pull-up to 3.3V" },
          { from: "SCL", to: "A5", board: "Arduino Uno", color: C.i2c, note: "4.7kΩ pull-up to 3.3V" },
          { from: "VDD", to: "3.3V", board: "Arduino Uno", color: C.pwr, note: "3.3V only - 5V damages it" },
          { from: "GND", to: "GND", board: "Arduino Uno", color: C.gnd },
        ],
      },
      {
        id: "servo",
        name: "Servo (door lock)",
        wires: [
          { from: "SIG", to: "D6", board: "Arduino Uno", color: C.sig, note: "PWM" },
          { from: "VCC", to: "ext 5-6V", board: "Arduino Uno", color: C.pwr, note: "external supply, not the Uno" },
          { from: "GND", to: "GND", board: "Arduino Uno", color: C.gnd },
        ],
      },
      {
        id: "buzzer",
        name: "Buzzer",
        wires: [
          { from: "+", to: "D7", board: "Arduino Uno", color: C.sig },
          { from: "-", to: "GND", board: "Arduino Uno", color: C.gnd },
        ],
      },
      {
        id: "leds",
        name: "Status LEDs",
        wires: [
          { from: "GREEN", to: "D3", board: "Arduino Uno", color: C.data, note: "220Ω series" },
          { from: "RED", to: "D4", board: "Arduino Uno", color: C.sig, note: "220Ω series" },
        ],
      },
      {
        id: "uart",
        name: "UART Uno ⇄ ESP32",
        wires: [
          { from: "D2 (TX)", to: "GPIO17 (RX)", board: "ESP32-S3-Mini", color: C.uart, note: "through 1kΩ/2kΩ divider: 5V → 3.33V" },
          { from: "D5 (RX)", to: "GPIO18 (TX)", board: "ESP32-S3-Mini", color: C.uart, note: "3.3V direct - safe" },
          { from: "GND", to: "GND", board: "ESP32-S3-Mini", color: C.gnd, note: "common ground - critical" },
        ],
      },
    ],
    links: [
      { label: "UART 9600", detail: 'JSON packets: S status / A alert up, K ack / C config down ("comm_protocol.h")' },
      { label: "WiFi → MQTT", detail: "ESP32 republishes to ucsd/hardhack/<team>/status; subscribes .../command" },
    ],
  },
  2: {
    iteration: 2,
    title: "Uno + Arduino R4 WiFi",
    boards: ["Arduino Uno", "Arduino R4 WiFi"],
    why: "Same protocol, different gateway: the R4 WiFi replaces the ESP32 so both boards speak 5 V logic - no voltage divider - and the Arduino toolchain covers everything. WPA2-Enterprise on the campus network is what fought back.",
    components: [
      {
        id: "hcsr04",
        name: "HC-SR04 ultrasonic",
        wires: [
          { from: "TRIG", to: "D9", board: "Arduino Uno", color: C.sig },
          { from: "ECHO", to: "D10", board: "Arduino Uno", color: C.echo },
        ],
      },
      {
        id: "vcnl4040",
        name: "VCNL4040 proximity (I2C)",
        wires: [
          { from: "SDA", to: "A4", board: "Arduino Uno", color: C.i2c },
          { from: "SCL", to: "A5", board: "Arduino Uno", color: C.i2c },
        ],
      },
      {
        id: "servo",
        name: "Servo (door lock)",
        wires: [{ from: "SIG", to: "D6", board: "Arduino Uno", color: C.sig }],
      },
      {
        id: "buzzer",
        name: "Buzzer",
        wires: [{ from: "+", to: "D7", board: "Arduino Uno", color: C.sig }],
      },
      {
        id: "leds",
        name: "Status LEDs",
        wires: [
          { from: "GREEN", to: "D3", board: "Arduino Uno", color: C.data },
          { from: "RED", to: "D4", board: "Arduino Uno", color: C.sig },
        ],
      },
      {
        id: "uart",
        name: "UART Uno ⇄ R4",
        wires: [
          { from: "D2 (TX)", to: "RX", board: "Arduino R4 WiFi", color: C.uart, note: "5V ⇄ 5V - no divider needed" },
          { from: "D5 (RX)", to: "TX", board: "Arduino R4 WiFi", color: C.uart },
          { from: "GND", to: "GND", board: "Arduino R4 WiFi", color: C.gnd },
        ],
      },
    ],
    links: [
      { label: "UART 9600", detail: "identical comm_protocol.h packets - the protocol survived the board swap unchanged" },
      { label: "WiFi → MQTT", detail: "R4's WiFiS3 stack + PubSubClient; 60 s heartbeat, reconnect counters" },
    ],
  },
  3: {
    iteration: 3,
    title: "ESP32-S3 consolidated",
    boards: ["ESP32-S3-Mini"],
    why: "Everything moves onto the ESP32-S3: sensors, servo, buzzer, LEDs, the WS2812 strip, WiFi and MQTT on one board - no UART link left to debug. Threshold retuned to 11 cm; state changes publish straight to the broker.",
    components: [
      {
        id: "hcsr04",
        name: "HC-SR04 ultrasonic",
        wires: [
          { from: "TRIG", to: "GPIO2", board: "ESP32-S3-Mini", color: C.sig },
          { from: "ECHO", to: "GPIO3", board: "ESP32-S3-Mini", color: C.echo },
          { from: "VCC", to: "5V", board: "ESP32-S3-Mini", color: C.pwr },
          { from: "GND", to: "GND", board: "ESP32-S3-Mini", color: C.gnd },
        ],
      },
      {
        id: "vcnl4040",
        name: "VCNL4040 proximity (I2C)",
        wires: [
          { from: "SDA", to: "GPIO21", board: "ESP32-S3-Mini", color: C.i2c, note: "4.7kΩ pull-ups" },
          { from: "SCL", to: "GPIO26", board: "ESP32-S3-Mini", color: C.i2c },
          { from: "VDD", to: "3.3V", board: "ESP32-S3-Mini", color: C.pwr, note: "3.3V only" },
        ],
      },
      {
        id: "servo",
        name: "Servo (door lock)",
        wires: [
          { from: "SIG", to: "GPIO6", board: "ESP32-S3-Mini", color: C.sig, note: "3.3V PWM; 1000µs unlock / 2000µs lock" },
          { from: "VCC", to: "ext 5-6V", board: "ESP32-S3-Mini", color: C.pwr },
        ],
      },
      {
        id: "buzzer",
        name: "Buzzer",
        wires: [
          { from: "+", to: "GPIO7", board: "ESP32-S3-Mini", color: C.sig },
          { from: "-", to: "GND", board: "ESP32-S3-Mini", color: C.gnd },
        ],
      },
      {
        id: "leds",
        name: "Status LEDs",
        wires: [
          { from: "GREEN", to: "GPIO8", board: "ESP32-S3-Mini", color: C.data, note: "220Ω series" },
          { from: "RED", to: "GPIO9", board: "ESP32-S3-Mini", color: C.sig, note: "220Ω series" },
        ],
      },
      {
        id: "ledstrip",
        name: "WS2812 LED strip (30 px)",
        wires: [
          { from: "DIN", to: "GPIO5", board: "ESP32-S3-Mini", color: C.data, note: "FastLED, GRB, brightness 100" },
          { from: "+5V", to: "5V", board: "ESP32-S3-Mini", color: C.pwr, note: "~900 mA at full white - external supply recommended" },
          { from: "GND", to: "GND", board: "ESP32-S3-Mini", color: C.gnd },
        ],
      },
    ],
    links: [
      { label: "WiFi → MQTT", detail: "publishes {armed, state, distance, motion} on state change + 60 s heartbeat; subscribes .../command" },
    ],
  },
};
