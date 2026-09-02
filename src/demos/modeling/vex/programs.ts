/**
 * programs.ts -- TS ports of the six VEXcode VR programs, built on the
 * vexcode.ts API surface. Each op is tagged with the listing line index
 * (matching public/demos/modeling/vex/programs.json's per-program `listing`
 * array) that it came from, so the panel can highlight the line the robot is
 * currently executing.
 *
 * Ported faithfully from demos/vexcode_vr_raw/programs/*.vrblocks|.vrpython:
 *  - maze: dead-reckoning entry, then front-eye wall-follow, then down-eye
 *    finish detection (C 5.1).
 *  - perimeter: RECONSTRUCTED from the screenshot -- the block file did not
 *    survive (C 4.2).
 *  - dance: nested repeat(4){repeat(4){...}} choreography (C 7).
 *  - random: forever-drive reacting to the front eye and both bumpers, capped
 *    at a fixed iteration count for the demo since "forever" has no natural
 *    end (C 14).
 *  - artcanvas: Python port, including the distance-arithmetic quirk where
 *    two back-to-back distance.get_distance() calls (no motion between them)
 *    always cancel to exactly 400mm, and the sqrt(2) diagonal close (C 13).
 *  - experiment: Python port; operation_circle()'s `while heading > 1` is
 *    ported as a fixed 90-iteration loop (360/4) rather than a literal
 *    condition -- turning left by exactly 4 degrees from heading 2 visits
 *    only {358,354,...,2} mod 360 and never crosses 1, so a literal port
 *    would loop forever in exact arithmetic. 90 four-degree arcs matches the
 *    original run's observed behavior.
 */
import { mulberry32, randRange, type Program, type Rng, type VexApi, type World } from "./vexcode";
import { makeArtCanvas, makeGridMap, makeWallMaze } from "./worlds";

export interface ProgramConfig {
  id: string;
  world: World;
  startX: number;
  startY: number;
  startHeading: number;
  needsRng: boolean;
  createGenerator: (v: VexApi, rng: Rng) => Program;
}

function* mazeProgram(v: VexApi): Program {
  yield v.setDriveVelocity(500, 1);
  yield v.setTurnVelocity(500, 2);
  for (let i = 0; i < 3; i++) {
    yield v.turnToHeading(0, 4);
    yield v.driveFor("fwd", 250, 5);
    yield v.turnToHeading(270, 6);
    yield v.driveFor("fwd", 250, 7);
  }
  yield v.turnToHeading(0, 8);
  yield v.driveFor("fwd", 250, 9);
  yield v.turnToHeading(90, 10);
  yield v.driveFor("fwd", 750, 11);
  yield v.turnFor("left", 90, 12);
  yield v.driveFor("fwd", 250, 13);
  yield v.setDriveVelocity(50, 14);
  for (let i = 0; i < 2; i++) {
    yield v.turnFor("right", 90, 16);
    yield v.drive("fwd", 17);
    yield v.waitUntil(() => v.frontEyeDetectsColor("red"), 18);
  }
  yield v.turnFor("left", 90, 19);
  yield v.driveFor("fwd", 200, 20);
  yield v.turnFor("left", 90, 21);
  yield v.setDriveVelocity(50, 22);
  yield v.drive("fwd", 23);
  yield v.waitUntil(() => v.downEyeDetectsColor("green"), 24);
  yield v.driveFor("rev", 200, 25);
  yield v.turnFor("left", 90, 26);
  yield v.driveFor("fwd", 250, 27);
  yield v.turnFor("right", 90, 28);
  yield v.driveFor("fwd", 260, 29);
  yield v.turnFor("left", 90, 30);
  yield v.driveFor("fwd", 750, 31);
}

function* perimeterProgram(v: VexApi): Program {
  yield v.setDriveVelocity(500, 1);
  yield v.setTurnVelocity(500, 2);
  yield v.driveFor("fwd", 400, 3);
  yield v.penMove("down", 4);
  for (let i = 0; i < 8; i++) {
    yield v.driveFor("fwd", 200, 6);
    yield v.turnFor("right", 45, 7);
  }
}

function* danceProgram(v: VexApi): Program {
  yield v.setDriveVelocity(200, 1);
  yield v.setTurnVelocity(300, 2);
  for (let outer = 0; outer < 4; outer++) {
    for (let inner = 0; inner < 4; inner++) {
      yield v.turnFor("right", 360, 5);
      yield v.driveFor("fwd", 400, 6);
      yield v.turnFor("left", 90, 7);
      yield v.driveFor("rev", 200, 8);
      yield v.turnFor("right", 180, 9);
      yield v.turnFor("left", 90, 10);
      yield v.driveFor("rev", 400, 11);
      yield v.turnFor("right", 270, 12);
      yield v.driveFor("fwd", 200, 13);
      yield v.turnToHeading(0, 14);
      yield v.brainPrint("woo", 15);
    }
    yield v.brainPrint("twirlywhirly", 16);
    for (let i = 0; i < 3; i++) {
      yield v.turnFor("right", 360, 18);
    }
    yield v.brainPrint("to the right, to the right", 19);
    yield v.turnToHeading(90, 20);
    yield v.driveFor("fwd", 200, 21);
    yield v.brainPrint("to the left now!", 22);
    yield v.turnToHeading(270, 23);
    yield v.driveFor("fwd", 200, 24);
    yield v.brainPrint("Finale!", 25);
    yield v.setDriveVelocity(500, 26);
    yield v.setTurnVelocity(600, 27);
    yield v.turnToHeading(45, 28);
    yield v.driveFor("fwd", 1000, 29);
    yield v.turnFor("right", 720, 30);
  }
}

