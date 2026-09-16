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

/** Temporal retrieval — return the version whose validity window holds as_of. */
export function TemporalQueryDiagram() {
  const aprX = 210;
  const mayX = 520;
  const todayX = 782;
  return (
    <svg viewBox="0 0 980 236" role="img" aria-label="Temporal retrieval: the query time selects the record whose validity window contains it; the corrected window is closed and no longer answers.">
      <defs>
        <marker id="am-temporal-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" className="amArrowHead" />
        </marker>
      </defs>
      <text x="16" y="30" className="amSvgDiagTitle">Temporal retrieval: which version is live at the query time?</text>

      {/* validity windows */}
      <g>
        <rect x={aprX} y="118" width={mayX - aprX} height="24" rx="4" className="amSvgWindow amSvgWindow--closed" />
        <text x={(aprX + mayX) / 2} y="134" className="amSvgSmall" textAnchor="middle">concise · valid until May 11</text>
      </g>
      <g>
        <rect x={mayX} y="84" width={900 - mayX} height="24" rx="4" className="amSvgWindow amSvgWindow--live" />
        <text x={mayX + 14} y="100" className="amSvgSmall">detailed · valid May 11 → open</text>
      </g>

      {/* axis */}
      <line x1="60" y1="172" x2="940" y2="172" className="amSvgAxis" markerEnd="url(#am-temporal-arrow)" />
      {[
        { x: aprX, label: "Apr 20" },
        { x: mayX, label: "May 11" },
        { x: todayX, label: "today" },
      ].map((t) => (
        <g key={t.label}>
          <line x1={t.x} y1="166" x2={t.x} y2="178" className="amSvgAxis" />
          <text x={t.x} y="194" className="amSvgSmall" textAnchor="middle">{t.label}</text>
        </g>
      ))}

      {/* as_of query line + hit */}
      <line x1={todayX} y1="62" x2={todayX} y2="184" className="amSvgAsOf" />
      <text x={todayX} y="54" className="amSvgSmall amSvgSmall--slate" textAnchor="middle">as_of (query time)</text>
      <circle cx={todayX} cy="96" r="5" className="amSvgQuery" />
      <text x="936" y="78" className="amSvgSmall amSvgSmall--slate" textAnchor="end">→ returns “detailed” (live)</text>
    </svg>
  );
}

/** Context-graph retrieval — lexical candidates, policy filters, one-hop entity traversal. */
export function GraphQueryDiagram() {
  const chips = [
    { cx: 96, lines: ["query"] },
    { cx: 288, lines: ["lexical", "candidates"] },
    { cx: 480, lines: ["filter", "validity · trust · clearance"] },
    { cx: 672, lines: ["one-hop", "entity graph"] },
    { cx: 864, lines: ["cited", "context packet"] },
  ];
  return (
    <svg viewBox="0 0 980 316" role="img" aria-label="Context-graph retrieval pipeline: deterministic lexical candidates pass validity, trust, and clearance filters, then a one-hop entity traversal surfaces a related episode that enters the cited packet.">
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
            <text
              key={line}
              x={c.cx}
              y={c.lines.length === 1 ? 70 : 60 + li * 18}
              className="amSvgChip"
              textAnchor="middle"
            >
              {line}
            </text>
          ))}
          {i < chips.length - 1 && (
            <line x1={c.cx + 84} y1="64" x2={chips[i + 1].cx - 84} y2="64" className="amArrow" markerEnd="url(#am-graph-arrow)" />
          )}
        </g>
      ))}

      <text x="16" y="146" className="amSvgEyebrow">EXAMPLE — ONE-HOP ENTITY TRAVERSAL</text>

      {/* candidate record */}
      <g className="amSvgNode">
        <rect x="40" y="188" width="212" height="70" rx="8" />
        <text x="58" y="214" className="amSvgEyebrow">CANDIDATE · LEXICAL</text>
        <text x="58" y="238" className="amSvgDiagTitle">pricing preference</text>
      </g>
      <text x="58" y="284" className="amSvgSmall">kept: valid · trusted · cleared</text>

      {/* shared entity */}
      <line x1="252" y1="223" x2="428" y2="223" className="amSvgLink" />
      <text x="340" y="215" className="amSvgSmall" textAnchor="middle">shared entity</text>
      <polygon points="470,185 512,223 470,261 428,223" className="amSvgEntity" />
      <text x="470" y="220" className="amSvgSmall amSvgSmall--slate" textAnchor="middle">entity</text>
      <text x="470" y="234" className="amSvgSmall amSvgSmall--slate" textAnchor="middle">pricing</text>

      {/* reached one hop */}
      <line x1="512" y1="223" x2="688" y2="223" className="amArrow" markerEnd="url(#am-graph-arrow)" />
      <text x="600" y="215" className="amSvgSmall" textAnchor="middle">traverse one hop</text>
      <g className="amSvgNode">
        <rect x="690" y="188" width="250" height="70" rx="8" />
        <text x="708" y="214" className="amSvgEyebrow">REACHED · ONE HOP</text>
        <text x="708" y="238" className="amSvgDiagTitle">2024 cost sheet</text>
        <g>
          <rect x="862" y="199" width="62" height="19" rx="9" className="amSvgCite" />
          <text x="893" y="212" className="amSvgSmall amSvgSmall--slate" textAnchor="middle">cited</text>
        </g>
      </g>
    </svg>
  );
}
