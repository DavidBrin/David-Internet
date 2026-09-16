// Conceptual "how retrieval works at inference time" diagrams. These explain the
// retrieval MECHANISM for each chapter; they are not the captured trace and do
// not recompute any decision in the browser. Actual values live in trace.json
// and are rendered by MemoryTimeline's SnapshotDiagram.

const VEC_DOCS: { x: number; y: number; near?: boolean }[] = [
  { x: 392, y: 96 },
  { x: 452, y: 118 },
  { x: 472, y: 150 },
  { x: 520, y: 208 },
  { x: 600, y: 110, near: true },
  { x: 575, y: 158, near: true },
  { x: 628, y: 172, near: true },
  { x: 672, y: 104 },
  { x: 712, y: 206 },
  { x: 730, y: 150 },
  { x: 648, y: 236 },
  { x: 430, y: 226 },
];

/** Flat RAG at inference time — embed the query, take the nearest vectors. */
export function VectorSearchDiagram() {
  const qx = 600;
  const qy = 150;
  return (
    <svg viewBox="0 0 980 300" role="img" aria-label="Flat RAG retrieval: the query is embedded and the nearest document vectors are returned by cosine similarity, with no recency, trust, or policy gate.">
      <defs>
        <marker id="am-vec-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" className="amArrowHead" />
        </marker>
      </defs>

      <g className="amSvgNode">
        <rect x="16" y="116" width="158" height="72" rx="8" />
        <text x="30" y="142" className="amSvgEyebrow">QUERY</text>
        <text x="30" y="165" className="amSvgCopy">“How should I write?”</text>
      </g>
      <line x1="174" y1="152" x2="200" y2="152" className="amArrow" markerEnd="url(#am-vec-arrow)" />

      <g className="amSvgNode">
        <rect x="200" y="116" width="104" height="72" rx="8" />
        <text x="214" y="142" className="amSvgEyebrow">ENCODE</text>
        <text x="214" y="165" className="amSvgCopy">text → vector</text>
      </g>
      <line x1="304" y1="152" x2="330" y2="152" className="amArrow" markerEnd="url(#am-vec-arrow)" />

      <g className="amSvgPanelNode">
        <rect x="330" y="28" width="440" height="248" rx="10" className="amSvgPanel" />
        <text x="350" y="52" className="amSvgEyebrow">VECTOR INDEX</text>
        <text x="752" y="52" className="amSvgSmall" textAnchor="end">cosine · nearest-k</text>
        <circle cx={qx} cy={qy} r="64" className="amSvgRing" />
        {VEC_DOCS.filter((d) => d.near).map((d) => (
          <line key={`l-${d.x}-${d.y}`} x1={qx} y1={qy} x2={d.x} y2={d.y} className="amSvgLink" />
        ))}
        {VEC_DOCS.map((d) => (
          <circle key={`d-${d.x}-${d.y}`} cx={d.x} cy={d.y} r={d.near ? 5 : 3.4} className={d.near ? "amSvgDot amSvgDot--near" : "amSvgDot"} />
        ))}
        <polygon points={`${qx},${qy - 8} ${qx + 8},${qy} ${qx},${qy + 8} ${qx - 8},${qy}`} className="amSvgQuery" />
        {/* legend */}
        <polygon points="352,258 360,262 352,266 344,262" className="amSvgQuery" />
        <text x="366" y="265" className="amSvgSmall">query</text>
        <circle cx="426" cy="262" r="4.5" className="amSvgDot amSvgDot--near" />
        <text x="436" y="265" className="amSvgSmall">nearest-k</text>
        <circle cx="520" cy="262" r="3.4" className="amSvgDot" />
        <text x="530" y="265" className="amSvgSmall">other vectors</text>
      </g>
      <line x1="770" y1="152" x2="796" y2="152" className="amArrow" markerEnd="url(#am-vec-arrow)" />

      <g className="amSvgNode">
        <rect x="796" y="112" width="168" height="84" rx="8" />
        <text x="810" y="138" className="amSvgEyebrow">TOP-K CHUNKS</text>
        <text x="810" y="161" className="amSvgCopy">stuffed into the prompt</text>
        <text x="810" y="181" className="amSvgCopy amSvgCopy--warn">no recency / trust gate</text>
      </g>
    </svg>
  );
}

