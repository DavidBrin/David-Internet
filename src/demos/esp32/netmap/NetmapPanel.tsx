"use client";

/**
 * Side quest: the TA4 WiFi net-map.
 *
 * Real pipeline (wifiscrape_webserver.py): an ESP32 scans nearby networks and
 * POSTs them to FastAPI at /get_netscan; the same last scan is rendered as a
 * graph at /netmap_graph (a matplotlib bar chart server-side — here we draw a
 * force-directed graph in the browser instead, from the same shaped data).
 *
 * Data is synthetic (public/demos/esp32/netmap.json): 3 scans, each a list of
 * {ssid, bssid, channel, rssi, band}. Networks are matched across scans by
 * ssid so a "rescan" reads as one graph re-settling, not a new one appearing:
 * APs that vanish fade out, new ones fade/scale in, and RSSI changes retension
 * the spring pulling each node toward the scanner.
 *
 * The layout is a ~60-line custom force sim (no d3): all-pairs repulsion, one
 * spring per AP back to the fixed "ESP32" hub (rest length from RSSI), a mild
 * centering pull, Euler integration with damping, run on requestAnimationFrame
 * until kinetic energy + fade animations settle, then the loop stops itself.
 * Nodes are draggable (pointer capture pins a node while dragging).
 */
import { useEffect, useRef, useState } from "react";
import "./netmap.css";

type Band = "2.4GHz" | "5GHz";

interface ApScan {
  ssid: string;
  bssid: string;
  channel: number;
  rssi: number;
  band: Band;
}

interface NetmapJson {
  note: string;
  scans: ApScan[][];
}

interface PhysNode {
  ssid: string;
  bssid: string;
  channel: number;
  band: Band;
  rssi: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Pinned target while dragging; null = free. */
  fx: number | null;
  fy: number | null;
  opacity: number;
  targetOpacity: number;
}

// -------------------------------------------------------------- geometry / sim tuning

const WIDTH = 640;
const HEIGHT = 420;
const CX = 250;
const CY = 205;
const MARGIN = 56;

const REPULSION = 9000;
const SPRING_K = 0.02;
const CENTER_PULL = 0.0015;
const DAMPING = 0.82;
const FADE_STEP = 0.07;
const SETTLE_KINETIC = 0.02;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Stronger signal (less negative RSSI) -> shorter spring -> node sits closer to the scanner. */
function restLength(rssi: number): number {
  return clamp(50 + (-30 - rssi) * 1.8, 50, 160);
}

function nodeRadius(rssi: number): number {
  return clamp(6 + (rssi + 90) * 0.22, 6, 20);
}

/** 0..100 bar fill, -90 dBm (weak) .. -30 dBm (strong). */
function rssiPct(rssi: number): number {
  return clamp(((rssi + 90) / 60) * 100, 4, 100);
}

function bandColor(band: Band): string {
  return band === "2.4GHz" ? "#0d9488" : "#7c3aed"; // teal / violet — reads on the amber page
}

// -------------------------------------------------------------- component

