"use client";

/**
 * #inventor - the Inventor gallery. Prefix mG.
 *
 * Fetches /demos/modeling/renders.json at runtime, groups the renders by
 * project, and renders one project card per group (GalleryCard.tsx owns the
 * per-card crossfade/dots/gear-spin/blueprint behavior). Cycling only runs
 * while the whole panel is scrolled into view (IntersectionObserver on the
 * panel root) and stops immediately when it scrolls out or the tab is
 * reduced-motion. FoilSim renders as a separate, visually distinct side card
 * since it isn't an Inventor render. Any render opens an in-panel lightbox
 * that never touches page/body scroll.
 */
import { useEffect, useRef, useState } from "react";
import GalleryCard, { type CardImage } from "./GalleryCard";
import { GROUP_META } from "./galleryData";
import "./gallery.css";

const BASE = "/demos/modeling/";
const CARD_STAGGER_MS = 550;

interface RenderImage {
  group: string;
  file: string;
  original: string;
}

interface RendersJson {
  groups: string[];
  images: RenderImage[];
  foilsim: string;
}

interface LightboxState {
  src: string;
  alt: string;
}

export default function GalleryPanel() {
  const [data, setData] = useState<RendersJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panelInView, setPanelInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(BASE + "renders.json")
      .then((r) => {
        if (!r.ok) throw new Error(`renders.json: ${r.status}`);
        return r.json();
      })
      .then((json: RendersJson) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed to load renders.json");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setPanelInView(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const openLightbox = (src: string, alt: string) => setLightbox({ src, alt });

  let groupedCards: { key: string; title: string; caption: string; images: CardImage[] }[] = [];
  if (data) {
    const byGroup = new Map<string, RenderImage[]>();
    for (const img of data.images) {
      const list = byGroup.get(img.group);
      if (list) list.push(img);
      else byGroup.set(img.group, [img]);
    }
    groupedCards = GROUP_META.filter((g) => byGroup.has(g.key)).map((g) => {
      const imgs = byGroup.get(g.key) ?? [];
      return {
        key: g.key,
        title: g.title,
        caption: g.caption,
        images: imgs.map((img) => ({ src: BASE + img.file, alt: `${g.title} - ${img.original}` })),
      };
    });
  }

  return (
    <div className="mdPanel" ref={panelRef}>
      <h2 className="mdH2">The Inventor gallery</h2>
      <p className="mdIntro">
        Renders pulled from the archived Autodesk Inventor part and assembly files, grouped by
        project. Multi-render projects cycle through their renders like a slow build-up animation;
        hover a card or use its dots to hold on one frame.
      </p>

      {error && <p className="mdNote">Couldn&apos;t load the gallery data ({error}).</p>}
      {!data && !error && <p className="mdNote">Loading renders...</p>}

      {data && (
        <div className="mGLayout">
          <div className="mGGrid">
            {groupedCards.map((card, i) => (
              <GalleryCard
                key={card.key}
                title={card.title}
                caption={card.caption}
                images={card.images}
                active={panelInView}
                reducedMotion={reducedMotion}
                staggerMs={i * CARD_STAGGER_MS}
                drawingIndex={card.key === "glider" ? card.images.length - 1 : undefined}
                gearOverlay={card.key === "gears-simple"}
                onOpenLightbox={openLightbox}
              />
            ))}
          </div>

          <aside className="mGFoil">
            <span className="mGFoilTag mdChip">not a CAD render</span>
            <div className="mGFoilFrame">
              <img
                src={BASE + data.foilsim}
                alt="FoilSim JS lift and drag explorer interface"
                className="mGFoilImg"
                onClick={() => openLightbox(BASE + data.foilsim, "FoilSim JS lift and drag explorer interface")}
              />
            </div>
            <p className="mGFoilCaption">
              Archived as &apos;Wing simulator&apos; - this is NASA Glenn&apos;s FoilSim JS
              (lift/drag explorer), not an Inventor render. Shown for the record of what the wing
              project was tested with.
            </p>
          </aside>
        </div>
      )}

      <p className="mdNote">
        Models exist only as Inventor .ipt/.iam files; a 3D viewer appears here when they&apos;re
        exported to GLB (public/demos/modeling/glb/). Feature stories inferred from the part
        filenames.
      </p>

      {lightbox && (
        <div
          className="mGLightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt}
        >
          <button
            type="button"
            className="mGLightboxClose"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            &#10005;
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className="mGLightboxImg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
