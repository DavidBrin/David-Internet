"use client";

/**
 * SVG schematic strip: Controller ⇄ Gateway ⇄ (MQTT broker) ⇄ Phone.
 * Renders sim.packets as small chips moving along the matching link by
 * `progress`, sim.queued as a stacked pile at the gateway, and a hover/
 * last-packet inspector showing the raw JSON payload.
 */
import { useRef, useState } from "react";
import type { Iteration, LinkId, Packet, PacketKind, SimState } from "../sim/core";

const KIND_COLOR: Record<PacketKind, string> = {
  S: "#9ca3af",
  A: "#ef4444",
  K: "#22c55e",
  C: "#3b82f6",
  E: "#f97316",
  HB: "#a855f7",
};

const VB_W = 1000;
const VB_H = 260;
const BOARD_Y = 188;
const NODE_H = 64;
const CTRL_HALF = 75;
const CONTROLLER_X = 110;
const GATEWAY_X = 400;
const CONSOLIDATED_X = 255;
const CLOUD_X = 650;
const CLOUD_Y = 76;
const PHONE_ICON_X = 910;
const PHONE_HALF = 55;

function gwHalfWidth(consolidated: boolean): number {
  return consolidated ? 115 : 75;
}

interface Pt {
  x: number;
  y: number;
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function lerp3(a: Pt, b: Pt, c: Pt, t: number): Pt {
  return t < 0.5 ? lerp(a, b, t / 0.5) : lerp(b, c, (t - 0.5) / 0.5);
}

function pointAlong(link: LinkId, progress: number, iter: Iteration): Pt {
  const consolidated = iter === 3;
  const gwX = consolidated ? CONSOLIDATED_X : GATEWAY_X;
  const gwHalf = gwHalfWidth(consolidated);
  const controllerRight: Pt = { x: CONTROLLER_X + CTRL_HALF, y: BOARD_Y };
  const gatewayLeft: Pt = { x: gwX - gwHalf, y: BOARD_Y };
  const gatewayRight: Pt = { x: gwX + gwHalf, y: BOARD_Y };
  const cloud: Pt = { x: CLOUD_X, y: CLOUD_Y };
  const phoneLeft: Pt = { x: PHONE_ICON_X - PHONE_HALF, y: BOARD_Y };

  switch (link) {
    case "uart-up":
      return lerp(controllerRight, gatewayLeft, progress);
    case "uart-down":
      return lerp(gatewayLeft, controllerRight, progress);
    case "wifi-up":
      return lerp3(gatewayRight, cloud, phoneLeft, progress);
    case "wifi-down":
      return lerp3(phoneLeft, cloud, gatewayRight, progress);
  }
}

function jsonPretty(payload: string): string {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

export default function SchematicStrip({ sim }: { sim: SimState }) {
  const [hoverId, setHoverId] = useState<number | null>(null);
  const lastPacketRef = useRef<Packet | null>(null);

  const packets = sim.packets;
  if (packets.length) {
    let latest = packets[0];
    for (const p of packets) if (p.id > latest.id) latest = p;
    lastPacketRef.current = latest;
  }
  const hovered = hoverId != null ? packets.find((p) => p.id === hoverId) ?? null : null;
  const inspected = hovered ?? lastPacketRef.current;

  const iter = sim.iteration;
  const consolidated = iter === 3;
  const gwX = consolidated ? CONSOLIDATED_X : GATEWAY_X;
  const gwHalf = gwHalfWidth(consolidated);
  const controllerLabel = "Arduino Uno";
  const gatewayLabel = consolidated ? "ESP32-S3 (consolidated)" : iter === 2 ? "Arduino R4 WiFi" : "ESP32-S3";
  const queued = sim.queued;

  return (
    <div className="hhWireStripWrap hhCanvasWrap">
      <svg className="hhWireSvg" viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label="packet path schematic">
        {!consolidated && (
          <>
            <line
              x1={CONTROLLER_X + CTRL_HALF}
              y1={BOARD_Y}
              x2={gwX - gwHalf}
              y2={BOARD_Y}
              className="hhWireLink hhWireLink--uart"
            />
            <text x={(CONTROLLER_X + CTRL_HALF + gwX - gwHalf) / 2} y={BOARD_Y + 24} className="hhWireLinkLabel" textAnchor="middle">
              JSON over UART @ 9600
            </text>
          </>
        )}

        <polyline
          points={`${gwX + gwHalf},${BOARD_Y} ${CLOUD_X},${CLOUD_Y} ${PHONE_ICON_X - PHONE_HALF},${BOARD_Y}`}
          className="hhWireLink hhWireLink--wifi"
          fill="none"
        />
        <text x={(gwX + gwHalf + CLOUD_X) / 2} y={BOARD_Y - 18} className="hhWireLinkLabel" textAnchor="middle">
          {`ucsd/hardhack/<team>/status · /command`}
        </text>

        {!consolidated && (
          <g>
            <rect x={CONTROLLER_X - CTRL_HALF} y={BOARD_Y - NODE_H / 2} width={CTRL_HALF * 2} height={NODE_H} rx={10} className="hhWireNode" />
            <text x={CONTROLLER_X} y={BOARD_Y + 5} textAnchor="middle" className="hhWireNodeLabel">
              {controllerLabel}
            </text>
          </g>
        )}

        <g>
          <rect x={gwX - gwHalf} y={BOARD_Y - NODE_H / 2} width={gwHalf * 2} height={NODE_H} rx={10} className="hhWireNode" />
          <text x={gwX} y={BOARD_Y + 5} textAnchor="middle" className="hhWireNodeLabel">
            {gatewayLabel}
          </text>
        </g>

        <g className="hhWireCloud">
          <ellipse cx={CLOUD_X - 22} cy={CLOUD_Y + 6} rx={26} ry={17} />
          <ellipse cx={CLOUD_X + 22} cy={CLOUD_Y + 6} rx={26} ry={17} />
          <ellipse cx={CLOUD_X} cy={CLOUD_Y - 8} rx={32} ry={22} />
          <text x={CLOUD_X} y={CLOUD_Y + 44} textAnchor="middle" className="hhWireNodeLabel">
            MQTT broker
          </text>
        </g>

        <g>
          <rect
            x={PHONE_ICON_X - PHONE_HALF}
            y={BOARD_Y - NODE_H / 2}
            width={PHONE_HALF * 2}
            height={NODE_H}
            rx={12}
            className="hhWireNode hhWireNode--phone"
          />
          <text x={PHONE_ICON_X} y={BOARD_Y + 5} textAnchor="middle" className="hhWireNodeLabel">
            Phone
          </text>
        </g>

        {queued.length > 0 && (
          <g transform={`translate(${gwX}, ${BOARD_Y + 56})`}>
            {queued.slice(0, 5).map((p, i) => (
              <rect key={p.id} x={-10 + i * 4} y={-8 - i * 3} width={20} height={14} rx={3} className="hhWireQueueChip" />
            ))}
            <text x={24} y={2} className="hhWireQueueCount">
              {`×${queued.length} queued`}
            </text>
          </g>
        )}

        {packets.map((p) => {
          const pt = pointAlong(p.link, p.progress, iter);
          const w = p.kind.length > 1 ? 28 : 20;
          return (
            <g
              key={p.id}
              transform={`translate(${pt.x}, ${pt.y})`}
              className={`hhWirePacket${p.malformed ? " hhWirePacket--malformed" : ""}`}
              onMouseEnter={() => setHoverId(p.id)}
              onMouseLeave={() => setHoverId((id) => (id === p.id ? null : id))}
            >
              <rect x={-w / 2} y={-10} width={w} height={20} rx={5} fill={KIND_COLOR[p.kind]} />
              <text y={4} textAnchor="middle" className="hhWirePacketLabel">
                {p.kind}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="hhWireInspector">
        {inspected ? (
          <>
            <span className="hhLabel">
              packet {inspected.kind}
              {inspected.malformed ? " · malformed" : ""} · {inspected.link}
            </span>
            <pre className="hhMono hhWireInspectorBody">{jsonPretty(inspected.payload)}</pre>
          </>
        ) : (
          <span className="hhNote">Hover a packet to inspect its payload.</span>
        )}
      </div>
    </div>
  );
}
