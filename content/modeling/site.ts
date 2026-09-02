import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "modeling",
  kind: "demo",
  displayName: "Early 3D Modeling",
  fakeDomain: "modeling.davids.net",
  liveUrl: "/demos/modeling",
  tagline: "Where the hardware side started: Inventor CAD renders told as feature stories, and VEX robot programs running in a live 2D sim.",
  description:
    "Interactive demo of David's earliest engineering work (~2020-21): an Autodesk Inventor gallery (the Goldberg machine assembly, a glider with its manufacturing drawing, gear chains, the Space Crush box crusher, a peg toy) grouped by project with feature stories inferred from the part files and build-up cross-fade animations over the render sequences; and a VEXcode VR simulator written for this page in TypeScript, where the original block and Python programs (Wall Maze, perimeter octagon, dance, random drive, Art Canvas) actually execute against a ported drivetrain/pen/sensor API, the current block highlighting as the robot moves, pen trails drawing, plus a drive-it-yourself mode.",
  accentColor: "#F59E0B",
  favicon: "\u{1F6E0}",
  techStack: ["Autodesk Inventor", "VEXcode VR (Blocks + Python)", "TypeScript", "Canvas"],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#inventor",
      title: "The Inventor gallery",
      snippet:
        "Renders grouped by project (Goldberg machine, glider with its 1/26/2021 manufacturing drawing, gear chains, Space Crush, sketches), with hover feature stories and build-up animations; gears visibly turn.",
      keywords: ["cad", "inventor", "goldberg machine", "glider", "gear chain", "manufacturing drawing"],
    },
    {
      path: "#vex",
      title: "The VEX robot simulator",
      snippet:
        "The original 2020 programs running live: the Wall Maze solved by eye sensors, the perimeter octagon drawn pen-down, the dance, the random drive, and the Python Art Canvas, with the block listing highlighting in step and an arrow-key drive mode.",
      keywords: ["vexcode vr", "robot simulator", "blocks", "maze", "pen trail", "sensors"],
    },
  ],
  images: [],
  videos: [],
  keywords: ["inventor", "cad", "3d modeling", "goldberg machine", "vexcode vr", "robotics", "blocks", "early projects"],
  knowledgePanel: {
    type: "Origins demo",
    facts: {
      Era: "~2020-21, high-school engineering",
      "CAD projects": "7 groups, 30 part/assembly files archived",
      "VEX programs": "17 archived; 6 ported and running in the page's own sim",
      Drawings: "3 manufacturing .dwg files (glider, peg toy)",
      "On this page": "renders + a TS vexcode port; no VEX assets copied, no 3D exports exist",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
