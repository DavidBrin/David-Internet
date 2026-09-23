"use client";

/** Details for the clicked node: file, wiring, rate, parameters, and a verbatim excerpt. */
import { NODES, type NodeId } from "./rosData";
import { nodeStatus } from "./RosGraph";
import type { RosRuntime } from "./runtime";

export default function NodeCard({ id, rt }: { id: NodeId; rt: RosRuntime | null }) {
  const n = NODES[id];
  return (
    <div className="acRoCard" data-id={id}>
      <div className="acRoCardHead">
        <div>
          <div className="acRoCardName acMono">{n.name}</div>
          <div className="acRoCardFile">{n.file}</div>
        </div>
        {rt && <span className="acRoLive acMono">{nodeStatus(id, rt)}</span>}
      </div>
      <p className="acRoCardOrigin">{n.origin}</p>

      <div className="acRoWires">
        <div>
          <div className="acRoLabel">Publishes</div>
          {n.pubs.length === 0 ? (
            <div className="acRoMutedDark">nothing</div>
          ) : (
            n.pubs.map((w) => (
              <div key={w.topic} className="acRoWire">
                <span className="acMono acRoWireTopic">{w.topic}</span> <span className="acMono acRoWireType">{w.type}</span>
                {w.note && <div className="acRoWireNote">{w.note}</div>}
              </div>
            ))
          )}
        </div>
        <div>
          <div className="acRoLabel">Subscribes</div>
          {n.subs.length === 0 ? (
            <div className="acRoMutedDark">nothing</div>
          ) : (
            n.subs.map((w) => (
              <div key={w.topic} className="acRoWire">
                <span className="acMono acRoWireTopic">{w.topic}</span> <span className="acMono acRoWireType">{w.type}</span>
                {w.note && <div className="acRoWireNote">{w.note}</div>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="acRoLabel">Timer / rate</div>
      <div className="acMono acRoRate">{n.rate}</div>

      <div className="acRoLabel">Key parameters</div>
      <dl className="acRoParams">
        {n.params.map(([k, v]) => (
          <div key={k}>
            <dt className="acMono">{k}</dt>
            <dd className="acMono">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="acRoExcerpt">
        <div className="acRoExcerptHead acMono">
          {n.excerpt.file}
          <span>lines {n.excerpt.lines}</span>
        </div>
        <pre className="acRoCode">{n.excerpt.code}</pre>
      </div>
      {n.note && <div className="acNote">{n.note}</div>}
    </div>
  );
}
