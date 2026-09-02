"use client";
/**
 * RiverHero — the source. A still pre-dawn Sierra Nevada; the first scroll
 * summons rain, the rain pools, and the stream is born at the bottom edge.
 * The whole sequence is driven by the section's --sp var (0 → 1 across the
 * hero's 230vh of scroll): title holds → rain ramps in → puddle grows →
 * hand-off to the river's wet edge in the journey below.
 */
import SceneBackdrop from "./SceneBackdrop";
import type { SceneSpec } from "@/lib/journey";

const HERO_SCENE: SceneSpec = {
  art: "sierra",
  palette: { sky: "#0e1730", skyLow: "#4a5a85", water: "#8fc3d4", accent: "#f5b880", ink: "#e8ecf5" },
  light: "night",
  waterMood: "trickle",
};

/** Deterministic pseudo-random, rounded so SSR and client HTML match exactly. */
const rand = (i: number) => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return Math.round((s - Math.floor(s)) * 1000) / 1000;
};

const DROPS = Array.from({ length: 90 }, (_, i) => ({
  left: rand(i) * 100,
  delay: Math.round(rand(i + 137) * 1.4 * 100) / 100,
  dur: Math.round((0.5 + rand(i + 291) * 0.6) * 100) / 100,
  tall: rand(i + 401) > 0.5,
}));

interface Props {
  title: string;
  subtitle: string;
  tagline: string;
}

export default function RiverHero({ title, subtitle, tagline }: Props) {
  return (
    <section className="heroSection" data-progress="scrub" aria-label={`${title}: ${tagline}`}>
      <div className="heroSticky">
        <SceneBackdrop scene={HERO_SCENE} active />

        <div className="heroRain" aria-hidden="true">
          {DROPS.map((d, i) => (
            <span
              key={i}
              className={d.tall ? "rainDrop rainDrop--tall" : "rainDrop"}
              style={{
                left: `${d.left}%`,
                animationDelay: `${d.delay}s`,
                animationDuration: `${d.dur}s`,
              }}
            />
          ))}
        </div>

        <div className="heroTitleBlock">
          <p className="heroTagline">{tagline}</p>
          <h1 className="heroTitle">{title}</h1>
          <p className="heroSubtitle">{subtitle}</p>
        </div>

        <div className="heroPuddle" aria-hidden="true" />

        <p className="heroCue" aria-hidden="true">
          <span className="heroCue-text">scroll to summon the rain</span>
          <span className="heroCue-arrow">↓</span>
        </p>
      </div>
    </section>
  );
}