// A few claims tracked over time; an as_of query returns the version of each
// that is live at the query moment. Dates map to x positions on the axis.
const T_DATES: { x: number; label: string }[] = [
  { x: 132, label: "Apr 6" },
  { x: 236, label: "Apr 20" },
  { x: 420, label: "May 11" },
  { x: 576, label: "Jun 12" },
  { x: 700, label: "today" },
];
const T_OPEN = 784; // right edge for open-ended windows
const T_TODAY = 700;

interface TWindow {
  label: string;
  x1: number;
  x2: number;
  open?: boolean;
  kind: "live" | "closed";
  supersededBy?: number; // x of the version that replaces it
}
interface TLane {
  name: string;
  y: number;
  windows: TWindow[];
  answer: { live: boolean; text: string };
}
const T_LANES: TLane[] = [
  {
    name: "summary style",
    y: 82,
    windows: [
      { label: "concise", x1: 132, x2: 420, kind: "closed", supersededBy: 420 },
      { label: "detailed", x1: 420, x2: T_OPEN, open: true, kind: "live" },
    ],
    answer: { live: true, text: "✓ detailed summary" },
  },
  {
    name: "citations",
    y: 138,
    windows: [{ label: "APA · session-scoped", x1: 236, x2: T_OPEN, open: true, kind: "live" }],
    answer: { live: true, text: "✓ APA citations" },
  },
  {
    name: "pricing doc",
    y: 194,
    windows: [{ label: "2024 cost sheet", x1: 132, x2: T_OPEN, open: true, kind: "live" }],
    answer: { live: true, text: "✓ 2024 cost sheet" },
  },
  {
    name: "salary review",
    y: 250,
    windows: [{ label: "salary review · sensitive", x1: 236, x2: 576, kind: "closed" }],
    answer: { live: false, text: "✕ salary review" },
  },
];

/** Temporal retrieval — an as_of query returns the live version of each claim. */
export function TemporalQueryDiagram() {
  const axisY = 340;
  return (
    <svg viewBox="0 0 1000 452" role="img" aria-label="Temporal retrieval: several claims are tracked as validity windows over time; an as_of query at today returns the version of each claim whose window is open, so a superseded or closed window no longer answers.">
      <defs>
        <marker id="am-temporal-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" className="amArrowHead" />
        </marker>
      </defs>
      <text x="16" y="28" className="amSvgDiagTitle">Temporal retrieval: an as_of query returns the live version of each claim</text>

      {/* lanes: validity windows per claim */}
      {T_LANES.map((lane) => (
        <g key={lane.name}>
          <text x="16" y={lane.y + 16} className="amSvgSmall amSvgSmall--slate">{lane.name}</text>
          {lane.windows.map((w) => {
            const hit = w.kind === "live" && w.x1 <= T_TODAY && (w.open || w.x2 >= T_TODAY);
            return (
              <g key={w.label}>
                <rect x={w.x1} y={lane.y} width={w.x2 - w.x1} height="24" rx="4" className={`amSvgWindow amSvgWindow--${w.kind}`} />
                <text x={w.x1 + 10} y={lane.y + 16} className={`amSvgSmall${w.kind === "closed" ? "" : " amSvgSmall--slate"}`}>{w.label}</text>
                {w.open && <text x={w.x2 + 4} y={lane.y + 17} className="amSvgSmall amSvgSmall--slate">→</text>}
                {w.supersededBy !== undefined && (
                  <>
                    <line x1={w.supersededBy} y1={lane.y - 4} x2={w.supersededBy} y2={lane.y - 16} className="amSvgAxis" markerEnd="url(#am-temporal-arrow)" />
                    <text x={w.supersededBy + 6} y={lane.y - 8} className="amSvgSmall amSvgSmall--slate">supersedes</text>
                  </>
                )}
                {hit && <circle cx={T_TODAY} cy={lane.y + 12} r="5" className="amSvgQuery" />}
              </g>
            );
          })}
          {!lane.answer.live && (
            <text x={T_TODAY} y={lane.y + 16} className="amSvgSmall amSvgSmall--warn" textAnchor="middle">✕ closed</text>
          )}
        </g>
      ))}

      {/* axis + ticks */}
      <line x1="100" y1={axisY} x2="810" y2={axisY} className="amSvgAxis" markerEnd="url(#am-temporal-arrow)" />
      {T_DATES.map((t) => (
        <g key={t.label}>
          <line x1={t.x} y1={axisY - 6} x2={t.x} y2={axisY + 6} className="amSvgAxis" />
          <text x={t.x} y={axisY + 22} className="amSvgSmall" textAnchor="middle">{t.label}</text>
        </g>
      ))}

      {/* as_of query line */}
      <line x1={T_TODAY} y1="54" x2={T_TODAY} y2={axisY + 6} className="amSvgAsOf" />
      <text x={T_TODAY} y="46" className="amSvgSmall amSvgSmall--slate" textAnchor="middle">as_of (query time)</text>

      {/* live answer set */}
      <g className="amSvgNode">
        <rect x="824" y="66" width="168" height="238" rx="8" />
        <text x="842" y="92" className="amSvgEyebrow">LIVE ANSWER SET</text>
        <text x="842" y="110" className="amSvgSmall">at as_of = today</text>
        {T_LANES.filter((l) => l.answer.live).map((l, i) => (
          <text key={l.name} x="842" y={136 + i * 20} className="amSvgSmall amSvgSmall--good">{l.answer.text}</text>
        ))}
        <line x1="842" y1="204" x2="974" y2="204" className="amSvgLink" />
        <text x="842" y="228" className="amSvgEyebrow">NOT RETURNED</text>
        {T_LANES.filter((l) => !l.answer.live).map((l, i) => (
          <text key={l.name} x="842" y={250 + i * 20} className="amSvgSmall amSvgSmall--warn">{l.answer.text}</text>
        ))}
        <text x="842" y="290" className="amSvgSmall">window closed Jun 12</text>
      </g>
    </svg>
  );
}

