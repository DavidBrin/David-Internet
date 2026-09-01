"use client";

/**
 * The architecture switcher — three hardware iterations built in one weekend.
 * Renders straight off sim/wiring.ts (WIRING[1|2|3]); switching tabs calls
 * actions.setIteration(), which reboots the shared sim (the house + wire
 * panels re-lay themselves off sim.iteration automatically).
 */
import { useSimHandle, useSimTick } from "../sim/store";
import { WIRING } from "../sim/wiring";
import type { Iteration } from "../sim/core";
import "./iterations.css";

const TABS: { it: Iteration; label: string }[] = [
  { it: 1, label: "① Uno + ESP32-S3" },
  { it: 2, label: "② Uno + R4 WiFi" },
  { it: 3, label: "③ ESP32-S3 consolidated" },
];

function chipsFor(it: Iteration): string[] {
  if (it === 1) return ["threshold 12 cm", "SoftwareSerial 9600 (voltage-divider gateway)"];
  if (it === 2) return ["threshold 12 cm", "SoftwareSerial 9600 (5V direct, no divider)"];
  return [
    "threshold 11 cm",
    "no UART — single board",
    "status → broker on state change",
    "WS2812 ×30 on GPIO5 — aesthetic cycle, decoupled from alarm",
  ];
}

function Diagram({ iteration }: { iteration: Iteration }) {
  const w = WIRING[iteration];
  const single = w.boards.length === 1;
  const link = w.links[0];
  const leftX = single ? 190 : 40;
  const rightX = 320;

  return (
    <svg className="hhIterDiagram" viewBox="0 0 480 150" role="img" aria-label={`${w.title} architecture diagram`}>
      <g className="hhIterLink" style={{ opacity: single ? 0 : 1 }}>
        <line x1={140} y1={75} x2={rightX} y2={75} />
        <text x={(140 + rightX) / 2} y={64} textAnchor="middle" className="hhIterLinkLabel">
          {link?.label ?? ""}
        </text>
      </g>

      <g className="hhIterWifi" style={{ opacity: single ? 1 : 0 }} transform={`translate(${leftX + 130}, 50)`}>
        <path d="M6,26 Q30,-2 54,26" />
        <path d="M14,26 Q30,8 46,26" />
        <path d="M22,26 Q30,18 38,26" />
        <circle cx="30" cy="30" r="3" />
        <text x="30" y="-10" textAnchor="middle" className="hhIterLinkLabel">
          {link?.label ?? ""}
        </text>
      </g>

      <g className="hhIterBoard" style={{ transform: `translate(${leftX}px, 40px)` }}>
        <rect width="100" height="70" rx="10" />
        <text x="50" y="39" textAnchor="middle">
          {w.boards[0]}
        </text>
      </g>

      <g
        className="hhIterBoard"
        style={{ transform: `translate(${rightX}px, 40px)`, opacity: single ? 0 : 1 }}
      >
        <rect width="100" height="70" rx="10" />
        <text x="50" y="39" textAnchor="middle">
          {w.boards[1] ?? ""}
        </text>
      </g>
    </svg>
  );
}

export default function IterationsPanel() {
  const sim = useSimTick();
  const { actions } = useSimHandle();
  const w = WIRING[sim.iteration];

  return (
    <div className="hhIter">
      <div className="hhRow">
        {TABS.map((t) => (
          <button
            key={t.it}
            type="button"
            className="hhBtn"
            data-active={sim.iteration === t.it}
            onClick={() => actions.setIteration(t.it)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="hhIterWhy">{w.why}</p>

      <div className="hhIterDiagramWrap">
        <Diagram iteration={sim.iteration} />
        {w.links.map((l) => (
          <div key={l.label} className="hhIterLinkDetail hhNote">
            <span className="hhLabel">{l.label}</span> — {l.detail}
          </div>
        ))}
      </div>

      <div className="hhRow hhIterChips">
        {chipsFor(sim.iteration).map((c) => (
          <span key={c} className="hhIterChip">
            {c}
          </span>
        ))}
      </div>

      <div className="hhIterTables">
        {w.components.map((c) => (
          <div key={c.id} className="hhIterTableBlock">
            <div className="hhLabel">{c.name}</div>
            <div className="hhIterTableWrap">
              <table className="hhIterTable">
                <thead>
                  <tr>
                    <th aria-label="wire color" />
                    <th>Pin</th>
                    <th />
                    <th>Board pin</th>
                    <th>Board</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {c.wires.map((wire, i) => (
                    <tr key={i}>
                      <td>
                        <span className="hhIterDot" style={{ background: wire.color }} />
                      </td>
                      <td className="hhMono">{wire.from}</td>
                      <td className="hhIterArrow">→</td>
                      <td className="hhMono">{wire.to}</td>
                      <td>{wire.board}</td>
                      <td className="hhIterNote">{wire.note ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <p className="hhNote">
        Which iteration ran for the judges is lost to the weekend — the switcher shows all three.
      </p>
    </div>
  );
}
