"use client";

/**
 * Real-figures strip shared by all vision panels: shows the curated notebook
 * figures for one panel key ("stereo" | "epipolar" | "bow" | "cnn").
 */
import { useEffect, useState } from "react";

export interface VisionFigure {
  name: string;
  panel: string;
  caption: string;
  w: number;
  h: number;
  src: string;
}

let cache: Promise<VisionFigure[]> | null = null;

export function loadFigures(): Promise<VisionFigure[]> {
  cache ??= fetch("/demos/vision/figures/figures.json")
    .then((r) => r.json())
    .then((j: { figures: VisionFigure[] }) => j.figures);
  return cache;
}

export default function FigStrip({ panel, label = "From the notebooks" }: { panel: string; label?: string }) {
  const [figs, setFigs] = useState<VisionFigure[]>([]);
  useEffect(() => {
    let live = true;
    loadFigures().then((f) => {
      if (live) setFigs(f.filter((x) => x.panel === panel));
    });
    return () => {
      live = false;
    };
  }, [panel]);
  if (!figs.length) return null;
  return (
    <div className="vsFigStrip" aria-label={label}>
      {figs.map((f) => (
        <figure key={f.name} className="vsFigCard" style={{ margin: 0 }}>
          <img src={f.src} alt={f.caption} loading="lazy" width={f.w} height={f.h} />
          <figcaption className="vsFigCap">
            <span className="vsFigTag">{label}</span>
            {f.caption}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
