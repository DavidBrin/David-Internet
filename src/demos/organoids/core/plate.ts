/**
 * Plate layouts — transcribed from the real dose grids in the per-day
 * notebooks (PlateD-D6.py, PlateF-D30.py) and the Plate A description.
 */

export interface PlateDef {
  id: "A" | "D" | "F";
  title: string;
  compoundsLine: string;
  /** 6x8 dose labels (display). */
  doses: string[][];
  /** Distinct dose groups, in legend order, with colors. */
  groups: { key: string; label: string; color: string }[];
  /** Recording days, D-1 = baseline. */
  days: number[];
  stim: boolean[][];
}

const D_ROW_S = ["Blank-stim", "Blank-stim", "Methanol-stim", "Methanol-stim", "20uM_5MeO-stim", "20uM_5MeO-stim", "10uM_5MeO-stim", "10uM_5MeO-stim"];
const D_ROW = ["Blank", "Blank", "Methanol", "Methanol", "20uM_5MeO", "20uM_5MeO", "10uM_5MeO", "10uM_5MeO"];

const F_ROW_S = ["Psilocybin-stim", "Psilocybin-stim", "LSD-stim", "LSD-stim", "Psilocin-stim", "Psilocin-stim", "Vehicle-stim", "Vehicle-stim"];
const F_ROW = ["Psilocybin", "Psilocybin", "LSD", "LSD", "Psilocin", "Psilocin", "Vehicle", "Vehicle"];

export const PLATE_D: PlateDef = {
  id: "D",
  title: "Plate D — 5-MeO-DMT",
  compoundsLine: "5-MeO-DMT 10 µM / 20 µM · methanol vehicle · blank",
  doses: [D_ROW_S, D_ROW_S, D_ROW_S, D_ROW_S, D_ROW, D_ROW],
  groups: [
    { key: "Blank", label: "Blank", color: "#94a3b8" },
    { key: "Methanol", label: "Methanol (vehicle)", color: "#64748b" },
    { key: "20uM_5MeO", label: "5-MeO-DMT 20 µM", color: "#db2777" },
    { key: "10uM_5MeO", label: "5-MeO-DMT 10 µM", color: "#f472b6" },
  ],
  days: [-1, 0, 1, 4, 6, 8, 12, 20],
  stim: [
    Array(8).fill(true), Array(8).fill(true), Array(8).fill(true),
    Array(8).fill(true), Array(8).fill(false), Array(8).fill(false),
  ],
};

export const PLATE_F: PlateDef = {
  id: "F",
  title: "Plate F — psilocybin · LSD · psilocin",
  compoundsLine: "psilocybin · LSD · psilocin · vehicle, stim vs no-stim rows",
  doses: [F_ROW_S, F_ROW_S, F_ROW_S, F_ROW, F_ROW_S, F_ROW],
  groups: [
    { key: "Psilocybin", label: "Psilocybin", color: "#8b5cf6" },
    { key: "LSD", label: "LSD", color: "#ec4899" },
    { key: "Psilocin", label: "Psilocin", color: "#f59e0b" },
    { key: "Vehicle", label: "Vehicle", color: "#64748b" },
  ],
  days: [-1, 0, 1, 4, 6, 8, 11, 30, 60],
  stim: [
    Array(8).fill(true), Array(8).fill(true), Array(8).fill(true),
    Array(8).fill(false), Array(8).fill(true), Array(8).fill(false),
  ],
};

/** Base dose key for a well (strips the -stim suffix). */
export function doseKey(plate: PlateDef, row: number, col: number): string {
  return plate.doses[row][col].replace(/-stim$/, "");
}

export function groupColor(plate: PlateDef, key: string): string {
  return plate.groups.find((g) => g.key === key)?.color ?? "#94a3b8";
}