// "forever" has no natural end -- capped for the demo.
const RANDOM_MAX_ITERS = 240;

function* randomProgram(v: VexApi, rng: Rng): Program {
  yield v.penMove("down", 1);
  for (let i = 0; i < RANDOM_MAX_ITERS; i++) {
    yield v.drive("fwd", 3);
    // The original polls all three ifs every tick; collapsed to a priority
    // order (object, right bumper, left bumper) matching the block order.
    yield v.waitUntil(() => v.frontEyeNearObject() || v.bumperPressed("right") || v.bumperPressed("left"), 3);
    if (v.frontEyeNearObject()) {
      yield v.turnFor("right", randRange(rng, 90, 180), 5);
    } else if (v.bumperPressed("right")) {
      yield v.turnFor("right", randRange(rng, 45, 90), 7);
    } else if (v.bumperPressed("left")) {
      yield v.turnFor("left", randRange(rng, 45, 90), 9);
    }
  }
  yield v.stop(2);
}

function* artcanvasProgram(v: VexApi): Program {
  yield v.penMove("down", 14);
  yield v.turnFor("right", 180, 15);
  yield v.driveFor("fwd", 400, 16);
  yield v.turnFor("right", 90, 17);
  yield v.setDriveVelocity(50, 20);
  yield v.drive("fwd", 21);
  yield v.waitUntil(() => v.locationPosition("X") <= -300, 18);
  yield v.stop(22);
  yield v.turnFor("right", 128.66, 23);
  yield v.drive("fwd", 26);
  yield v.waitUntil(() => v.locationPosition("Y") >= 0, 24);
  yield v.stop(27);
  yield v.brainPrint("wooo", 28);

  // numero1 = d - (d - 400): two back-to-back reads with no motion between
  // them always cancel to exactly 400, regardless of the actual distance.
  const d1a = v.distanceGetDistance();
  const d1b = v.distanceGetDistance();
  const numero1 = d1a - (d1b - 400);
  yield v.turnToHeading(0, 32);
  yield v.driveFor("fwd", numero1, 33);
  yield v.turnToHeading(270, 34);
  const d2a = v.distanceGetDistance();
  const d2b = v.distanceGetDistance();
  const numero2 = d2a - (d2b - 400);
  yield v.driveFor("fwd", numero2, 36);
  yield v.turnFor("left", 135, 37);
  const numero3 = numero1 * Math.sqrt(2);
  yield v.driveFor("fwd", numero3, 39);
}

function* experimentProgram(v: VexApi): Program {
  yield v.driveFor("fwd", 200, 17);
  yield v.turnFor("right", 90, 18);
  yield v.driveFor("fwd", 600, 19);
  yield v.penMove("down", 20);

  while (v.headingGet() < 180) {
    yield v.driveFor("fwd", 400, 24);
    yield v.turnFor("left", 90, 25);
  }

  yield v.driveFor("fwd", 400, 27);
  yield v.turnFor("left", 90, 28);
  yield v.driveFor("fwd", 400, 29);
  yield v.stop(30);

  yield v.turnFor("left", 90, 32);
  yield v.turnFor("left", 45, 33);
  yield v.driveFor("fwd", 565.685, 34);

  yield v.penMove("up", 36);
  yield v.driveFor("fwd", 200, 37);

  yield v.brainPrint("yay", 39);

  yield v.brainPrint("CIRCLE", 42);
  yield v.turnToHeading(0, 43);
  yield v.driveFor("fwd", 250, 44);
  yield v.turnToHeading(2, 45);
  yield v.setDriveVelocity(500, 46);
  yield v.setTurnVelocity(500, 47);
  yield v.penMove("down", 48);
  for (let i = 0; i < 90; i++) {
    yield v.driveFor("fwd", 15, 50);
    yield v.turnFor("left", 4, 51);
  }
}

export const PROGRAM_CONFIGS: Record<string, ProgramConfig> = {
  maze: {
    id: "maze",
    world: makeWallMaze(),
    startX: -140,
    startY: -620,
    startHeading: 0,
    needsRng: false,
    createGenerator: (v) => mazeProgram(v),
  },
  perimeter: {
    id: "perimeter",
    world: makeGridMap(),
    startX: -1900,
    startY: -2000,
    startHeading: 0,
    needsRng: false,
    createGenerator: (v) => perimeterProgram(v),
  },
  dance: {
    id: "dance",
    world: makeGridMap(),
    startX: -1500,
    startY: -1500,
    startHeading: 0,
    needsRng: false,
    createGenerator: (v) => danceProgram(v),
  },
  random: {
    id: "random",
    world: makeGridMap(),
    startX: 0,
    startY: 0,
    startHeading: 0,
    needsRng: true,
    createGenerator: (v, rng) => randomProgram(v, rng),
  },
  artcanvas: {
    id: "artcanvas",
    world: makeArtCanvas(),
    startX: 0,
    startY: 0,
    startHeading: 0,
    needsRng: false,
    createGenerator: (v) => artcanvasProgram(v),
  },
  experiment: {
    id: "experiment",
    world: makeGridMap(),
    startX: 1300,
    startY: -2200,
    startHeading: 0,
    needsRng: false,
    createGenerator: (v) => experimentProgram(v),
  },
};

/** Reseed the random program's RNG deterministically: base seed + a
 * per-page-load-incrementing run counter, so repeated Run clicks are
 * reproducible in sequence but not identical every time. */
export function makeRunRng(runCount: number): Rng {
  return mulberry32(0xc0ffee + runCount * 0x9e3779b1);
}
