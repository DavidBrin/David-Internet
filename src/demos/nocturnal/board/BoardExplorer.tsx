"use client";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { BoardHighlight } from "../Stage";
import {
  FILTERS,
  MOUNT_HOLES,
  MOUNT_R,
  OUTLINE_D,
  STACK,
  fetchJson,
  fetchText,
  matchesFilter,
  money,
  svgInner,
  type BomJson,
  type BomRow,
  type Drill,
  type FilterId,
  type Footprint,
  type FootprintsJson,
  type PlateDef,
} from "./boardData";
import "./board.css";

const BASE = "/demos/nocturnal/";
const VIEWBOX = "0 0 61.34 61.34";
const BOOT_MS = 3200;
const MIN_HIT = 1.6; // mm — smallest hit rect side

type ArtMap = Record<string, string>;

/* ------------------------------------------------------------------ */
/* Injected layer art — rendered once, tinted by CSS via currentColor. */

const LayerArt = memo(function LayerArt({
  html,
  color,
  routing,
}: {
  html: string;
  color: string;
  routing?: boolean;
}) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!routing || !ref.current) return;
    // One-off DOM pass so the stroke-dashoffset sweep can use a normalised pathLength.
    const paths = ref.current.querySelectorAll<SVGPathElement>('[fill="none"] path:not([stroke="none"])');
    const n = Math.max(1, paths.length);
    paths.forEach((p, i) => {
      p.setAttribute("pathLength", "1");
      p.style.animationDelay = `${((i / n) * 1.0).toFixed(3)}s`;
    });
  }, [html, routing]);
  return (
    <g
      ref={ref}
      className={"nnB-art" + (routing ? " isRouting" : "")}
      style={{ color }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

const DrillArt = memo(function DrillArt({ drills }: { drills: Drill[] }) {
  return (
    <g className="nnB-drills">
      {drills.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.d / 2} className={d.plated ? "nnB-drill" : "nnB-drill isNpth"} />
      ))}
    </g>
  );
});

/* ------------------------------------------------------------------ */
/* One plate of the stack. */

interface PlateProps {
  def: PlateDef;
  html?: string;
  drills?: Drill[];
  z: number;
  index: number;
  faded: boolean;
  labelTransform: string;
  labelVisible: boolean;
  isolated: boolean;
  onLabel: (id: string) => void;
}

