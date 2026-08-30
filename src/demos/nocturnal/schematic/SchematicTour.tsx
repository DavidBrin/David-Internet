"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HOTSPOTS, type Hotspot, type SheetKey } from "./hotspots";
import "./schematic.css";

const BASE = "/demos/nocturnal/";
const PAD = 7; // mm padding around a hotspot's symbol bbox

interface SheetMeta {
  key: SheetKey;
  title: string;
  file: string;
  viewBox: string;
  source: string;
  bytes: number;
}

interface SymbolPos {
  ref: string;
  value: string;
  lib: string;
  x: number;
  y: number;
  rot: number;
}

type SymbolsJson = Record<string, { file: string; paper: string; symbols: SymbolPos[] }>;

interface View {
  s: number;
  tx: number;
  ty: number;
}

interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function parseViewBox(vb: string): { w: number; h: number } {
  const p = vb.split(/\s+/).map(Number);
  return { w: p[2] || 1, h: p[3] || 1 };
}

export default function SchematicTour({ onShowOnBoard }: { onShowOnBoard: (refs: string[]) => void }) {
  const [sheets, setSheets] = useState<SheetMeta[] | null>(null);
  const [symbols, setSymbols] = useState<SymbolsJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetKey, setSheetKey] = useState<SheetKey>("root");
  const [svgCache, setSvgCache] = useState<Record<string, string>>({});
  const [view, setView] = useState<View>({ s: 1, tx: 0, ty: 0 });
  const [animating, setAnimating] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const animT = useRef(0);

  /* ---- load metadata ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sh, sy] = await Promise.all([
          fetch(BASE + "sch/sheets.json").then((r) => {
            if (!r.ok) throw new Error(`sheets.json: ${r.status}`);
            return r.json() as Promise<SheetMeta[]>;
          }),
          fetch(BASE + "sch/symbols.json").then((r) => {
            if (!r.ok) throw new Error(`symbols.json: ${r.status}`);
            return r.json() as Promise<SymbolsJson>;
          }),
        ]);
        if (!cancelled) {
          setSheets(sh);
          setSymbols(sy);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sheet = useMemo(() => sheets?.find((s) => s.key === sheetKey) ?? null, [sheets, sheetKey]);
  const dims = useMemo(() => (sheet ? parseViewBox(sheet.viewBox) : { w: 1, h: 1 }), [sheet]);
  const svg = sheet ? svgCache[sheet.key] : undefined;

  /* ---- lazy-load the selected sheet's SVG (root is 537 KB) ---- */
  useEffect(() => {
    if (!sheet || svgCache[sheet.key] !== undefined) return;
    let cancelled = false;
    fetch(BASE + sheet.file)
      .then((r) => {
        if (!r.ok) throw new Error(`${sheet.file}: ${r.status}`);
        return r.text();
      })
      .then((t) => {
        if (!cancelled) setSvgCache((c) => ({ ...c, [sheet.key]: t }));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [sheet, svgCache]);

  /* ---- hotspots on this sheet, with symbol bboxes ---- */
  const sheetHotspots = useMemo(() => HOTSPOTS.filter((h) => h.sheet === sheetKey), [sheetKey]);
  const bboxes = useMemo(() => {
    const m = new Map<string, BBox>();
    if (!symbols) return m;
    const sy = symbols[sheetKey]?.symbols ?? [];
    const pos = new Map(sy.map((s) => [s.ref, s]));
    for (const h of sheetHotspots) {
      const pts = h.refs.map((r) => pos.get(r)).filter((p): p is SymbolPos => !!p);
      if (pts.length === 0) continue;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const x0 = Math.min(...xs) - PAD;
      const y0 = Math.min(...ys) - PAD;
      m.set(h.id, { x: x0, y: y0, w: Math.max(...xs) + PAD - x0, h: Math.max(...ys) + PAD - y0 });
    }
    return m;
  }, [symbols, sheetKey, sheetHotspots]);

  /* ---- view helpers ---- */
  const fitView = useCallback((): View => {
    const el = viewportRef.current;
    if (!el) return { s: 1, tx: 0, ty: 0 };
    const s = Math.min(el.clientWidth / dims.w, el.clientHeight / dims.h) * 0.97;
    return { s, tx: (el.clientWidth - dims.w * s) / 2, ty: (el.clientHeight - dims.h * s) / 2 };
  }, [dims]);

  const animateTo = useCallback((v: View) => {
    setAnimating(true);
    setView(v);
    window.clearTimeout(animT.current);
    animT.current = window.setTimeout(() => setAnimating(false), 620);
  }, []);

  /* fit when a sheet first becomes visible */
  useEffect(() => {
    if (svg) setView(fitView());
  }, [svg, fitView]);

  const zoomToBox = useCallback(
    (b: BBox) => {
      const el = viewportRef.current;
      if (!el) return;
      const fit = fitView();
      const s = clamp(Math.min(el.clientWidth / b.w, el.clientHeight / b.h) * 0.8, fit.s, 10);
      animateTo({ s, tx: el.clientWidth / 2 - (b.x + b.w / 2) * s, ty: el.clientHeight / 2 - (b.y + b.h / 2) * s });
    },
    [fitView, animateTo],
  );

  const selectHotspot = useCallback(
    (h: Hotspot) => {
      setActive((cur) => (cur === h.id ? null : h.id));
      const b = bboxes.get(h.id);
      if (b) zoomToBox(b);
    },
    [bboxes, zoomToBox],
  );

  const zoomBy = useCallback(
    (f: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const cx = el.clientWidth / 2;
      const cy = el.clientHeight / 2;
      setView((v) => {
        const s = clamp(v.s * f, 0.15, 20);
        const k = s / v.s;
        return { s, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
      });
    },
    [],
  );

  /* ---- wheel zoom about the cursor (non-passive so we can preventDefault) ---- */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const f = Math.exp(-ev.deltaY * 0.0016);
      setView((v) => {
        const s = clamp(v.s * f, 0.15, 20);
        const k = s / v.s;
        return { s, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [sheets]);

  /* ---- drag to pan ---- */
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    pan.current = { x: e.clientX, y: e.clientY, moved: false };
    viewportRef.current?.setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < 3) return;
    p.moved = true;
    p.x = e.clientX;
    p.y = e.clientY;
    setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pan.current = null;
    try {
      viewportRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
  }, []);

  const activeHotspot = active ? sheetHotspots.find((h) => h.id === active) ?? null : null;

  if (error) {
    return <p className="demoNote">Couldn&rsquo;t load the schematic export ({error}).</p>;
  }

  return (
    <div className="nnS-root">
      <div className="nnChips" role="tablist" aria-label="Schematic sheets">
        {(sheets ?? []).map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={s.key === sheetKey}
            className={"nnChip" + (s.key === sheetKey ? " isActive" : "")}
            onClick={() => {
              setSheetKey(s.key);
              setActive(null);
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="nnS-split">
        <div
          ref={viewportRef}
          className="nnS-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {!svg && <div className="nnS-loading">loading {sheet ? sheet.source : "sheets"}…</div>}
          <div
            className={"nnS-world" + (animating ? " isAnimating" : "")}
            style={{
              width: dims.w,
              height: dims.h,
              transform: `translate(${view.tx.toFixed(2)}px, ${view.ty.toFixed(2)}px) scale(${view.s.toFixed(4)})`,
            }}
          >
            {svg && <div className="nnS-sheet" dangerouslySetInnerHTML={{ __html: svg }} />}
            {svg && (
              <svg className="nnS-overlay" viewBox={sheet?.viewBox} aria-hidden="false">
                {sheetHotspots.map((h, i) => {
                  const b = bboxes.get(h.id);
                  if (!b) return null;
                  const k = 1 / view.s;
                  return (
                    <g key={h.id} className={"nnS-spot" + (active === h.id ? " isActive" : "")}>
                      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={2} className="nnS-spotBox" />
                      <g
                        className="nnS-marker"
                        transform={`translate(${b.x} ${b.y}) scale(${k.toFixed(4)})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectHotspot(h);
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Hotspot: ${h.title}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") selectHotspot(h);
                        }}
                      >
                        <circle r={11} className="nnS-markerDot" />
                        <text y={4.2} textAnchor="middle" className="nnS-markerNum">
                          {i + 1}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          <div className="nnS-zoomBtns">
            <button type="button" className="demoBtn" onClick={() => animateTo(fitView())} title="Fit sheet">
              fit
            </button>
            <button type="button" className="demoBtn" onClick={() => zoomBy(1.4)} aria-label="Zoom in">
              +
            </button>
            <button type="button" className="demoBtn" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">
              −
            </button>
          </div>

          {activeHotspot && (
            <div className="nnCard nnS-pop">
              <button type="button" className="nnS-popClose" onClick={() => setActive(null)} aria-label="Close">
                ×
              </button>
              <h3>{activeHotspot.title}</h3>
              <p>{activeHotspot.body}</p>
              <p className="nnS-popRefs demoMono">{activeHotspot.refs.join("  ")}</p>
              <button
                type="button"
                className="demoBtn isPrimary"
                onClick={() => onShowOnBoard(activeHotspot.boardRefs ?? activeHotspot.refs)}
              >
                Show on the board ↗
              </button>
            </div>
          )}
        </div>

        <aside className="nnS-list">
          <p className="nnS-listHead">
            {sheet ? sheet.title : "…"} · <span className="demoMono">{sheet?.source}</span>
          </p>
          {sheetHotspots.length === 0 && <p className="demoNote">No hotspots on this sheet.</p>}
          <ol>
            {sheetHotspots.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className={"nnS-listItem" + (active === h.id ? " isActive" : "")}
                  onClick={() => selectHotspot(h)}
                >
                  <b>{h.title}</b>
                  <span className="demoMono">{h.refs.slice(0, 6).join(" ")}{h.refs.length > 6 ? " …" : ""}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="demoNote">
            Wheel to zoom, drag to pan. Numbered markers on the sheet open the same notes.
          </p>
        </aside>
      </div>

      <p className="demoNote">
        Exported by kicad-cli 8.0.6 from the project&rsquo;s .kicad_sch files at build time; the KiCad project
        itself is not shipped.
      </p>
    </div>
  );
}
