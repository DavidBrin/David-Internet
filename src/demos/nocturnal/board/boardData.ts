/** Types + loaders for the PCB layer explorer (data under /demos/nocturnal/). */

export interface Footprint {
  ref: string;
  value: string;
  lib: string;
  layer: "F.Cu" | "B.Cu";
  x: number;
  y: number;
  rot: number;
  w: number;
  h: number;
  pads: number;
}

export interface Drill {
  x: number;
  y: number;
  d: number;
  plated: boolean;
}

export interface LayerInfo {
  id: string;
  label: string;
  side: "top" | "inner" | "bottom";
  file: string;
  bytes: number;
}

export interface FootprintsJson {
  viewBox: string;
  board: { w: number; h: number; layers: number; thicknessMm: number };
  layers: LayerInfo[];
  footprints: Footprint[];
  drills: Drill[];
}

export interface BomRow {
  item: number;
  refs: string[];
  value: string;
  thing: string;
  mpn: string;
  manufacturer: string;
  footprint: string;
  qty: number;
  status: "asIs" | "substituted" | "notFound";
  substitute?: { mpn: string; manufacturer: string; reason: string; description: string };
  order?: {
    line: number;
    qty: number;
    digikey: string;
    mpn?: string;
    description: string;
    unit: number;
    extended: number;
  };
}

export interface BomJson {
  rows: BomRow[];
  orderTotal: number;
  currency: string;
}

export type PlateKind = "silk" | "mask" | "cu" | "inner" | "drills";

export interface PlateDef {
  id: string;
  label: string;
  kind: PlateKind;
  /** Tint for the injected art (mask plates use the plate colour instead). */
  color: string;
  side: "top" | "inner" | "bottom";
}

/** Stack order, bottom of the board first (= furthest from the camera in the top view). */
export const STACK: PlateDef[] = [
  { id: "b-silk", label: "B.Silkscreen", kind: "silk", color: "#efe9b4", side: "bottom" },
  { id: "b-mask", label: "B.Mask", kind: "mask", color: "#1f6b3a", side: "bottom" },
  { id: "b-cu", label: "B.Cu", kind: "cu", color: "#b96b2f", side: "bottom" },
  { id: "in2-cu", label: "In2.Cu", kind: "inner", color: "#9a7a55", side: "inner" },
  { id: "in1-cu", label: "In1.Cu", kind: "inner", color: "#a8804f", side: "inner" },
  { id: "f-cu", label: "F.Cu", kind: "cu", color: "#d0803a", side: "top" },
  { id: "f-mask", label: "F.Mask", kind: "mask", color: "#1f6b3a", side: "top" },
  { id: "f-silk", label: "F.Silkscreen", kind: "silk", color: "#f4efbf", side: "top" },
  { id: "drills", label: "Drills", kind: "drills", color: "#15161a", side: "top" },
];

/** Board outline (octagon) + mounting holes, from edge.svg, in the shared 61.34 mm viewBox. */
export const OUTLINE_D =
  "M17.98 0.075 L43.38 0.075 L61.29 17.98 L61.29 43.38 L43.38 61.29 L17.98 61.29 L0.075 43.38 L0.075 17.98 Z";
export const MOUNT_HOLES: Array<[number, number]> = [
  [3.35, 20.6],
  [3.35, 40.92],
  [58.22, 20.6],
  [58.22, 40.92],
];
export const MOUNT_R = 2.413;

export type FilterId = "all" | "sub" | "passive" | "ic" | "conn" | "missing";

export const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "sub", label: "Substituted" },
  { id: "passive", label: "Passives" },
  { id: "ic", label: "ICs" },
  { id: "conn", label: "Connectors" },
  { id: "missing", label: "Not sourced" },
];

export function refPrefix(ref: string): string {
  return ref.replace(/[0-9].*$/, "");
}

export function matchesFilter(f: Footprint, row: BomRow | undefined, filter: FilterId): boolean {
  const p = refPrefix(f.ref);
  switch (filter) {
    case "all":
      return true;
    case "sub":
      return row?.status === "substituted";
    case "passive":
      return p === "R" || p === "C" || p === "Y" || p === "L";
    case "ic":
      return p === "U";
    case "conn":
      return p === "P" || p === "B" || p === "SW" || p === "D" || p === "J";
    case "missing":
      return row?.status === "notFound";
  }
}

/** Strip the outer <svg> wrapper so the content can be injected into our own <svg>. */
export function svgInner(text: string): string {
  return text.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}

export async function fetchText(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return (await r.json()) as T;
}

export const money = (n: number) => `$${n.toFixed(2)}`;
