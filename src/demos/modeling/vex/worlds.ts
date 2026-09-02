/**
 * worlds.ts -- the three approximated playgrounds. None of this is copied
 * from VEX assets; it is hand-drawn geometry sized so the ported programs in
 * programs.ts (which are NOT adjusted) actually complete. See meta.ts's
 * "What's approximated" story card for the honesty box shown on the page.
 */
import type { World } from "./vexcode";

const WALL_T = 20; // wall thickness, mm

/**
 * Wall Maze (maze). Field is [-1000,1000] mm. The robot's dead-reckoning
 * opening (repeat-3 zigzag + straight run) is unobstructed; two placed walls
 * are what the front-eye "wait until red" wall-follow actually bumps into,
 * and the green mark is where the down-eye "wait until green" stops. A
 * handful of decorative walls sit off to the right (x > 500) purely for the
 * grid-maze look -- the traced path never goes near them.
 */
export function makeWallMaze(): World {
  const halfW = 1000;
  const halfH = 1000;
  return {
    halfW,
    halfH,
    walls: [
      // border
      { x0: -halfW, y0: halfH - WALL_T, x1: halfW, y1: halfH },
      { x0: -halfW, y0: -halfH, x1: halfW, y1: -halfH + WALL_T },
      { x0: -halfW, y0: -halfH, x1: -halfW + WALL_T, y1: halfH },
      { x0: halfW - WALL_T, y0: -halfH, x1: halfW, y1: halfH },
      // the two walls the wall-follow section actually reacts to. Their
      // vertical/horizontal extents are kept narrow (not spanning the whole
      // field) so later legs of the fixed dead-reckoning route can pass
      // nearby in the other axis without grazing them -- see the geometry
      // notes in programs.ts's maze comment for the stop-distance math
      // (stop = wall edge -+ EYE_PAD - FRONT_PROBE_MM).
      { x0: 400, y0: 580, x1: 420, y1: 680 },
      { x0: 100, y0: 70, x1: 430, y1: 100 },
      // decorative maze texture, clear of the traced path (x <= ~470)
      { x0: 550, y0: -800, x1: 570, y1: -200 },
      { x0: 550, y0: -200, x1: 850, y1: -180 },
      { x0: 830, y0: -800, x1: 850, y1: -180 },
      { x0: 600, y0: 100, x1: 900, y1: 120 },
      { x0: 600, y0: 350, x1: 620, y1: 800 },
      { x0: 650, y0: 780, x1: 900, y1: 800 },
    ],
    floorMarks: [{ x0: 400, y0: 400, x1: 560, y1: 550, color: "green" }],
  };
}

/** Art Canvas (artcanvas). Open field, boundary walls only (the distance
 * sensor needs something to hit), robot starts at the field center. */
export function makeArtCanvas(): World {
  const halfW = 1000;
  const halfH = 1000;
  return {
    halfW,
    halfH,
    walls: [
      { x0: -halfW, y0: halfH - WALL_T, x1: halfW, y1: halfH },
      { x0: -halfW, y0: -halfH, x1: halfW, y1: -halfH + WALL_T },
      { x0: -halfW, y0: -halfH, x1: -halfW + WALL_T, y1: halfH },
      { x0: halfW - WALL_T, y0: -halfH, x1: halfW, y1: halfH },
    ],
    floorMarks: [],
  };
}

/**
 * Grid Map -- shared by perimeter, dance, random and experiment (per-program
 * start poses keep their dead-reckoning paths clear of the obstacle blocks;
 * only random's front-eye/bumper logic ever reacts to them). Large enough to
 * hold dance's ~2.8m diagonal drift.
 */
export function makeGridMap(): World {
  const halfW = 3200;
  const halfH = 3200;
  return {
    halfW,
    halfH,
    walls: [
      { x0: -halfW, y0: halfH - 30, x1: halfW, y1: halfH },
      { x0: -halfW, y0: -halfH, x1: halfW, y1: -halfH + 30 },
      { x0: -halfW, y0: -halfH, x1: -halfW + 30, y1: halfH },
      { x0: halfW - 30, y0: -halfH, x1: halfW, y1: halfH },
      // obstacle blocks for random's front-eye/bumper reactions -- kept clear
      // of perimeter's, dance's and experiment's fixed dead-reckoning paths
      { x0: -2200, y0: 700, x1: -1800, y1: 1100 },
      { x0: 1900, y0: 2000, x1: 2300, y1: 2400 },
      { x0: 300, y0: -2300, x1: 600, y1: -2000 },
      { x0: -900, y0: 1900, x1: -600, y1: 2200 },
    ],
    floorMarks: [],
  };
}
