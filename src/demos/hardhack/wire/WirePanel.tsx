"use client";

/**
 * The wire — packets, gateway, broker, phone. Schematic strip (Uno/ESP32 ⇄
 * cloud ⇄ phone) with live packet animation, the phone replica, failure
 * toggles (drop WiFi, inject UART noise), and a small stats row. See
 * demos/specs/05_hardhack_intrusion.md, stage 3.
 */
import { useSimHandle, useSimTick } from "../sim/store";
import SchematicStrip from "./SchematicStrip";
import Phone from "./Phone";
import "./wire.css";

const KIND_LEGEND: { kind: string; label: string; color: string }[] = [
  { kind: "S", label: "status", color: "#9ca3af" },
  { kind: "A", label: "alert", color: "#ef4444" },
  { kind: "K", label: "ack", color: "#22c55e" },
  { kind: "C", label: "config", color: "#3b82f6" },
  { kind: "E", label: "error", color: "#f97316" },
  { kind: "HB", label: "heartbeat", color: "#a855f7" },
];

export default function WirePanel() {
  const sim = useSimTick();
  const { actions } = useSimHandle();
  const consolidated = sim.iteration === 3;

  return (
    <div className="hhWirePanel">
      <SchematicStrip sim={sim} />

      <div className="hhWireLegend">
        {KIND_LEGEND.map((k) => (
          <span key={k.kind} className="hhWireLegendItem">
            <i style={{ background: k.color }} />
            {k.kind} <span className="hhWireLegendWord">{k.label}</span>
          </span>
        ))}
      </div>

      <div className="hhWireLower">
        <div className="hhWireControls">
          <div className="hhRow">
            <button
              type="button"
              className="hhBtn"
              data-active={sim.faultWifiDown}
              onClick={() => actions.setFaultWifi(!sim.faultWifiDown)}
            >
              {sim.faultWifiDown ? "Restore WiFi" : "Drop WiFi"}
            </button>
            <button type="button" className="hhBtn" disabled={consolidated} onClick={() => actions.injectUartNoise()}>
              Inject UART noise
            </button>
            {consolidated && <span className="hhNote">No UART link in the consolidated build — nothing to corrupt.</span>}
          </div>
          <p className="hhNote">
            A gateway that gets a garbled UART frame answers with an <code>E</code> error and gives up after{" "}
            <code>UART_MESSAGE_TIMEOUT_MS = 2000</code> ms (comm_protocol.h) rather than hanging forever.
          </p>

          <div className="hhWireStats">
            <div className="hhWireStat">
              <span className="hhLabel">wifi_reconnects</span>
              {sim.wifiReconnects}
            </div>
            <div className="hhWireStat">
              <span className="hhLabel">mqtt_reconnects</span>
              {sim.mqttReconnects}
            </div>
            <div className="hhWireStat">
              <span className="hhLabel">packets in flight</span>
              {sim.packets.length}
            </div>
            <div className="hhWireStat">
              <span className="hhLabel">armed</span>
              {sim.armed ? "ON" : "OFF"}
            </div>
          </div>
        </div>

        <Phone sim={sim} actions={actions} />
      </div>
    </div>
  );
}