export default function NetmapPanel() {
  const [data, setData] = useState<NetmapJson | null>(null);
  const [scanIndex, setScanIndex] = useState(0);
  const [activeAps, setActiveAps] = useState<ApScan[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const physicsRef = useRef<Map<string, PhysNode>>(new Map());
  const runningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const dragKeyRef = useRef<string | null>(null);

  // -------------------------------------------------------- simulation loop

  function step() {
    const nodes = Array.from(physicsRef.current.values());

    // Pinned nodes snap straight to the pointer; everything else feels a
    // repulsion + spring + weak centering force each frame.
    for (const n of nodes) {
      if (n.fx != null && n.fy != null) {
        n.x = n.fx;
        n.y = n.fy;
        n.vx = 0;
        n.vy = 0;
      }
    }

    let kinetic = 0;
    for (const a of nodes) {
      if (a.fx != null) continue;
      let fx = 0;
      let fy = 0;

      for (const b of nodes) {
        if (a === b) continue;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 4) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = 1;
        }
        const d = Math.sqrt(d2);
        const f = REPULSION / d2;
        fx += (dx / d) * f;
        fy += (dy / d) * f;
      }

      // Repel from the scanner hub too, so nodes don't pile on top of it.
      {
        let dx = a.x - CX;
        let dy = a.y - CY;
        let d2 = dx * dx + dy * dy;
        if (d2 < 4) {
          dx = 1;
          dy = 0;
          d2 = 1;
        }
        const d = Math.sqrt(d2);
        const f = (REPULSION * 0.5) / d2;
        fx += (dx / d) * f;
        fy += (dy / d) * f;
      }

      // Spring back to the scanner; rest length carries the RSSI signal.
      {
        const rest = restLength(a.rssi);
        const dx = CX - a.x;
        const dy = CY - a.y;
        const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const diff = d - rest;
        const f = diff * SPRING_K;
        fx += (dx / d) * f;
        fy += (dy / d) * f;
      }

      // Mild centering so the whole layout stays balanced in the canvas.
      fx += (CX - a.x) * CENTER_PULL;
      fy += (CY - a.y) * CENTER_PULL;

      a.vx = (a.vx + fx) * DAMPING;
      a.vy = (a.vy + fy) * DAMPING;
      a.x = clamp(a.x + a.vx, MARGIN, WIDTH - MARGIN);
      a.y = clamp(a.y + a.vy, MARGIN, HEIGHT - MARGIN);
      kinetic += a.vx * a.vx + a.vy * a.vy;
    }

    // Fade in/out toward target opacity; drop fully-faded leaving nodes.
    let animating = false;
    for (const n of physicsRef.current.values()) {
      if (Math.abs(n.opacity - n.targetOpacity) > 0.001) {
        n.opacity = clamp(n.opacity + Math.sign(n.targetOpacity - n.opacity) * FADE_STEP, 0, 1);
        animating = true;
      }
    }
    for (const [key, n] of physicsRef.current) {
      if (n.targetOpacity === 0 && n.opacity <= 0.001) physicsRef.current.delete(key);
    }

    setTick((t) => t + 1);

    const stillSettling = kinetic > SETTLE_KINETIC || animating || dragKeyRef.current != null;
    if (stillSettling) {
      rafRef.current = requestAnimationFrame(step);
    } else {
      runningRef.current = false;
      rafRef.current = null;
    }
  }

  function wake() {
    if (runningRef.current) return;
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // -------------------------------------------------------- data load + scan switching

  useEffect(() => {
    let alive = true;
    fetch("/demos/esp32/netmap.json")
      .then((r) => {
        if (!r.ok) throw new Error(`netmap.json ${r.status}`);
        return r.json() as Promise<NetmapJson>;
      })
      .then((j) => {
        if (alive) setData(j);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (data) applyScan(0, /* fadeIn */ false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function applyScan(idx: number, fadeIn = true) {
    if (!data) return;
    const scan = data.scans[idx];
    setActiveAps(scan);
    setScanIndex(idx);

    const incoming = new Map(scan.map((ap) => [ap.ssid, ap] as const));
    const phys = physicsRef.current;

    for (const [key, n] of phys) {
      if (!incoming.has(key)) n.targetOpacity = 0;
    }

    for (const [key, ap] of incoming) {
      const existing = phys.get(key);
      if (existing) {
        existing.bssid = ap.bssid;
        existing.channel = ap.channel;
        existing.band = ap.band;
        existing.rssi = ap.rssi;
        existing.targetOpacity = 1;
      } else {
        const angle = Math.random() * Math.PI * 2;
        phys.set(key, {
          ssid: ap.ssid,
          bssid: ap.bssid,
          channel: ap.channel,
          band: ap.band,
          rssi: ap.rssi,
          x: CX + Math.cos(angle) * 12,
          y: CY + Math.sin(angle) * 12,
          vx: 0,
          vy: 0,
          fx: null,
          fy: null,
          opacity: fadeIn ? 0 : 1,
          targetOpacity: 1,
        });
      }
    }

    wake();
  }

  function handleRescan() {
    if (!data) return;
    applyScan((scanIndex + 1) % data.scans.length, true);
  }

  // -------------------------------------------------------- drag handling

  function toSvgPoint(el: SVGGraphicsElement, clientX: number, clientY: number) {
    const svg = el.ownerSVGElement;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  }

  function onNodePointerDown(e: React.PointerEvent<SVGGElement>, key: string) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragKeyRef.current = key;
    const node = physicsRef.current.get(key);
    if (node) {
      const p = toSvgPoint(e.currentTarget, e.clientX, e.clientY);
      node.fx = p.x;
      node.fy = p.y;
    }
    wake();
  }

  function onNodePointerMove(e: React.PointerEvent<SVGGElement>, key: string) {
    if (dragKeyRef.current !== key) return;
    const node = physicsRef.current.get(key);
    if (!node) return;
    const p = toSvgPoint(e.currentTarget, e.clientX, e.clientY);
    node.fx = clamp(p.x, MARGIN, WIDTH - MARGIN);
    node.fy = clamp(p.y, MARGIN, HEIGHT - MARGIN);
  }

  function onNodePointerUp(e: React.PointerEvent<SVGGElement>, key: string) {
    if (dragKeyRef.current === key) {
      const node = physicsRef.current.get(key);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      dragKeyRef.current = null;
      wake();
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // no-op: pointer capture may already be released
    }
  }

  // -------------------------------------------------------- derived render data

  const nodes = Array.from(physicsRef.current.values());
  const scanCount = data?.scans.length ?? 3;

  const slots: { key: string; label: string; match: (ap: ApScan) => boolean }[] = [
    { key: "1", label: "Ch 1", match: (ap) => ap.band === "2.4GHz" && ap.channel === 1 },
    { key: "6", label: "Ch 6", match: (ap) => ap.band === "2.4GHz" && ap.channel === 6 },
    { key: "11", label: "Ch 11", match: (ap) => ap.band === "2.4GHz" && ap.channel === 11 },
    { key: "5g", label: "5 GHz", match: (ap) => ap.band === "5GHz" },
  ];

  return (
    <div className="etMapRoot">
      <svg className="etMapPipeline" viewBox="0 0 640 64" role="img" aria-label="ESP32 net-map data pipeline">
        <defs>
          <marker id="etMapArrowHead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#d6b98c" />
          </marker>
        </defs>
        <rect x="4" y="14" width="150" height="36" rx="8" className="etMapPipeBox" />
        <text x="79" y="36" className="etMapPipeLabel" textAnchor="middle">
          ESP32 scanner
        </text>

        <path d="M158,32 L268,32" className="etMapPipeArrow" />
        <text x="213" y="24" className="etMapPipeEndpoint" textAnchor="middle">
          POST /get_netscan
        </text>

        <rect x="272" y="14" width="110" height="36" rx="8" className="etMapPipeBoxAccent" />
        <text x="327" y="36" className="etMapPipeLabel" textAnchor="middle">
          FastAPI
        </text>

        <path d="M386,32 L496,32" className="etMapPipeArrow" />
        <text x="441" y="24" className="etMapPipeEndpoint" textAnchor="middle">
          GET /netmap_graph
        </text>

        <rect x="500" y="14" width="136" height="36" rx="8" className="etMapPipeBox" />
        <text x="568" y="36" className="etMapPipeLabel" textAnchor="middle">
          this graph
        </text>
      </svg>

      <div className="etRow">
        <button type="button" className="etBtn" onClick={handleRescan} disabled={!data}>
          Rescan
        </button>
        <span className="etMono">
          scan {scanIndex + 1}/{scanCount}
        </span>
      </div>

      <div className="etMapGraphRow">
        <div className="etCanvasWrap etMapGraphWrap">
          <svg className="etMapGraphSvg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
            {nodes.map((n) => (
              <line
                key={`edge-${n.ssid}`}
                className="etMapEdge"
                x1={CX}
                y1={CY}
                x2={n.x}
                y2={n.y}
                strokeWidth={clamp((n.rssi + 90) / 18, 1, 4)}
                opacity={n.opacity * 0.65}
              />
            ))}

            <g className="etMapScanner">
              <circle cx={CX} cy={CY} r={24} />
              <text x={CX} y={CY}>
                ESP32
              </text>
            </g>

            {nodes.map((n) => {
              const r = nodeRadius(n.rssi);
              const hi = hovered === n.ssid;
              const scale = 0.5 + 0.5 * n.opacity;
              const labelLeft = n.x > WIDTH * 0.62;
              return (
                <g
                  key={n.ssid}
                  className="etMapNode"
                  transform={`translate(${n.x} ${n.y}) scale(${scale})`}
                  opacity={n.opacity}
                  onPointerDown={(e) => onNodePointerDown(e, n.ssid)}
                  onPointerMove={(e) => onNodePointerMove(e, n.ssid)}
                  onPointerUp={(e) => onNodePointerUp(e, n.ssid)}
                  onPointerEnter={() => setHovered(n.ssid)}
                  onPointerLeave={() => {
                    if (dragKeyRef.current == null) setHovered((h) => (h === n.ssid ? null : h));
                  }}
                >
                  <circle
                    className={`etMapNodeCircle${hi ? " etMapNodeHi" : ""}`}
                    r={r}
                    fill={bandColor(n.band)}
                  />
                  <g transform={`translate(${r * 0.62} ${r * 0.62})`} className="etMapChBadge">
                    <rect x={-9} y={-6} width={18} height={12} rx={4} />
                    <text x={0} y={0.5}>
                      {n.channel}
                    </text>
                  </g>
                  <text
                    className={`etMapNodeLabel${hi ? " etMapNodeHi" : ""}`}
                    x={labelLeft ? -(r + 6) : r + 6}
                    y={0}
                    textAnchor={labelLeft ? "end" : "start"}
                  >
                    {n.ssid}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="etMapTableWrap">
          <table className="etMapTable">
            <thead>
              <tr>
                <th>SSID</th>
                <th>BSSID</th>
                <th>Ch</th>
                <th>Band</th>
                <th>RSSI</th>
              </tr>
            </thead>
            <tbody>
              {activeAps.map((ap) => (
                <tr
                  key={ap.ssid}
                  className={`etMapRow${hovered === ap.ssid ? " etMapRowHi" : ""}`}
                  onMouseEnter={() => setHovered(ap.ssid)}
                  onMouseLeave={() => setHovered((h) => (h === ap.ssid ? null : h))}
                >
                  <td className="etMono">
                    <span className="etMapBandDot" style={{ background: bandColor(ap.band) }} />
                    {ap.ssid}
                  </td>
                  <td className="etMono">{ap.bssid}</td>
                  <td>{ap.channel}</td>
                  <td>{ap.band}</td>
                  <td>
                    <div className="etMapRssiCell">
                      <span className="etMono">{ap.rssi}</span>
                      <span className="etMapRssiBar">
                        <span
                          className="etMapRssiBarFill"
                          style={{ width: `${rssiPct(ap.rssi)}%`, background: bandColor(ap.band) }}
                        />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="etMapCongestion">
        <span className="etLabel">Channel congestion</span>
        <div className="etMapCongestionRow">
          {slots.map((slot) => {
            const aps = activeAps.filter(slot.match);
            return (
              <div className="etMapSlot" key={slot.key}>
                <div className="etMapSlotDots">
                  {aps.map((ap) => (
                    <span
                      key={ap.ssid}
                      className="etMapSlotDot"
                      style={{
                        background: bandColor(ap.band),
                        outline: hovered === ap.ssid ? "2px solid #f97316" : "none",
                      }}
                      onMouseEnter={() => setHovered(ap.ssid)}
                      onMouseLeave={() => setHovered((h) => (h === ap.ssid ? null : h))}
                    />
                  ))}
                </div>
                <span className="etMapSlotLabel">{slot.label}</span>
                <span className="etMapSlotCount">{aps.length}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="etNote">
        Synthetic scans — real SSIDs and BSSIDs would map the neighbors around the sensor; the
        pipeline shape (ESP32 → <span className="etMono">POST /get_netscan</span> → FastAPI →{" "}
        <span className="etMono">GET /netmap_graph</span>) is the real one from{" "}
        <span className="etMono">wifiscrape_webserver.py</span>.
      </p>
    </div>
  );
}
