# Early 3D Modeling demo notes

Live demo: `/demos/modeling` · manifest: `content/modeling/site.ts` · stage: `src/demos/modeling/`

## What's on the page

- **#inventor**: the Inventor gallery. 18 renders grouped by project
  (Goldberg machine, glider + manufacturing drawing, simple/complex gear
  chains, Space Crush, Space Launch, Basic Sketch), with feature stories
  inferred from the archived part files, build-up cross-fade animations over
  multi-render projects, a rotating-gear animation, and blueprint-styled
  drawing cards. A side card shows the NASA FoilSim JS screenshot, attributed
  as NASA's tool (it was archived as "Wing simulator" but is not an Inventor
  render).
- **#vex**: a VEXcode VR simulator written for this page in TypeScript, with
  top-down approximations of the Wall Maze / Art Canvas / Grid playgrounds,
  a robot with drivetrain, pen, location, front-eye/down-eye and bumper
  sensors, and six original 2020 programs ported to run for real (maze,
  perimeter octagon, dance, random drive, Art Canvas Python, Grid
  experiment). The block/code listing highlights in step, pen trails draw,
  and there's a drive-it-yourself arrow-key mode. Original screenshots shown
  beside the sim.

## Honesty notes

- **No 3D viewer**: no STL/GLB exports of the Inventor models exist anywhere
  on the machine; the models are .ipt/.iam only. The gallery animates render
  sequences instead; `public/demos/modeling/glb/` is auto-detected if exports
  ever appear.
- **The VEX playgrounds are approximations** drawn for this page; no VEX
  assets were copied. The sim's vexcode API port covers only what the six
  programs use.
- **Perimeter (C 4.2) is reconstructed**: its .vrblocks file didn't survive;
  the listing was rebuilt from the screenshot and is labeled as such.
- The "Wing simulator" image is NASA Glenn's FoilSim JS, not David's CAD;
  it is shown separately with attribution.
- `C 10- David Lim.vrblocks` and its screenshot were **excluded** from the
  shipped set: the name in the filename doesn't match and provenance is
  unclear (flagged for David; easy to add back).
- The `2D List.vrblocks` file is empty (just a when-started block), not
  shipped.
- Feature stories are inferred from part filenames, and say so.
- Built 2026-09-01 with AI coding tools, disclosed in the story rail.

## Building

`pnpm sync-demos modeling` needs `py -3.12` with Pillow. Compresses renders
and screenshots to WebP, parses the Blockly XML into listings, extracts the
.vrpython sources, writes `programs.json` + drawer copies + the listing-count
fixture.

## Attribution

High-school engineering coursework, ~2020-21. Autodesk Inventor renders are
David's (stock/VEX parts library excluded at crawl time). VEXcode VR lesson
templates are VEX's; solutions are David's. FoilSim JS is NASA Glenn
Research Center's.
