"use client";

/**
 * The map itself: one inline SVG of an environment. Nodes are buttons (click to
 * open the detail card), edges are routed border-to-border, and a running flow
 * lights its edges in order.
 */
import { useMemo } from "react";
import { BANDS, EDGES, NODES, VIEW, VPC_FRAME, nodeById, type CloudNode } from "./core/model";
import { pathData, routeEdge } from "./core/geometry";

export interface CloudMapProps {
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Edge ids already walked by the running flow, in order. */
  litEdges: string[];
  /** The edge currently animating (last of litEdges), or null. */
  activeEdge: string | null;
}

function nodeClass(n: CloudNode, selected: string | null, hot: Set<string>): string {
  const cls = ["dcNode", `dcNode--${n.group}`];
  if (selected === n.id) cls.push("isSelected");
  if (hot.has(n.id)) cls.push("isHot");
  return cls.join(" ");
}

export default function CloudMap({ selected, onSelect, litEdges, activeEdge }: CloudMapProps) {
  const segments = useMemo(() => EDGES.map((e) => ({ edge: e, seg: routeEdge(e, nodeById) })), []);
  const lit = new Set(litEdges);
  const hot = new Set<string>();
  if (activeEdge) {
    const e = EDGES.find((x) => x.id === activeEdge);
    if (e) {
      hot.add(e.from);
      hot.add(e.to);
    }
  }

  return (
    <svg
      className="dcMap"
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      role="img"
      aria-label="Map of one environment of the platform: a VPC with public, app, GPU and data subnets between outside partners on the left and account-wide services on the right"
    >
      <defs>
        <marker id="dcArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
        </marker>
        <marker id="dcArrowHot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--demo-accent)" />
        </marker>
      </defs>

      {/* VPC frame */}
      <rect className="dcVpc" x={VPC_FRAME.x} y={VPC_FRAME.y} width={VPC_FRAME.w} height={VPC_FRAME.h} rx={10} />
      <text className="dcVpcLabel" x={VPC_FRAME.x + 12} y={VPC_FRAME.y + 16}>
        VPC · private by default · one per environment
      </text>

      {/* bands */}
      {BANDS.map((b) => (
        <g key={b.id} className={`dcBand dcBand--${b.id}`}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} />
          <text x={b.x + 10} y={b.y + 14}>
            {b.label}
          </text>
        </g>
      ))}

      {/* edges (below nodes) */}
      {segments.map(({ edge, seg }) => {
        const isLit = lit.has(edge.id);
        const isActive = activeEdge === edge.id;
        const cls = ["dcEdge"];
        if (edge.quiet) cls.push("isQuiet");
        if (edge.dashed) cls.push("isDashed");
        if (isLit) cls.push("isLit");
        if (isActive) cls.push("isActive");
        const showLabel = edge.label && (!edge.quiet || isLit);
        return (
          <g key={edge.id} className={cls.join(" ")} data-edge={edge.id}>
            <polyline
              points={seg.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              markerEnd={isLit ? "url(#dcArrowHot)" : "url(#dcArrow)"}
            />
            {isActive ? (
              <circle className="dcPulse" r={5}>
                <animateMotion path={pathData(seg)} dur="1.1s" repeatCount="indefinite" />
              </circle>
            ) : null}
            {showLabel ? (
              <text className="dcEdgeLabel" x={seg.mid.x} y={seg.mid.y - 4} textAnchor="middle">
                {edge.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* nodes */}
      {NODES.map((n) => (
        <g
          key={n.id}
          className={nodeClass(n, selected, hot)}
          role="button"
          tabIndex={0}
          aria-pressed={selected === n.id}
          aria-label={`${n.label}${n.sub ? `, ${n.sub}` : ""}`}
          data-node={n.id}
          onClick={() => onSelect(selected === n.id ? null : n.id)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              onSelect(selected === n.id ? null : n.id);
            }
          }}
        >
          <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={6} />
          <text className="dcNodeLabel" x={n.x + n.w / 2} y={n.y + (n.sub ? n.h / 2 - 3 : n.h / 2 + 4)} textAnchor="middle">
            {n.label}
          </text>
          {n.sub ? (
            <text className="dcNodeSub" x={n.x + n.w / 2} y={n.y + n.h / 2 + 12} textAnchor="middle">
              {n.sub}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
