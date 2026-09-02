# 14 — Early 3D Modeling (Autodesk Inventor + VEXcode VR, ~2020–2021)

Slug: `modeling` · Fake domain: `modeling.davids.net` · Archetype: **C** (gallery) + **A** (VEX VR robot sim)
Status: spec agreed 2026-08-30; **built 2026-09-01**. Drift, documents won: the
'Wing simulator' render is NASA Glenn's FoilSim JS screenshot, not an Inventor render -
shown as a separate attributed card. 'C 10- David Lim.vrblocks' + its screenshot were
EXCLUDED (filename carries a different name; provenance unclear - flagged for David).
'2D List.vrblocks' is empty (a bare when-started block) - not shipped. Perimeter
(C 4.2) has no surviving block file - reconstructed from its screenshot, labeled. Six
programs ported to a TS vexcode engine (generator coroutines; maze/perimeter/dance/
random/artcanvas/experiment) and verified by a headless numeric trace - which caught a
real sensor-geometry bug in the approximated maze before shipping.

Page name per David: **"Early 3D Modeling"** (not "Origins"). Early Code is its own page
(`15_early_code.md`) — the two were kept separate because this page's name is specific to
modeling; say so if you'd rather merge them.

## Summary

Where the hardware side started: a gallery of Inventor renders (Goldberg machine, glider,
gear chains, Space Crush/Launch, a wing simulator) with the feature tree told as captions,
and — because there's no Inventor access to export 3-D now — a **feature-history
animation** built from the render sequence instead of a model viewer. Alongside, the
VEXcode VR programs run in a **2-D robot simulator** written for the page: the maze,
perimeter, and random-drive programs actually execute against a TS port of the `vexcode`
drivetrain/pen/location/distance API, with the original block-program screenshots beside.

## Source material

`demos/inventor_cad_raw/`:

| Group | Files | Use |
|---|---|---|
| Renders (19 PNG) | `Goldberg Pic1/2`, `Glider pic 1–6` + `Glider drawing`, `Simple/Complex Gear chain 1/2`, `Space Crush 1/2`, `Space Launch 1/2`, `Wing simulator`, `Basic Sketch` | Gallery, compressed to WebP ≤ 250 KB; grouped by project |
| Models (30 `.ipt`/`.iam`/`.dwg`) | `Goldberg Assembly.iam` (+ ball ramp, sphere, dominoes, cup), `Glider Box.ipt` + `Glider Drawing.dwg`, `Gear chain.iam`, `Peg toy assembly.iam` (+ pegs, boards, `Peg toy drawing.dwg`), `Space Crush.iam` (+ clamp, aluminum box), `FORS phone case` (base + propeller), feature exercises (`loft 1`, `sweep 1`, `odd revolve`, `complex extrusion`) | **Not shipped** (no viewer). Filenames/feature types drive the "feature tree" captions; `.dwg` drawings referenced by their PNGs |

`demos/vexcode_vr_raw/`:

| Group | Files | Use |
|---|---|---|
| Python programs | `C 13 .vrpython` (Art Canvas: pen down, drive/turn by distance-sensor readings, `math.sqrt(2)` diagonal), `Experiment text project.vrpython` | Ported to the sim (JSON wrapper → Python text) |
| Block programs (15 `.vrblocks`, Blockly XML) | `C 4.3`, `C 5.1` (maze), `C 5.2/5.3`, `C 6.2/6.3`, `C 7-dance`, `C 8.3`, `C 10`, `C 11.1 LIMO list`, `C 14- Random drive`, `2D List`, `1` | Hand-ported to sim scripts for the 3–4 most interesting (maze, perimeter `C 4.2` if present as blocks/screenshot, random drive, dance); the rest shown as screenshots |
| Screenshots (43 PNG) | `C 1.1 … C 14`, `4 (counter loop)`, `6 (sensors)`, `7(2D list)` | Block-program panels beside the sim; compressed |

## Stage

### 1. Inventor gallery with feature stories
- Masonry of renders grouped by project (Goldberg · Glider · Gear chains · Space
  Crush/Launch · Peg toy · Wing simulator · sketches). Hover → the feature list inferred
  from the part files (e.g. "Glider Box: extrude → shell → fillet; manufacturing drawing
  with 3 views") as caption; the `.dwg`-derived drawing PNGs show as blueprint-styled
  cards.
- **Animation:** for projects with multiple renders (Glider ×6, Goldberg ×2, gear chains
  ×2 each), a "build-up" cross-fade sequence steps through the renders like a feature
  history; the gear-chain card runs a CSS rotation on the render's gear region (masked)
  so it visibly turns.
- Note in the corner: "Models exist as Inventor files; a 3-D viewer can be added when
  they're exported to GLB" (hook: `public/demos/modeling/glb/` auto-detected).

### 2. VEXcode VR simulator
- Top-down field (the VEX VR playgrounds approximated: **Wall Maze**, **Art Canvas**,
  **Grid Map**) with the robot (drivetrain, pen, front distance sensor, location
  sensor). Program picker: **Maze (C 5.1)**, **Perimeter (C 4.2)**, **Random drive
  (C 14)**, **Dance (C 7)**, **Art Canvas (C 13, Python)**.
- The program runs step by step: the current line (Python) or block (rendered as a
  simplified block list from the Blockly XML) highlights while the robot moves; pen
  trails draw; the distance-sensor ray is visible; `brain.print` output shows on a
  little brain screen ("wooo").
- Speed control, reset, and a "drive it yourself" mode (arrow keys) to feel the API.
- API surface ported: `drivetrain.drive/drive_for/turn_for/turn_to_heading/set_drive_velocity/stop`,
  `pen.move`, `location.position`, `distance.get_distance`, `wait`, `brain.print`,
  `bumper`/`down_eye` where a program needs them. Programs are ported by hand into a
  small TS coroutine per program (no Python interpreter in the browser).

## Story rail

1. First CAD: Inventor in a high-school engineering class; sketches → features →
   assemblies; the Goldberg machine as the big project.
2. Drawings: learning that a part needs a manufacturing drawing (the `.dwg`s).
3. VEXcode VR: first programs as blocks, then Python; sensors, loops, lists
   (`2D List`, `LIMO list`), and the maze.
4. Why it mattered: the path to PCBs, firmware, and the HardHack house.

## Assets (`public/demos/modeling/`)

- `renders/*.webp` (19), `vex/screens/*.webp` (a curated 15 of 43), `vex/programs.json`
  (ported program metadata + original source text for the drawer).

## Manifest (`content/modeling/site.ts`)

- displayName "Early 3D Modeling", favicon "🛠️", accent `#F59E0B`.
- deepLinks: `/demos/modeling#inventor`, `#vex`.
- techStack: Autodesk Inventor, VEXcode VR (Blocks + Python), TypeScript.
- knowledgePanel facts: Era (~2020–21) · CAD projects (7) · VEX programs (17) · Live sim.
- keywords: inventor, cad, 3d modeling, goldberg machine, vexcode vr, robotics, blocks.

## Attribution

- VEX playground look is approximated (no VEX assets copied). Inventor stock/VEX parts
  library was excluded at crawl time.

## Out of scope

- 3-D viewer (until GLB exports exist), Blockly rendering of the original XML (custom
  VEX block types), a general Python interpreter.

## Open questions

None (renders-only decided 2026-08-30).
