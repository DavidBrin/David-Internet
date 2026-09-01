"use client";

/**
 * Curated real figures manifest for the organoids demo (figures.json under
 * /demos/organoids/). One fetch, module-cached.
 */
import { useEffect, useState } from "react";

export interface OrgFigure {
  file: string;
  chapter: "raw" | "spectrum" | "dose" | "compounds" | "library";
  caption: string;
  source: string;
  w: number;
  h: number;
}

let cache: OrgFigure[] | null = null;
let pending: Promise<OrgFigure[]> | null = null;

export function figureUrl(f: OrgFigure): string {
  return `/demos/organoids/${f.file}`;
}

export function useOrgFigures(chapter?: OrgFigure["chapter"]): OrgFigure[] {
  const [figs, setFigs] = useState<OrgFigure[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    pending ??= fetch("/demos/organoids/figures.json")
      .then((r) => r.json())
      .then((j: OrgFigure[]) => (cache = j));
    let alive = true;
    pending.then((j) => {
      if (alive) setFigs(j);
    });
    return () => {
      alive = false;
    };
  }, []);
  return chapter ? figs.filter((f) => f.chapter === chapter) : figs;
}
