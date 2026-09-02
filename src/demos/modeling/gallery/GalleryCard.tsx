"use client";

/**
 * One project card in the Inventor gallery grid. Multi-render groups
 * auto-cross-fade through their frames while `active` (panel in view) and
 * motion is not reduced; hovering pauses; dots and arrow buttons always let
 * a viewer step frames manually (the only way to browse when reduced motion
 * is on, since no auto-crossfade rule applies then).
 *
 * gears-simple gets a small circular "porthole" overlay showing a second,
 * slowly-rotating copy of the same image, positioned so it lines up with the
 * big green gear - only while frame 1 is the one showing (bound to the same
 * opacity as that frame so it fades in and out with it, never misaligned
 * mid-crossfade against frame 2's different gear layout).
 */
import { useEffect, useRef, useState } from "react";
import {
  CARD_ASPECT,
  GEAR_OVERLAY,
  computeCircleOverlay,
  computeSpinnerLayer,
} from "./galleryData";

const FRAME_MS = 2200;

export interface CardImage {
  src: string;
  alt: string;
}

interface GalleryCardProps {
  title: string;
  caption: string;
  images: CardImage[];
  active: boolean;
  reducedMotion: boolean;
  staggerMs: number;
  drawingIndex?: number;
  gearOverlay?: boolean;
  onOpenLightbox: (src: string, alt: string) => void;
}

const gearGeom = computeCircleOverlay(
  GEAR_OVERLAY.imageAspect,
  CARD_ASPECT,
  GEAR_OVERLAY.cxFrac,
  GEAR_OVERLAY.cyFrac,
  GEAR_OVERLAY.rFrac
);
const gearSpinner = computeSpinnerLayer(gearGeom);

export default function GalleryCard({
  title,
  caption,
  images,
  active,
  reducedMotion,
  staggerMs,
  drawingIndex,
  gearOverlay,
  onOpenLightbox,
}: GalleryCardProps) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const count = images.length;

  useEffect(() => {
    if (!active || reducedMotion || hovered || count <= 1) return undefined;

    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        setIndex((i) => (i + 1) % count);
      }, FRAME_MS);
    }, staggerMs);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [active, reducedMotion, hovered, count, staggerMs]);

  // Clamp index if a group's image count ever shrinks (data reload safety).
  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  const goPrev = () => setIndex((i) => (i - 1 + count) % count);
  const goNext = () => setIndex((i) => (i + 1) % count);
  const showingDrawing = drawingIndex !== undefined && index === drawingIndex;

  return (
    <div
      className="mGCard"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`mGFrame${showingDrawing ? " mGFrameBlueprint" : ""}`}
        style={{ aspectRatio: `${CARD_ASPECT}` }}
      >
        {images.map((img, i) => (
          <img
            key={img.src}
            src={img.src}
            alt={img.alt}
            loading="lazy"
            className="mGFrameImg"
            style={{ opacity: i === index ? 1 : 0 }}
            onClick={() => onOpenLightbox(img.src, img.alt)}
          />
        ))}

        {gearOverlay && images[0] && (
          <div
            className="mGGearPorthole"
            aria-hidden="true"
            style={{
              opacity: index === 0 ? 1 : 0,
              left: `${gearGeom.cx}%`,
              top: `${gearGeom.cy}%`,
              width: `${gearGeom.dw}%`,
              height: `${gearGeom.dh}%`,
            }}
          >
            <img
              src={images[0].src}
              alt=""
              className="mGGearSpin"
              style={{
                width: `${gearSpinner.widthPct}%`,
                height: `${gearSpinner.heightPct}%`,
                left: `${gearSpinner.leftPct}%`,
                top: `${gearSpinner.topPct}%`,
                transformOrigin: `${gearGeom.cx}% ${gearGeom.cy}%`,
              }}
            />
          </div>
        )}

        {showingDrawing && <span className="mGDrawingTag">the drawing</span>}

        {count > 1 && (
          <>
            <button
              type="button"
              className="mGArrow mGArrowPrev"
              onClick={goPrev}
              aria-label="Previous render"
            >
              &#8249;
            </button>
            <button
              type="button"
              className="mGArrow mGArrowNext"
              onClick={goNext}
              aria-label="Next render"
            >
              &#8250;
            </button>
          </>
        )}
      </div>

      <div className="mGCardBody">
        <div className="mGCardTitleRow">
          <h3 className="mGCardTitle">{title}</h3>
          {count > 1 && (
            <span className="mGCount mdMono">
              {index + 1} of {count}
            </span>
          )}
        </div>
        <p className="mGCaption">{caption}</p>
        {count > 1 && (
          <div className="mGDots" role="tablist" aria-label={`${title} renders`}>
            {images.map((img, i) => (
              <button
                key={img.src}
                type="button"
                className={`mGDot${i === index ? " mGDotActive" : ""}`}
                onClick={() => setIndex(i)}
                role="tab"
                aria-selected={i === index}
                aria-label={
                  drawingIndex !== undefined && i === drawingIndex
                    ? "Show the manufacturing drawing"
                    : `Show render ${i + 1} of ${count}`
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