// Context graph: memory records (rects) and entities (diamonds) joined by typed
// edges. A query lexically matches a candidate, then a one-hop entity traversal
// reaches related records; policy excludes the sensitive and quarantined nodes.
type GKind = "record" | "entity" | "query";
type GState = "candidate" | "cited" | "clearance" | "quarantine" | "faint" | "path";
interface GNode {
  x: number;
  y: number;
  label: string;
  kind: GKind;
  state?: GState;
  tag?: string;
  tagKind?: "accent" | "warn";
}
const G_RHW = 82;
const G_RHH = 26;
const G_QHW = 74;
const G_QHH = 28;
const G_R = 28;
const G_NODES: Record<string, GNode> = {
  q: { x: 92, y: 258, label: "current pricing?", kind: "query" },
  n1: { x: 250, y: 258, label: "pricing preference", kind: "record", state: "candidate", tag: "lexical candidate", tagKind: "accent" },
  e1: { x: 442, y: 258, label: "pricing", kind: "entity", state: "path" },
  n2: { x: 626, y: 172, label: "2024 cost sheet", kind: "record", state: "cited", tag: "cited", tagKind: "accent" },
  n3: { x: 656, y: 336, label: "pricing sheet path", kind: "record", state: "cited", tag: "cited", tagKind: "accent" },
  n6: { x: 250, y: 152, label: "detailed summary", kind: "record", state: "faint" },
  e3: { x: 430, y: 152, label: "writing", kind: "entity", state: "faint" },
  n4: { x: 250, y: 388, label: "salary review date", kind: "record", state: "clearance", tag: "excluded · clearance", tagKind: "warn" },
  e2: { x: 430, y: 388, label: "salary", kind: "entity", state: "faint" },
  n5: { x: 588, y: 430, label: "web note (poisoned)", kind: "record", state: "quarantine", tag: "excluded · quarantine", tagKind: "warn" },
};
interface GEdge {
  a: string;
  b: string;
  state: "path" | "support" | "faint" | "blocked";
  label?: string;
  arrow?: boolean;
}
const G_EDGES: GEdge[] = [
  { a: "q", b: "n1", state: "path", label: "lexical match", arrow: true },
  { a: "n1", b: "e1", state: "path", label: "mentions" },
  { a: "e1", b: "n2", state: "path", label: "one hop", arrow: true },
  { a: "e1", b: "n3", state: "path", label: "one hop", arrow: true },
  { a: "n2", b: "n3", state: "support", label: "cites" },
  { a: "n6", b: "e3", state: "faint", label: "mentions" },
  { a: "n4", b: "e2", state: "faint", label: "mentions" },
  { a: "n5", b: "e1", state: "blocked", label: "blocked" },
];

