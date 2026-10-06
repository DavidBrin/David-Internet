import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "risk",
  displayName: "Risk",
  fakeDomain: "risk.davids.net",
  liveUrl: "https://risk-david.vercel.app",
  tagline:
    "RISK: Global Domination, rebuilt with the dice already in the action log — the engine never rolls one.",
  description:
    "A browser rebuild of SMG Studio's RISK: Global Domination: solo against five bot tiers, pass-and-play for up to six on one device, and casual online games behind a four-letter lobby code with forty-two preset chat lines and no free text. Sixteen boards (three public-domain, nine generated from Natural Earth, a seeded random generator), eleven modifiers — Fog of War, Capitals, Blizzards, Portals, Percentage Domination, Manual Placement, Max Rounds, Round Delay, Alliances, Fixed or Progressive cards, Balanced Blitz or True Random dice — and a battle log. The engine is a pure function with no randomness at all: the opening deal, every card drawn and every battle's losses are data inside the action that caused them, so replaying the log reproduces the authority's hash at every row, and Balanced Blitz matches SMG's own published odds to fifteen decimal places.",
  accentColor: "#D62B3C",
  favicon: "🎲",
  techStack: [
    "Next.js 16 (App Router)",
    "React 19.2",
    "TypeScript (strict)",
    "Tailwind CSS v4",
    "Pure deterministic engine (seeded PCG32, no Math.random) with an enforced layering test",
    "Exact O(A·D) battle-odds tables (True Random and Balanced Blitz)",
    "Five-tier persona bots",
    "SVG board with HTML troop tokens under one camera projection",
    "PostgreSQL for online play (PGlite WASM locally, Neon in production) behind an append-only action log and adaptive polling",
    "Zustand",
    "zod",
    "Vitest + fast-check",
    "Playwright",
  ],
  needsDatabase: true,
  deepLinks: [
    {
      path: "/",
      title: "Risk — claim a name and press BATTLE",
      snippet:
        "Anyone who arrives gets a temporary, discoverable identity — a display name and a colour — then picks Solo, Pass & Play or Online.",
      keywords: ["risk", "risk game", "risk global domination", "risk online", "play risk"],
    },
    {
      path: "/new",
      title: "Select a game type — Solo, Pass & Play, Online",
      snippet:
        "Solo against one to five bots, hot-seat for two to six on one device, or a casual online lobby; FFA or 1v1.",
      keywords: ["solo", "pass and play", "hot-seat", "online multiplayer", "1v1"],
    },
    {
      path: "/new/map",
      title: "Choose a map — sixteen boards",
      snippet:
        "Classic World, World Simple, Europe, United States, Asia, Africa, North and South America, Australia & New Zealand, the Middle East, World Extended, Napoleonic Europe, and a seeded random board with a territory and continent count of your choosing.",
      keywords: ["maps", "classic world", "napoleonic europe", "random map", "voronoi"],
    },
    {
      path: "/new/rules",
      title: "Modes and Modifiers",
      snippet:
        "World, Percentage or Capitals domination; Blizzards, Fog of War, Portals, Capitals, Manual Placement, Max Rounds, Round Delay, the 1v1 neutral army; Fixed or Progressive cards; Balanced Blitz or True Random dice; five bot difficulties.",
      keywords: ["modifiers", "fog of war", "capitals", "blizzards", "portals", "balanced blitz", "true random"],
    },
    {
      path: "/lobby",
      title: "Online lobbies — who is here, and a four-letter code",
      snippet:
        "See who is online right now, host a lobby with a four-letter code, or join one; the authority runs bots and turn timers lazily inside the next poll.",
      keywords: ["lobby", "online", "casual play", "lobby code", "turn timer"],
    },
  ],
  images: [
    {
      src: "/content/risk/screenshots/solo-draft.png",
      caption: "A solo game in the draft phase: owner-coloured territories, troop tokens, the roster on the right edge and the troops-to-deploy counter",
      targetPath: "/",
    },
    {
      src: "/content/risk/screenshots/blitz.png",
      caption: "The Blitz view: attacker and defender over a scrimmed board, the win chance in gold, three red dice and the Attack Limit slider",
      targetPath: "/",
    },
    {
      src: "/content/risk/screenshots/cards.png",
      caption: "The card-trade panel: a fan of territory cards with the best set already picked and the fixed-bonus legend",
      targetPath: "/",
    },
    {
      src: "/content/risk/screenshots/map-picker.png",
      caption: "The map picker: sixteen boards on tilted glass trays, plus a random-board generator",
      targetPath: "/new/map",
    },
    {
      src: "/content/risk/screenshots/rules.png",
      caption: "Modes and Modifiers: the chosen map as a tilted hero, the rules readout and the modifier toggles",
      targetPath: "/new/rules",
    },
    {
      src: "/content/risk/screenshots/lobby.png",
      caption: "The online lobby: who is here, a four-letter code, seats and readiness",
      targetPath: "/lobby",
    },
    {
      src: "/content/risk/screenshots/victory.png",
      caption: "Victory: a laurel-ringed portrait under a fan of stars",
      targetPath: "/",
    },
  ],
  videos: [],
  keywords: [
    "risk",
    "risk game",
    "risk global domination",
    "risk replica",
    "smg studio",
    "world domination",
    "board game",
    "dice",
    "balanced blitz",
    "true random",
    "fog of war",
    "capitals",
    "blizzards",
    "portals",
    "pass and play",
    "hot-seat",
    "online multiplayer",
    "casual play",
    "lobby code",
    "bots",
    "napoleonic europe",
    "deterministic engine",
    "action log",
  ],
  knowledgePanel: {
    type: "Browser game",
    facts: {
      Category: "Turn-based territory-conquest strategy (RISK) in the browser",
      Modes: "Solo vs five bot tiers, Pass & Play for six, casual online lobbies with a four-letter code",
      Boards: "Sixteen — three public-domain, nine generated from Natural Earth, a seeded random generator",
      Dice: "Balanced Blitz reproduced to fifteen decimal places from SMG's published examples, or True Random",
      Engine: "A pure apply(state, map, action) with no randomness: the dice are already in the action log",
      "Test suite": "1,880 unit and property tests and 18 Playwright end-to-end runs across desktop and mobile Chrome",
    },
  },
  docs: { readme: true, spec: true, decisions: true },
};

export default site;
