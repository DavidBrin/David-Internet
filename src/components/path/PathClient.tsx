"use client";
/**
 * PathClient — assembles the journey: fixed backdrop stack (crossfades per
 * phase), hero, phase sections, the river ribbon (geometry measured from the
 * real layout), the wet leading edge, and the sea outro.
 *
 * Animation model: useScrollProgress writes CSS vars every frame; everything
 * visual is CSS reading those vars. The only imperative per-frame DOM work
 * here is positioning the wet-edge marker along the SVG path.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Journey, JourneyPhase } from "@/lib/journey";
import { WIKIPEDIA_BASE_URL } from "@/lib/wiki";
import RiverHero from "./RiverHero";
import JourneyPhaseSection from "./JourneyPhaseSection";
import RiverRibbon, { type PhaseGeom } from "./RiverRibbon";
import SceneBackdrop from "./SceneBackdrop";
import { useScrollProgress } from "./useScrollProgress";

const SEA_SCENE = {
  art: "sea",
  palette: { sky: "#28527a", skyLow: "#8fb8cf", water: "#1d3f5e", accent: "#f5d491", ink: "#eaf4fb" },
  light: "dusk",
  waterMood: "delta",
} as const;

/** Which bank the card sits on; the river takes the other side. */
const sideFor = (i: number): "left" | "right" => (i % 2 === 0 ? "left" : "right");
const riverXFor = (phase: JourneyPhase, i: number) =>
  phase.effect === "delta-fan" ? 500 : sideFor(i) === "left" ? 660 : 340;

export default function PathClient({ journey }: { journey: Journey }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const journeyRef = useRef<HTMLDivElement>(null);
  const wetEdgeRef = useRef<HTMLDivElement>(null);
  const mainPathRef = useRef<SVGPathElement | null>(null);
  const mainLenRef = useRef(0);

  const [geom, setGeom] = useState<{ phases: PhaseGeom[]; height: number } | null>(null);
  const [barHidden, setBarHidden] = useState(false);

  // Measure real section layout → river geometry. Re-runs on any resize.
  useEffect(() => {
    const journeyEl = journeyRef.current;
    if (!journeyEl) return;

    const measure = () => {
      const sections = journeyEl.querySelectorAll<HTMLElement>("[data-phase-index]");
      const phases: PhaseGeom[] = [];
      sections.forEach((el) => {
        const i = Number(el.dataset.phaseIndex);
        const phase = journey.phases[i];
        phases.push({
          top: el.offsetTop,
          height: el.offsetHeight,
          x: riverXFor(phase, i),
          branch: Boolean(phase.branch),
          isDelta: phase.effect === "delta-fan",
          fanCount: phase.effect === "delta-fan" ? phase.demos?.length ?? 5 : undefined,
        });
      });
      setGeom({ phases, height: journeyEl.offsetHeight });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(journeyEl);
    return () => ro.disconnect();
  }, [journey]);

  const onMainPath = useCallback((el: SVGPathElement | null) => {
    mainPathRef.current = el;
    mainLenRef.current = el ? el.getTotalLength() : 0;
  }, []);

  const { activeIndex, reduced } = useScrollProgress({
    root: rootRef,
    journey: journeyRef,
    onFrame: ({ riverProgress, scrollY }) => {
      setBarHidden((prev) => {
        const next = scrollY > 70;
        return prev === next ? prev : next;
      });
      // Wet leading edge follows the tip of the drawn main channel.
      const edge = wetEdgeRef.current;
      const path = mainPathRef.current;
      const journeyEl = journeyRef.current;
      if (!edge || !path || !journeyEl) return;
      if (riverProgress <= 0.001 || riverProgress >= 0.995) {
        edge.style.opacity = "0";
        return;
      }
      const pt = path.getPointAtLength(riverProgress * mainLenRef.current);
      const x = (pt.x / 1000) * journeyEl.clientWidth;
      edge.style.opacity = "1";
      edge.style.transform = `translate(${x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`;
    },
  });

  // Interleave the wash-away asides along odd phases; the fixed anchor line
  // goes to the etch-anchor phase.
  const pool = journey.messages.filter((m) => !m.fixed);
  const anchor = journey.messages.find((m) => m.fixed);
  let poolCursor = 0;

  return (
    <div
      ref={rootRef}
      className={`pathPage${reduced ? " pathPage--reduced" : ""}`}
      style={
        {
          "--riverColor": journey.phases[activeIndex]?.scene.palette.water,
        } as React.CSSProperties
      }
    >
      <div className={`pathBar${barHidden ? " pathBar--hidden" : ""}`}>
        <div className="pathBarInner">
          <span>path.davids.net</span>
          <span>
            <Link href="/">David&apos;s Internet</Link>
            {" · "}
            <a href={WIKIPEDIA_BASE_URL} target="_blank" rel="noreferrer">
              Wikipedia
            </a>
          </span>
        </div>
      </div>

      {/* Fixed backdrop stack — the world the river flows through. */}
      <div className="backdropStack" aria-hidden="true">
        {journey.phases.map((phase, i) => (
          <SceneBackdrop key={phase.id} scene={phase.scene} active={i === activeIndex} />
        ))}
      </div>

      <RiverHero
        title={journey.hero.title}
        subtitle={journey.hero.subtitle}
        tagline={journey.hero.tagline}
      />

      <div ref={journeyRef} className="journey">
        {geom && (
          <RiverRibbon phases={geom.phases} height={geom.height} onMainPath={onMainPath} />
        )}
        <div ref={wetEdgeRef} className="wetEdge" aria-hidden="true">
          <span className="wetEdge-ripple" />
          <span className="wetEdge-ripple wetEdge-ripple--late" />
          <span className="wetEdge-core" />
        </div>

        {journey.phases.map((phase, i) => (
          <JourneyPhaseSection
            key={phase.id}
            phase={phase}
            index={i}
            side={sideFor(i)}
            anchorMessage={phase.effect === "etch-anchor" ? anchor : undefined}
            message={
              i > 0 && i % 2 === 1 && pool.length > 0
                ? pool[poolCursor++ % pool.length]
                : undefined
            }
          />
        ))}
      </div>

      <section className="outroSection" data-progress aria-label="The sea">
        <SceneBackdrop scene={SEA_SCENE} active />
        <div className="outroWaves" aria-hidden="true">
          <div className="outroWave outroWave--1" />
          <div className="outroWave outroWave--2" />
          <div className="outroWave outroWave--3" />
        </div>
        <div className="outroContent">
          <p className="outroLine">{journey.outro.line}</p>
          <Link className="outroCta" href={journey.outro.cta.href}>
            {journey.outro.cta.label}
          </Link>
        </div>
      </section>
    </div>
  );
}
