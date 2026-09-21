import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "island-empire",
  displayName: "Island Empire",
  fakeDomain: "island-empire.davids.net",
  liveUrl: "https://island-empire-david.vercel.app",
  tagline:
    "The Slay-like mobile game, rebuilt on a square grid — every tile pays one gold a day; every knight eats it.",
  description:
    "A browser rebuild of HBRZ-Developer's Island Empire, the turn-based territory game descended from Slay and Antiyoy. A twelve-level campaign with the original's tutorials, random maps against an AI, hot-seat for up to eight players, weekly challenges and a map editor whose maps are shareable by link. Every rule and number was read off the game's screenshots and walkthrough videos — which showed a square grid with 4-neighbour adjacency where every written source said hex. The engine is a pure TypeScript function with an enforced layering test; every sprite is drawn from code onto a 32-pixel canvas.",
  accentColor: "#2898F0",
  favicon: "🏝️",
  techStack: [
    "Next.js 16 (App Router)",
    "React 19.2",
    "TypeScript (strict)",
    "Tailwind CSS v4",
    "Canvas renderer with code-drawn pixel art",
    "Pure deterministic game engine (AI, map generator, undo by replay)",
    "PostgreSQL for shared maps (PGlite WASM locally, Neon in production)",
    "Zustand",
    "Vitest + fast-check",
    "Playwright",
  ],
  needsDatabase: true,
  deepLinks: [
    {
      path: "/",
      title: "Island Empire — main menu",
      snippet:
        "Campaign, Random Map, Hot-seat, Weekly Challenges, Map Editor and Settings on a pixel-art title screen.",
      keywords: ["island empire", "island empire game", "slay clone", "antiyoy"],
    },
    {
      path: "/campaign",
      title: "Campaign overworld — twelve levels",
      snippet:
        "Three islands joined by bridges, a dirt path with twelve numbered nodes, stars per difficulty, an avatar that walks the path — and, unlike the original, tap-to-jump to any unlocked level.",
      keywords: ["campaign", "level select", "overworld", "tutorial levels"],
    },
    {
      path: "/play/campaign/01",
      title: "Level 1 — First Steps",
      snippet:
        "The first tutorial: two tiles, one knight and an enemy city next door. LET'S DESTROY THE ENEMY CITY.",
      keywords: ["level 1", "first steps", "tutorial", "turn-based strategy"],
    },
    {
      path: "/random",
      title: "Random map setup",
      snippet:
        "Pick a size, a biome (grass, desert, snow), two to eight seats with a difficulty each and a seed; the map generator draws islands, mountains, forests, mines and chests.",
      keywords: ["random map", "procedural map", "map generator", "play vs ai"],
    },
    {
      path: "/hotseat",
      title: "Hot-seat multiplayer",
      snippet: "Pass-and-play for up to eight humans on one device, with a hand-off screen between turns.",
      keywords: ["hot-seat", "hotseat", "local multiplayer", "pass and play"],
    },
    {
      path: "/challenges",
      title: "Weekly challenges",
      snippet:
        "Three maps chosen deterministically from the ISO week, a medal per difficulty beaten and a countdown to next Monday.",
      keywords: ["weekly challenges", "challenge maps", "medals"],
    },
    {
      path: "/editor",
      title: "Map editor",
      snippet:
        "Paint terrain and biomes, set owners, place cities, farms, mines, chests, walls and knights, validate live, then save a link anyone can play.",
      keywords: ["map editor", "custom maps", "level editor", "share a map"],
    },
  ],
  images: [
    {
      src: "/content/island-empire/screenshots/overworld.png",
      caption: "Campaign overworld: three islands, twelve level nodes and the walking avatar",
      targetPath: "/campaign",
    },
    {
      src: "/content/island-empire/screenshots/match.png",
      caption: "A level in play: bead borders, a selected knight's move zone, shield badges and the HUD bar",
      targetPath: "/play/campaign/07",
    },
    {
      src: "/content/island-empire/screenshots/strength-chart.png",
      caption: "The HELP! strength chart: which knight level beats a farm, a city, a woodwall and a stone tower",
      targetPath: "/play/campaign/03",
    },
    {
      src: "/content/island-empire/screenshots/editor.png",
      caption: "Map editor: painted grid, toolbox and live validation",
      targetPath: "/editor",
    },
    {
      src: "/content/island-empire/screenshots/challenges.png",
      caption: "Weekly challenges: three wooden panels with medals and a countdown",
      targetPath: "/challenges",
    },
    {
      src: "/content/island-empire/screenshots/random-setup.png",
      caption: "Random map setup: size, biome, seats and seed with a live thumbnail",
      targetPath: "/random",
    },
  ],
  videos: [],
  keywords: [
    "island empire",
    "island empire replica",
    "slay",
    "antiyoy",
    "turn-based strategy",
    "territory game",
    "hex strategy",
    "square grid",
    "knights",
    "provinces",
    "map editor",
    "weekly challenges",
    "hot-seat",
    "pixel art game",
  ],
  knowledgePanel: {
    type: "Browser game",
    facts: {
      Category: "Turn-based territory strategy (Slay / Antiyoy lineage) on a square grid",
      Modes: "12-level campaign, random maps vs AI, hot-seat for 8, weekly challenges, map editor",
      Rules:
        "A tile pays 1 gold a day; knights cost 10/20/30/40 and eat 2/5/12/30; attack only when strictly stronger than the tile's defence",
      Graphics: "Every sprite drawn from code onto a 32-pixel canvas — no image assets",
      "Test suite": "434 unit and property tests and 25 Playwright end-to-end tests",
      Architecture: "A pure engine (apply(state, action) → state + events) with a test that bans React, the DOM and Math.random from it",
    },
  },
  docs: { readme: true, spec: true, decisions: true },
};

export default site;
