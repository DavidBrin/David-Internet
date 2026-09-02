"use client";

/**
 * #schemas — schema browser + ER designs. Prefix qS.
 *
 * Renders a DB-tab strip, an SVG schema graph (tables as boxes, FK edges as
 * curves into the exact column), a live DDL pane (real CREATE TABLE text
 * pulled from each shipped .sqlite via engine.ts), and a strip of the
 * course's hand-drawn ER designs + the bike-shop data sheet with an
 * in-panel lightbox.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Database } from "sql.js";
import "./schemas.css";
import { computeLayout } from "./layout";
import type { EdgeLayout, SchemasData } from "./layout";
import { openDb, runSql } from "../core/engine";

interface TableDdl {
  name: string;
  sql: string;
  rowCount: number;
}

interface DdlEntry {
  tables: TableDdl[];
  error?: string;
}

interface ArtItem {
  key: string;
  src: string;
  alt: string;
  lead: string;
  rest: string;
}

const INITIAL_DB = "university";
const INTRO_TOTAL_MS = 1200;
const INTRO_DRAW_MS = 500;

const ART_ITEMS: ArtItem[] = [
  {
    key: "meeting-room",
    src: "/demos/sql/er-meeting-room.webp",
    alt: "Hand-drawn ER diagram for a meeting-room booking design exercise",
    lead: "Design exercise: meeting-room booker.",
    rest: "Does not correspond to a shipped schema.",
  },
  {
    key: "news-items",
    src: "/demos/sql/er-news-items.webp",
    alt: "Hand-drawn ER diagram for a news-broadcast design exercise, with weak entities and role attributes",
    lead: "Design exercise: news broadcast schema.",
    rest: "Weak entities and role attributes; does not correspond to a shipped schema.",
  },
  {
    key: "data-sheet",
    src: "/demos/sql/data-sheet.webp",
    alt: "The bike-shop project's data sheet",
    lead: "The bike-shop project's data sheet.",
    rest: "What the reconstructed Bike Shop schema above was built from.",
  },
];

export default function SchemaPanel() {
  const [data, setData] = useState<SchemasData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDb, setActiveDb] = useState<string>(INITIAL_DB);
  const [ddlCache, setDdlCache] = useState<Map<string, DdlEntry>>(new Map());
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [introPlayed, setIntroPlayed] = useState(false);

  const mountedRef = useRef(true);
  const requestedRef = useRef<Set<string>>(new Set());
  const introLatchRef = useRef(false);
  const graphWrapRef = useRef<HTMLDivElement | null>(null);
  const edgePathRefs = useRef<Map<string, SVGPathElement | null>>(new Map());
  const ddlScrollRef = useRef<HTMLDivElement | null>(null);
  const ddlBlockRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Track real mount/unmount (distinct from Strict Mode's double-invoke of
  // effect bodies) so async work never sets state after teardown.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load the schema catalog once.
  useEffect(() => {
    fetch("/demos/sql/schemas.json")
      .then((r) => {
        if (!r.ok) throw new Error(`schemas.json ${r.status}`);
        return r.json() as Promise<SchemasData>;
      })
      .then((json) => {
        if (mountedRef.current) setData(json);
      })
      .catch((e: unknown) => {
        if (mountedRef.current) setLoadError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  // Open the selected db lazily, read its real DDL + row counts, close it.
  // requestedRef dedupes per db name so a tab revisit never re-fetches.
  useEffect(() => {
    const name = activeDb;
    if (requestedRef.current.has(name)) return;
    requestedRef.current.add(name);

    (async () => {
      let db: Database | null = null;
      try {
        db = await openDb(name);
        const master = runSql(db, "SELECT name, sql FROM sqlite_master WHERE type='table'");
        const tables: TableDdl[] = [];
        for (const row of master.rows) {
          const tableName = String(row[0]);
          const sql = String(row[1] ?? "");
          const countRes = runSql(db, `SELECT count(*) FROM "${tableName.replace(/"/g, '""')}"`);
          const countVal = countRes.rows[0]?.[0];
          const rowCount = typeof countVal === "number" ? countVal : Number(countVal ?? 0);
          tables.push({ name: tableName, sql, rowCount });
        }
        if (mountedRef.current) {
          setDdlCache((prev) => {
            const next = new Map(prev);
            next.set(name, { tables });
            return next;
          });
        }
      } catch (e) {
        if (mountedRef.current) {
          setDdlCache((prev) => {
            const next = new Map(prev);
            next.set(name, { tables: [], error: e instanceof Error ? e.message : String(e) });
            return next;
          });
        }
      } finally {
        db?.close();
      }
    })();
  }, [activeDb]);

  const schemaDb = data ? data.schemas[activeDb] ?? null : null;
  const layout = useMemo(() => (schemaDb ? computeLayout(schemaDb) : null), [schemaDb]);
  const ddlEntry = ddlCache.get(activeDb);

  // One-time intro: watch the graph until it is ~30% visible while the
  // initially-selected db (university) is showing, then play once.
  useEffect(() => {
    if (introLatchRef.current) return undefined;
    if (activeDb !== INITIAL_DB) return undefined;
    const el = graphWrapRef.current;
    if (!el) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting || entry.intersectionRatio < 0.3) return;
        if (introLatchRef.current) return;
        introLatchRef.current = true;
        io.disconnect();
        setIntroPlayed(true);
      },
      { threshold: [0, 0.3, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [activeDb]);

  // Draw the university FK edges in sequentially, once, via stroke-dashoffset.
  useEffect(() => {
    if (!introPlayed) return undefined;
    const entries = Array.from(edgePathRefs.current.entries());
    const n = entries.length;
    if (n === 0) return undefined;

    // Snap every edge to "fully hidden" with no transition first.
    for (const [, pathEl] of entries) {
      if (!pathEl) continue;
      const len = pathEl.getTotalLength();
      pathEl.style.transition = "none";
      pathEl.style.strokeDasharray = `${len}`;
      pathEl.style.strokeDashoffset = `${len}`;
    }

    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        entries.forEach(([, pathEl], i) => {
          if (!pathEl) return;
          const delay = n > 1 ? (i / (n - 1)) * (INTRO_TOTAL_MS - INTRO_DRAW_MS) : 0;
          pathEl.style.transition = `stroke-dashoffset ${INTRO_DRAW_MS}ms ease ${delay}ms`;
          pathEl.style.strokeDashoffset = "0";
        });
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [introPlayed]);

  // Bring the hovered table's DDL block into view inside its own scroll
  // container only (never the page).
  useEffect(() => {
    if (!hoveredTable) return;
    const container = ddlScrollRef.current;
    const block = ddlBlockRefs.current.get(hoveredTable);
    if (!container || !block) return;
    const blockTop = block.offsetTop;
    const blockBottom = blockTop + block.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    if (blockTop < viewTop || blockBottom > viewBottom) {
      container.scrollTo({ top: Math.max(0, blockTop - 8), behavior: "smooth" });
    }
  }, [hoveredTable]);

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!lightbox) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const hoveredEdge: EdgeLayout | null = layout ? layout.edges.find((e) => e.key === hoveredEdgeKey) ?? null : null;

  function isBoxActive(name: string): boolean {
    if (hoveredTable === name) return true;
    if (hoveredEdge && (hoveredEdge.fromTable === name || hoveredEdge.toTable === name)) return true;
    return false;
  }
  function isEdgeActive(edge: EdgeLayout): boolean {
    if (hoveredEdgeKey === edge.key) return true;
    if (hoveredTable && (edge.fromTable === hoveredTable || edge.toTable === hoveredTable)) return true;
    return false;
  }
  function isRowHighlighted(table: string, col: string): boolean {
    if (!hoveredEdge) return false;
    if (hoveredEdge.fromTable === table && hoveredEdge.fromCol === col) return true;
    if (hoveredEdge.toTable === table && hoveredEdge.toCol === col) return true;
    return false;
  }
  function isDdlHighlighted(table: string): boolean {
    if (hoveredTable === table) return true;
    if (hoveredEdge && (hoveredEdge.fromTable === table || hoveredEdge.toTable === table)) return true;
    return false;
  }
  function rowsLabel(table: string): string {
    if (!ddlEntry) return "...";
    const t = ddlEntry.tables.find((x) => x.name === table);
    if (!t) return ddlEntry.error ? "?" : "...";
    return `${t.rowCount} row${t.rowCount === 1 ? "" : "s"}`;
  }

  return (
    <div className="sqPanel">
      <h2 className="sqH2">From boxes to tables</h2>
      <p className="sqIntro">
        Six course databases, drawn the same way: tables as boxes, primary keys marked, foreign keys drawn as
        curves into the exact column they reference. Pick a database, then hover a table or a line.
      </p>

      {loadError && <p className="sqNote">Could not load schemas.json: {loadError}</p>}

      {data && (
        <>
          <div className="qS-tabs" role="tablist">
            {data.order.map((name) => {
              const db = data.schemas[name];
              if (!db) return null;
              const tableCount = Object.keys(db.tables).length;
              return (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={activeDb === name}
                  className="qS-tab"
                  data-active={activeDb === name}
                  onClick={() => setActiveDb(name)}
                >
                  {db.title}
                  <span className="qS-tabCount">{tableCount}</span>
                  {name === "bikeshop" && <span className="qS-reconChip">RECONSTRUCTED</span>}
                </button>
              );
            })}
          </div>

          {schemaDb && <p className="qS-origin">{schemaDb.origin}</p>}

          <div className="qS-body">
            <div className="qS-graphCard">
              <p className="qS-cardTitle">Schema graph</p>
              <div className="qS-graphScroll" ref={graphWrapRef}>
                {layout && schemaDb && (
                  <svg
                    className="qS-graphSvg"
                    width={layout.width}
                    height={layout.height}
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    role="img"
                    aria-label={`${schemaDb.title} schema diagram`}
                  >
                    <g>
                      {layout.edges.map((edge) => (
                        <g
                          key={edge.key}
                          className="qS-edge"
                          data-active={isEdgeActive(edge)}
                          onMouseEnter={() => setHoveredEdgeKey(edge.key)}
                          onMouseLeave={() => setHoveredEdgeKey((cur) => (cur === edge.key ? null : cur))}
                        >
                          <path className="qS-edgeHit" d={edge.path} />
                          <path
                            ref={(el) => {
                              edgePathRefs.current.set(edge.key, el);
                            }}
                            className="qS-edgeLine"
                            d={edge.path}
                          />
                          <circle className="qS-edgeDot" cx={edge.x1} cy={edge.y1} r={3} />
                          <circle className="qS-edgeDot" cx={edge.x2} cy={edge.y2} r={3} />
                        </g>
                      ))}
                    </g>
                    <g>
                      {layout.boxes.map((box) => (
                        <g
                          key={box.name}
                          className="qS-box"
                          data-hovered={isBoxActive(box.name)}
                          transform={`translate(${box.x},${box.y})`}
                          onMouseEnter={() => setHoveredTable(box.name)}
                          onMouseLeave={() => setHoveredTable((cur) => (cur === box.name ? null : cur))}
                        >
                          <foreignObject x={0} y={0} width={box.width} height={box.height}>
                            <div className="qS-boxCard">
                              <div className="qS-boxHeader">
                                <span className="qS-boxName" title={box.name}>
                                  {box.name}
                                </span>
                                <span className="qS-rowsBadge">{rowsLabel(box.name)}</span>
                              </div>
                              {box.rows.map((r) => (
                                <div
                                  key={r.col}
                                  className="qS-row"
                                  data-pk={r.isPk}
                                  data-fk={r.isFk}
                                  data-highlighted={isRowHighlighted(box.name, r.col)}
                                >
                                  {r.isPk && (
                                    <span className="qS-rowKey" aria-hidden="true">
                                      PK
                                    </span>
                                  )}
                                  <span className="qS-rowName" title={r.col}>
                                    {r.col}
                                  </span>
                                  {r.isFk && (
                                    <span className="qS-rowFk" aria-hidden="true">
                                      FK
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </foreignObject>
                        </g>
                      ))}
                    </g>
                  </svg>
                )}
              </div>
            </div>

            <div className="qS-ddlCard">
              <p className="qS-cardTitle">Real DDL</p>
              <div className="qS-ddlScroll sqMono" ref={ddlScrollRef}>
                {!ddlEntry && <p className="sqNote">Reading CREATE TABLE statements...</p>}
                {ddlEntry?.error && <p className="sqNote">{ddlEntry.error}</p>}
                {ddlEntry?.tables.map((t) => (
                  <div
                    key={t.name}
                    className="qS-ddlBlock"
                    data-highlighted={isDdlHighlighted(t.name)}
                    ref={(el) => {
                      ddlBlockRefs.current.set(t.name, el);
                    }}
                  >
                    <pre className="qS-ddlPre">{t.sql}</pre>
                  </div>
                ))}
              </div>
              <p className="sqNote">translated from the MariaDB originals at build; originals in the Source drawer.</p>
            </div>
          </div>
        </>
      )}

      <div className="qS-artStrip">
        <p className="qS-cardTitle">Design artifacts</p>
        <div className="qS-artGrid">
          {ART_ITEMS.map((item) => (
            <div key={item.key} className="qS-artCard">
              <button
                type="button"
                className="qS-artThumbBtn"
                onClick={() => setLightbox({ src: item.src, alt: item.alt })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="qS-artThumb" src={item.src} alt={item.alt} loading="lazy" />
              </button>
              <p className="qS-artCaption">
                <strong>{item.lead}</strong> {item.rest}
              </p>
            </div>
          ))}
        </div>
      </div>

      {lightbox && (
        <div className="qS-lightbox" onClick={() => setLightbox(null)} role="presentation">
          <button
            type="button"
            className="qS-lightboxClose"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="qS-lightboxImg"
            src={lightbox.src}
            alt={lightbox.alt}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