function gBoundary(from: GNode, node: GNode): { x: number; y: number } {
  const ux = from.x - node.x;
  const uy = from.y - node.y;
  if (node.kind === "entity") {
    const s = G_R / (Math.abs(ux) + Math.abs(uy) || 1);
    return { x: node.x + ux * s, y: node.y + uy * s };
  }
  const hw = node.kind === "query" ? G_QHW : G_RHW;
  const hh = node.kind === "query" ? G_QHH : G_RHH;
  const s = Math.min(hw / (Math.abs(ux) || 1e-6), hh / (Math.abs(uy) || 1e-6));
  return { x: node.x + ux * s, y: node.y + uy * s };
}

/** Context-graph retrieval — a query walks a small typed graph to a cited packet. */
export function GraphQueryDiagram() {
  const chips = [
    { cx: 96, lines: ["query"] },
    { cx: 288, lines: ["lexical", "candidates"] },
    { cx: 480, lines: ["filter", "validity · trust · clearance"] },
    { cx: 672, lines: ["one-hop", "entity graph"] },
    { cx: 864, lines: ["cited", "context packet"] },
  ];
  return (
    <svg viewBox="0 0 1000 512" role="img" aria-label="Context-graph retrieval pipeline: a query lexically matches a candidate record, which passes validity, trust, and clearance filters and follows a one-hop entity link to related records that enter the cited packet, while sensitive and quarantined nodes are excluded.">
      <defs>
        <marker id="am-graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" className="amArrowHead" />
        </marker>
      </defs>

      {/* pipeline chips */}
      {chips.map((c, i) => (
        <g key={c.cx} className="amSvgNode">
          <rect x={c.cx - 84} y="34" width="168" height="60" rx="8" />
          {c.lines.map((line, li) => (
            <text key={line} x={c.cx} y={c.lines.length === 1 ? 70 : 60 + li * 18} className="amSvgChip" textAnchor="middle">{line}</text>
          ))}
          {i < chips.length - 1 && (
            <line x1={c.cx + 84} y1="64" x2={chips[i + 1].cx - 84} y2="64" className="amArrow" markerEnd="url(#am-graph-arrow)" />
          )}
        </g>
      ))}

      <text x="16" y="122" className="amSvgEyebrow">EXAMPLE — A QUERY WALKS THE GRAPH</text>

      {/* edges (drawn under nodes) */}
      {G_EDGES.map((e) => {
        const A = G_NODES[e.a];
        const B = G_NODES[e.b];
        const pA = gBoundary(B, A);
        const pB = gBoundary(A, B);
        const mx = (pA.x + pB.x) / 2;
        const my = (pA.y + pB.y) / 2;
        const cls =
          e.state === "path" ? "amGEdge" : e.state === "support" ? "amGEdge amGEdge--support" : e.state === "blocked" ? "amGEdge amGEdge--blocked" : "amGEdge amGEdge--faint";
        return (
          <g key={`${e.a}-${e.b}`}>
            <line x1={pA.x} y1={pA.y} x2={pB.x} y2={pB.y} className={cls} markerEnd={e.arrow ? "url(#am-graph-arrow)" : undefined} />
            {e.label && (
              <text x={mx} y={my - 6} className={`amGEdgeLabel${e.state === "faint" || e.state === "blocked" ? " amGEdgeLabel--muted" : ""}`} textAnchor="middle">{e.label}</text>
            )}
            {e.state === "blocked" && <text x={mx} y={my + 6} className="amGTag amGTag--warn" textAnchor="middle">✕</text>}
          </g>
        );
      })}

      {/* assemble arrow into packet */}
      <line x1="742" y1="250" x2="806" y2="236" className="amGEdge" markerEnd="url(#am-graph-arrow)" />
      <text x="770" y="232" className="amGEdgeLabel" textAnchor="middle">assemble</text>

      {/* nodes */}
      {Object.entries(G_NODES).map(([id, n]) => {
        if (n.kind === "entity") {
          return (
            <g key={id} className={n.state === "faint" ? "amGNode--faint" : undefined}>
              <polygon points={`${n.x},${n.y - G_R} ${n.x + G_R},${n.y} ${n.x},${n.y + G_R} ${n.x - G_R},${n.y}`} className="amSvgEntity" />
              <text x={n.x} y={n.y + 4} className="amGLabel amGLabel--muted" textAnchor="middle">{n.label}</text>
            </g>
          );
        }
        if (n.kind === "query") {
          return (
            <g key={id} className="amGNode amGNode--query">
              <rect x={n.x - G_QHW} y={n.y - G_QHH} width={G_QHW * 2} height={G_QHH * 2} rx="8" />
              <text x={n.x} y={n.y - 4} className="amSvgEyebrow" textAnchor="middle">QUERY</text>
              <text x={n.x} y={n.y + 15} className="amGLabel" textAnchor="middle">{n.label}</text>
            </g>
          );
        }
        const muted = n.state === "faint" || n.state === "clearance" || n.state === "quarantine";
        return (
          <g key={id} className={`amGNode amGNode--${n.state}${n.state === "faint" ? " amGNode--faint" : ""}`}>
            <rect x={n.x - G_RHW} y={n.y - G_RHH} width={G_RHW * 2} height={G_RHH * 2} rx="8" />
            <text x={n.x} y={n.y + 4} className={`amGLabel${muted ? " amGLabel--muted" : ""}`} textAnchor="middle">{n.label}</text>
            {n.tag && <text x={n.x} y={n.y + G_RHH + 15} className={`amGTag amGTag--${n.tagKind}`} textAnchor="middle">{n.tag}</text>}
          </g>
        );
      })}

      {/* cited packet */}
      <g className="amSvgNode">
        <rect x="808" y="170" width="184" height="212" rx="8" />
        <text x="826" y="196" className="amSvgEyebrow">CITED PACKET</text>
        <text x="826" y="220" className="amSvgSmall amSvgSmall--good">✓ 2024 cost sheet</text>
        <text x="826" y="240" className="amSvgSmall amSvgSmall--good">✓ pricing sheet path</text>
        <line x1="826" y1="258" x2="974" y2="258" className="amSvgLink" />
        <text x="826" y="282" className="amSvgEyebrow">EXCLUDED</text>
        <text x="826" y="306" className="amSvgSmall amSvgSmall--warn">✕ salary · clearance</text>
        <text x="826" y="326" className="amSvgSmall amSvgSmall--warn">✕ web note · quarantine</text>
        <text x="826" y="352" className="amSvgSmall">deterministic — no embeddings</text>
      </g>

      {/* legend */}
      <g transform="translate(16, 486)">
        <rect x="0" y="-11" width="18" height="14" rx="3" className="amGLegendSwatch amGLegendSwatch--candidate" />
        <text x="24" y="0" className="amSvgSmall">candidate</text>
        <rect x="120" y="-11" width="18" height="14" rx="3" className="amGLegendSwatch amGLegendSwatch--cited" />
        <text x="144" y="0" className="amSvgSmall">cited</text>
        <rect x="210" y="-11" width="18" height="14" rx="3" className="amGLegendSwatch amGLegendSwatch--excluded" />
        <text x="234" y="0" className="amSvgSmall">excluded</text>
        <polygon points="335,-4 343,-11 351,-4 343,3" className="amSvgEntity" />
        <text x="358" y="0" className="amSvgSmall">entity</text>
        <line x1="430" y1="-4" x2="458" y2="-4" className="amGEdge amGEdge--blocked" />
        <text x="464" y="0" className="amSvgSmall">blocked edge</text>
      </g>
    </svg>
  );
}
