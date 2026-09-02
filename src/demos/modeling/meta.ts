import type { DemoMeta } from "@/lib/demos";

const SRC = "demos/modeling_src";

const meta: DemoMeta = {
  slug: "modeling",
  theme: { bg: "#f4f2ee", panel: "#eae6dd" }, // workshop grey with drafting-paper warmth
  what: "the first CAD: Inventor renders told as feature stories, and VEX robot programs that actually run",
  why: "before PCBs and firmware there was a Goldberg machine and a maze-solving virtual robot; this is where the hardware side started",
  when: "high-school engineering, ~2020-21: Autodesk Inventor + VEXcode VR",
  story: [
    {
      title: "Sketch, constrain, extrude",
      body:
        "Inventor teaches CAD as a grammar: draw a 2D sketch, pin it down with dimensions and constraints, then give it depth. The archive keeps the vocabulary drills as part files (loft 1, sweep 1, odd revolve, complex extrusion) and one Basic Sketch render where the constraint markers are still visible on every polygon. The gallery below groups what those exercises became: gear chains on pegboard, a glider, a box crusher, a peg toy.",
      anchor: "#inventor",
    },
    {
      title: "The Goldberg machine",
      body:
        "The big project was a Rube Goldberg assembly: ball ramps, dominoes, a cup, a sphere: eleven part files composed into Goldberg Assembly.iam. Assemblies are where CAD stops being drawing and starts being engineering: parts get mates and degrees of freedom, and the machine either lines up or it doesn't. The renders show the table-top contraption mid-build.",
      anchor: "#inventor",
    },
    {
      title: "A part needs a drawing",
      body:
        "The glider goes from six renders to a manufacturing drawing: three orthographic views, dimensions, a title block signed 'david' and dated 1/26/2021. The .dwg files for the glider and the peg toy are the first contact with the idea that making something real requires a document someone else can build from. The blueprint cards in the gallery are those drawings.",
      anchor: "#inventor",
    },
    {
      title: "First programs drove a robot",
      body:
        "The same era's code lives in VEXcode VR: block programs that step a virtual drivetrain around 2D playgrounds, graduating to Python by lesson 13. The simulator below is this page's own TypeScript port of the vexcode API surface those programs use (drivetrain, pen, location, distance and eye sensors), so the maze run, the perimeter octagon, the dance and the random drive execute for real, with the block listing highlighting as the robot moves.",
      anchor: "#vex",
    },
    {
      title: "Sensors close the loop",
      body:
        "The progression hidden in the lesson numbers: C 4 draws shapes with dead reckoning, C 5 solves the Wall Maze by reacting to walls (front eye) and the finish square (down eye), C 14 gives up on planning entirely: drive forever, and when something appears ahead, turn a random amount. And C 13 switches to Python to do sensor arithmetic blocks can't express cleanly: measure a distance, subtract an offset, drive exactly that far, then take the sqrt(2) diagonal.",
      anchor: "#vex",
    },
    {
      title: "What's approximated (built 2026-09-01)",
      body:
        "Honesty box: no 3D viewer, because no STL/GLB exports of the Inventor models exist anywhere, so the gallery animates the render sequences instead (a viewer hook waits if they're ever exported). The VEX playgrounds are approximations drawn for this page; no VEX assets were copied. The perimeter program's block file didn't survive; its listing is reconstructed from the screenshot, labeled. The 'Wing simulator' image in the archive is NASA's FoilSim JS tool, not an Inventor render; it is shown separately, attributed. Feature stories are inferred from the part filenames. The sim and widgets were written with AI coding tools.",
    },
  ],
  sources: [
    { name: "Art Canvas (C 13)", path: `${SRC}/artcanvas.py`, lang: "python", note: "The first text program (extracted from the .vrpython wrapper): position polling, distance arithmetic, the sqrt(2) diagonal. The sim runs a TS port of it." },
    { name: "Grid experiment", path: `${SRC}/experiment.py`, lang: "python", note: "Free-form Python on the Grid playground: a heading-conditioned square and operation_circle, 90 four-degree arcs (extracted)." },
    { name: "maze blocks", path: `${SRC}/maze_blocks.txt`, lang: "text", note: "C 5.1 rendered from its Blockly XML: dead reckoning in, wall-following with the front eye, down-eye finish detection." },
    { name: "random drive blocks", path: `${SRC}/random_blocks.txt`, lang: "text", note: "C 14 rendered from its Blockly XML: forever-drive with optical and bumper reactions." },
    { name: "dance blocks", path: `${SRC}/dance_blocks.txt`, lang: "text", note: "C 7 rendered from its Blockly XML: nested repeats of spins and reverses." },
    { name: "perimeter (reconstructed)", path: `${SRC}/perimeter_blocks.txt`, lang: "text", note: "C 4.2's block file didn't survive; this listing is reconstructed from the screenshot, and says so." },
    { name: "vexcode.ts", path: "src/demos/modeling/vex/vexcode.ts", lang: "ts", note: "The TS port of the vexcode API surface the programs use: drivetrain, pen, location, distance, eyes, bumpers, driving the 2D sim." },
    { name: "prep script", path: "scripts/demos/modeling_prep.py", lang: "python", note: "Build-time prep: WebP compression of renders/screenshots, Blockly-XML-to-listing parsing, .vrpython extraction, programs.json." },
  ],
  sourceFooter:
    "High-school engineering coursework, ~2020-21. CAD: Autodesk Inventor (renders are David's; the stock/VEX parts library was excluded at crawl time; models exist only as .ipt/.iam, no 3D exports). Robot programs: VEXcode VR lessons (block/Python templates are VEX's; the solutions are David's; the playground look here is approximated, no VEX assets copied). The 'Wing simulator' screenshot is NASA Glenn's FoilSim JS, shown for the record.",
};

export default meta;