function Plate({ def, html, drills, z, index, faded, labelTransform, labelVisible, isolated, onLabel }: PlateProps) {
  const uid = useId();
  const maskId = `nnB-m${uid.replace(/[^a-zA-Z0-9]/g, "")}`;
  const dressing = def.kind === "mask" || def.kind === "silk" || def.kind === "drills";

  let body: React.ReactNode = null;
  if (def.kind === "mask" && html) {
    body = (
      <>
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="61.34" height="61.34">
            <path d={OUTLINE_D} fill="#fff" />
            {MOUNT_HOLES.map(([x, y]) => (
              <circle key={`${x},${y}`} cx={x} cy={y} r={MOUNT_R} fill="#000" />
            ))}
            <LayerArt html={html} color="#000" />
          </mask>
        </defs>
        <path d={OUTLINE_D} className="nnB-base isMask" style={{ fill: def.color }} mask={`url(#${maskId})`} />
      </>
    );
  } else {
    body = (
      <>
        <path d={OUTLINE_D} className={`nnB-base is${def.kind}`} />
        {MOUNT_HOLES.map(([x, y]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r={MOUNT_R} className="nnB-hole" />
        ))}
        {html ? <LayerArt html={html} color={def.color} routing={def.id === "f-cu"} /> : null}
        {drills ? <DrillArt drills={drills} /> : null}
      </>
    );
  }

  return (
    <div
      className={
        "nnB-plate" + (dressing ? " isDressing" : "") + (faded ? " isFaded" : "") + (isolated ? " isIsolated" : "")
      }
      style={{ transform: `translateZ(${z.toFixed(2)}px)`, ["--i" as string]: index }}
      data-layer={def.id}
    >
      <svg viewBox={VIEWBOX} className="nnB-svg" aria-hidden="true">
        {body}
        <path d={OUTLINE_D} className="nnB-edge" />
      </svg>
      <button
        type="button"
        className={"nnB-label" + (isolated ? " isActive" : "")}
        style={{ transform: labelTransform, visibility: labelVisible ? "visible" : "hidden" }}
        onClick={(e) => {
          e.stopPropagation();
          onLabel(def.id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        tabIndex={labelVisible ? 0 : -1}
        aria-pressed={isolated}
        title={isolated ? "Show all layers" : `Isolate ${def.label}`}
      >
        <span className="nnB-labelDot" style={{ background: def.kind === "drills" ? "#888" : def.color }} />
        {def.label}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Invisible hit-areas for one side of the board. */

interface HitProps {
  side: "F.Cu" | "B.Cu";
  z: number;
  footprints: Footprint[];
  rows: Map<string, BomRow>;
  filter: FilterId;
  hover: string | null;
  pinned: string | null;
  pulse: { refs: string[]; key: number };
  onHover: (ref: string | null) => void;
  onPick: (ref: string) => void;
}

function HitLayer({ side, z, footprints, rows, filter, hover, pinned, pulse, onHover, onPick }: HitProps) {
  const pulseSet = useMemo(() => new Set(pulse.refs), [pulse]);
  return (
    <div className="nnB-plate nnB-hitPlate" data-side={side} style={{ transform: `translateZ(${z.toFixed(2)}px)` }}>
      <svg
        viewBox={VIEWBOX}
        className="nnB-svg nnB-hitSvg"
        onPointerOver={(e) => {
          const r = (e.target as SVGElement).getAttribute?.("data-ref");
          if (r) onHover(r);
        }}
        onPointerLeave={() => onHover(null)}
      >
        {footprints.map((f) => {
          const w = Math.max(f.w, MIN_HIT);
          const h = Math.max(f.h, MIN_HIT);
          const row = rows.get(f.ref);
          const match = filter !== "all" && matchesFilter(f, row, filter);
          const cls =
            "nnB-hit" +
            (match ? " isMatch" : "") +
            (hover === f.ref ? " isHover" : "") +
            (pinned === f.ref ? " isPinned" : "");
          return (
            <rect
              key={f.ref}
              x={f.x - w / 2}
              y={f.y - h / 2}
              width={w}
              height={h}
              className={cls}
              data-ref={f.ref}
              tabIndex={0}
              role="button"
              aria-label={`${f.ref} ${f.value}`}
              onFocus={() => onHover(f.ref)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(f.ref);
                }
              }}
            />
          );
        })}
        {pulse.refs.length > 0 && (
          <g key={pulse.key} className="nnB-pulseGroup">
            {footprints
              .filter((f) => pulseSet.has(f.ref))
              .map((f) => {
                const w = Math.max(f.w, MIN_HIT) + 1.2;
                const h = Math.max(f.h, MIN_HIT) + 1.2;
                return (
                  <rect key={f.ref} x={f.x - w / 2} y={f.y - h / 2} width={w} height={h} className="nnB-pulse" />
                );
              })}
          </g>
        )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BOM card. */

function statusTag(row: BomRow | undefined) {
  if (!row) return { cls: "nnTag isMissing", text: "not in BOM" };
  if (row.status === "substituted") return { cls: "nnTag isSub", text: "substituted" };
  if (row.status === "notFound") return { cls: "nnTag isMissing", text: "not sourced" };
  return { cls: "nnTag isOk", text: "as designed" };
}

function InfoCard({ fp, row, pinned }: { fp: Footprint; row: BomRow | undefined; pinned: boolean }) {
  const tag = statusTag(row);
  const others = row ? row.refs.filter((r) => r !== fp.ref) : [];
  return (
    <div className={"nnCard nnB-card" + (pinned ? " isPinned" : "")}>
      <h3>
        <span className="demoMono">{fp.ref}</span> <span className="nnB-cardValue">{fp.value}</span>{" "}
        <span className={tag.cls}>{tag.text}</span>
        {pinned && <span className="nnB-pinNote">pinned · Esc</span>}
      </h3>
      <dl>
        <dt>Footprint</dt>
        <dd className="demoMono">{fp.lib}</dd>
        <dt>Side</dt>
        <dd>
          {fp.layer === "F.Cu" ? "top" : "bottom"} · {fp.pads} pad{fp.pads === 1 ? "" : "s"}
        </dd>
        {row && (
          <>
            <dt>Part</dt>
            <dd>
              {row.manufacturer} <span className="demoMono">{row.mpn}</span>
              {row.thing && row.thing !== row.value ? ` — ${row.thing}` : ""}
            </dd>
            <dt>Qty</dt>
            <dd>
              {row.qty}
              {others.length > 0 && (
                <span className="nnB-others"> (also {others.join(", ")})</span>
              )}
            </dd>
          </>
        )}
      </dl>
      {row?.substitute && (
        <p className="nnB-note isSub">
          <span className="demoMono">{row.mpn}</span> ({row.manufacturer}) →{" "}
          <span className="demoMono">{row.substitute.mpn}</span> ({row.substitute.manufacturer}):{" "}
          {row.substitute.reason} — {row.substitute.description}
        </p>
      )}
      {row?.order && (
        <p className="nnB-note isOrder demoMono">
          line {row.order.line} · qty {row.order.qty} · {row.order.digikey} · {money(row.order.unit)} ·{" "}
          {row.order.description}
        </p>
      )}
      {row?.status === "notFound" && <p className="nnB-note isMissing">Not sourced — no DigiKey listing</p>}
      {!row && <p className="nnB-note">Not in the BOM (mechanical / logo / unpopulated footprint).</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function BoardExplorer({ highlight }: { highlight: BoardHighlight }) {
  const [data, setData] = useState<FootprintsJson | null>(null);
  const [bom, setBom] = useState<BomJson | null>(null);
  const [art, setArt] = useState<ArtMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  const [explode, setExplode] = useState(0);
  const [live, setLive] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [pulse, setPulse] = useState<{ refs: string[]; key: number }>({ refs: [], key: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; e0: number; moved: boolean; ref: string | null } | null>(null);

  /* ---- load ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fp, b] = await Promise.all([
          fetchJson<FootprintsJson>(BASE + "pcb/footprints.json"),
          fetchJson<BomJson>(BASE + "bom.json"),
        ]);
        if (cancelled) return;
        setData(fp);
        setBom(b);
        const ids = STACK.filter((p) => p.kind !== "drills").map((p) => p.id);
        const texts = await Promise.all(ids.map((id) => fetchText(`${BASE}pcb/${id}.svg`)));
        if (cancelled) return;
        const m: ArtMap = {};
        ids.forEach((id, i) => (m[id] = svgInner(texts[i])));
        setArt(m);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!art) return;
    const t = window.setTimeout(() => setBooting(false), BOOT_MS);
    return () => window.clearTimeout(t);
  }, [art]);

  /* ---- derived ---- */
  const rows = useMemo(() => {
    const m = new Map<string, BomRow>();
    bom?.rows.forEach((r) => r.refs.forEach((ref) => m.set(ref, r)));
    return m;
  }, [bom]);
  const byRef = useMemo(() => {
    const m = new Map<string, Footprint>();
    data?.footprints.forEach((f) => m.set(f.ref, f));
    return m;
  }, [data]);
  const topFps = useMemo(() => data?.footprints.filter((f) => f.layer === "F.Cu") ?? [], [data]);
  const botFps = useMemo(() => data?.footprints.filter((f) => f.layer === "B.Cu") ?? [], [data]);

  const stats = useMemo(() => {
    if (!data || !bom) return null;
    const sub = bom.rows.filter((r) => r.status === "substituted").length;
    const nf = bom.rows.filter((r) => r.status === "notFound").length;
    return `${Math.round(data.board.w)} × ${Math.round(data.board.h)} mm · ${data.board.layers} layers · ${
      data.footprints.length
    } footprints · ${data.drills.length} drill hits · ${bom.rows.length} BOM lines, ${sub} substituted, ${nf} not sourced · DigiKey order ${money(
      bom.orderTotal,
    )}`;
  }, [data, bom]);

  /* ---- highlight requests from the schematic ---- */
  useEffect(() => {
    if (!highlight.nonce || highlight.refs.length === 0 || !data) return;
    const fps = highlight.refs.map((r) => byRef.get(r)).filter((f): f is Footprint => !!f);
    const top = fps.some((f) => f.layer === "F.Cu");
    const bottom = fps.some((f) => f.layer === "B.Cu");
    if (bottom && !top) setFlipped(true);
    else if (top && !bottom) setFlipped(false);
    setIsolated(null);
    setPulse({ refs: highlight.refs, key: highlight.nonce });
    setPinned(fps[0]?.ref ?? null);
    setFilter("all");
    const t = window.setTimeout(() => setPulse((p) => (p.key === highlight.nonce ? { refs: [], key: p.key } : p)), 2600);
    return () => window.clearTimeout(t);
  }, [highlight, data, byRef]);

  /* ---- Esc unpins ---- */
  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned]);

  /* ---- drag to explode ---- */
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const target = e.target as Element;
      drag.current = { y0: e.clientY, e0: explode, moved: false, ref: target.getAttribute?.("data-ref") ?? null };
      try {
        stageRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointer */
      }
      setLive(true);
    },
    [explode],
  );
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y0 - e.clientY;
    if (!d.moved && Math.abs(dy) < 4) return;
    d.moved = true;
    setExplode(clamp01(d.e0 + dy / 240));
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setLive(false);
    try {
      stageRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    if (d && !d.moved) {
      if (d.ref) setPinned((p) => (p === d.ref ? null : d.ref));
      else setPinned(null);
    }
  }, []);

  const onLabel = useCallback((id: string) => setIsolated((cur) => (cur === id ? null : id)), []);

  /* ---- scene geometry ---- */
  const e = explode;
  const tiltX = 55 * e;
  const tiltZ = -25 * e;
  const scale = 1 - 0.3 * e;
  const spacing = 64 * e;
  const N = STACK.length;
  const zOf = (i: number) => (i - (N - 1) / 2) * spacing + i * 0.4;
  const labelTransform = `rotateY(${flipped ? -180 : 0}deg) rotateZ(${-tiltZ}deg) rotateX(${-tiltX}deg)`;
  const labelVisible = e > 0.08;

  const shown = pinned ?? hover;
  const shownFp = shown ? byRef.get(shown) : undefined;

  if (error) {
    return <p className="demoNote">Couldn&rsquo;t load the board data ({error}). The static export under /demos/nocturnal/pcb is missing.</p>;
  }

  return (
    <div className="nnB-root">
      <div className="demoControls">
        <label>
          Explode
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={explode}
            onChange={(ev) => setExplode(Number(ev.target.value))}
            onPointerDown={() => setLive(true)}
            onPointerUp={() => setLive(false)}
            onBlur={() => setLive(false)}
            aria-label="Explode the layer stack"
          />
        </label>
        <button
          type="button"
          className={"demoBtn" + (explode > 0.5 ? " isActive" : "")}
          onClick={() => setExplode(explode > 0.5 ? 0 : 1)}
        >
          {explode > 0.5 ? "Assemble" : "Explode"}
        </button>
        <button
          type="button"
          className={"demoBtn" + (flipped ? " isActive" : "")}
          onClick={() => setFlipped((f) => !f)}
          aria-pressed={flipped}
        >
          Flip {flipped ? "· bottom view" : ""}
        </button>
        {isolated && (
          <button type="button" className="demoBtn isActive" onClick={() => setIsolated(null)}>
            Isolated: {STACK.find((p) => p.id === isolated)?.label} ×
          </button>
        )}
        <span className="nnB-hint">drag up on the board to explode · click a layer label to isolate it</span>
      </div>

      <div className="nnSplit nnB-split">
        <div>
          <div
            ref={stageRef}
            className={"nnB-stage" + (live ? " isLive" : "") + (booting ? " isBooting" : "") + (flipped ? " isFlipped" : "")}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {!art && <div className="nnB-loading">{data ? "loading layer art…" : "loading board…"}</div>}
            <div className="nnB-scene">
              <div
                className="nnB-world"
                style={{
                  transform: `translateY(${(18 * e).toFixed(1)}px) scale(${scale.toFixed(3)}) rotateX(${tiltX.toFixed(2)}deg) rotateZ(${tiltZ.toFixed(2)}deg)`,
                }}
              >
                <div className="nnB-stack" style={{ transform: `rotateY(${flipped ? 180 : 0}deg)` }}>
                  {art && data && (
                    <>
                      <HitLayer
                        side="B.Cu"
                        z={zOf(0) - 0.6}
                        footprints={botFps}
                        rows={rows}
                        filter={filter}
                        hover={hover}
                        pinned={pinned}
                        pulse={pulse}
                        onHover={setHover}
                        onPick={(r) => setPinned((p) => (p === r ? null : r))}
                      />
                      {STACK.map((def, i) => (
                        <Plate
                          key={def.id}
                          def={def}
                          html={def.kind === "drills" ? undefined : art[def.id]}
                          drills={def.kind === "drills" ? data.drills : undefined}
                          z={zOf(i)}
                          index={i}
                          faded={!!isolated && isolated !== def.id}
                          isolated={isolated === def.id}
                          labelTransform={labelTransform}
                          labelVisible={labelVisible}
                          onLabel={onLabel}
                        />
                      ))}
                      <HitLayer
                        side="F.Cu"
                        z={zOf(N - 1) + 0.6}
                        footprints={topFps}
                        rows={rows}
                        filter={filter}
                        hover={hover}
                        pinned={pinned}
                        pulse={pulse}
                        onHover={setHover}
                        onPick={(r) => setPinned((p) => (p === r ? null : r))}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="nnB-corner">{flipped ? "bottom view" : "top view"}</div>
          </div>
          {stats && <p className="demoNote nnB-stats">{stats}</p>}
        </div>

        <div className="nnB-side">
          <div className="nnChips" role="group" aria-label="Filter footprints">
            {FILTERS.map((f) => {
              const n = data
                ? f.id === "all"
                  ? data.footprints.length
                  : data.footprints.filter((fp) => matchesFilter(fp, rows.get(fp.ref), f.id)).length
                : 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={"nnChip" + (filter === f.id ? " isActive" : "")}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                >
                  {f.label}
                  {data && <span className="nnB-chipN">{n}</span>}
                </button>
              );
            })}
          </div>
          {shownFp ? (
            <InfoCard fp={shownFp} row={rows.get(shownFp.ref)} pinned={pinned === shownFp.ref} />
          ) : (
            <div className="nnCard nnB-card isEmpty">
              <h3>Hover a part</h3>
              <p>
                Each footprint is a hit-area over the board — hover for its BOM line, click to pin it. Choose a
                filter to outline the matching parts{flipped ? "" : `; flip the board to reach the ${botFps.length} parts on the bottom`}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
