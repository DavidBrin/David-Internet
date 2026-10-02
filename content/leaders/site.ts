import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "leaders",
  displayName: "Leaders",
  fakeDomain: "leaders.davids.net",
  liveUrl: "https://leaders.leaders-game.workers.dev",
  tagline:
    "Civilization V from the leader's own eyes: walk the map, send couriers, command formations.",
  description:
    "This near-single-prompt creation using GPT-6.1 Sol is like Civilization V if it were played from the Leader's perspective and had combat options (attack formations). Everything is done from the leader's perspective, so instructions to build or move have to be sent via couriers. Enjoy exploring and figuring out your own strategy to dominate the map! A 2–4 player turn-based game on a hex world: found cities, research eleven technologies, improve land with builders, trade and ally by courier, and fight with five formations. Rooms persist on Cloudflare Workers and D1; solo practice runs the same rules untimed.",
  accentColor: "#d7b879",
  favicon: "👑",
  techStack: [
    "React 19",
    "Vite",
    "Three.js",
    "TypeScript (strict)",
    "Pure TypeScript rules engine",
    "Cloudflare Workers",
    "Cloudflare D1 (SQLite) with Drizzle migrations",
    "zod",
    "Vitest",
    "Playwright",
  ],
  needsDatabase: true,
  deepLinks: [
    {
      path: "/",
      title: "Leaders — create a room, join by code, or practice",
      snippet:
        "A game-native start screen: host a 2–4 player room with 60, 120 or 180 second rounds, join with a six-character code or invitation link, or start an untimed solo practice against a local opponent.",
      keywords: ["leaders game", "leaders", "civilization v", "civ 5", "turn-based strategy", "multiplayer", "practice"],
    },
    {
      path: "/rules",
      title: "Rules field guide — costs, counters and victory",
      snippet:
        "The in-game Rules guide: first-turn instructions, city yields, eleven technologies, nine buildings, four trainable units and messengers, five formations with frontal, flank, wedge and encirclement effects, diplomacy, and the conquest, science and round-50 score victories.",
      keywords: ["rules", "formations", "technologies", "victory", "couriers", "messengers", "field guide"],
    },
  ],
  images: [
    {
      src: "/content/leaders/screenshots/capital-first-round.png",
      caption:
        "Round 1 of a practice game: the capital's banner, the leader and retinue, the first hint card and the relative movement pad",
      targetPath: "/",
    },
    {
      src: "/content/leaders/screenshots/developed-empire.png",
      caption: "A developed empire from behind the leader: cities, improvements, territory borders and the command tray",
      targetPath: "/",
    },
    {
      src: "/content/leaders/screenshots/phone-portrait.png",
      caption: "Portrait phone layout with the touch movement pad and the timed end-turn button",
      targetPath: "/",
    },
  ],
  videos: [],
  keywords: [
    "leaders",
    "leaders game",
    "civilization",
    "civilization v",
    "civ 5",
    "civ v",
    "4x",
    "turn-based strategy",
    "hex strategy",
    "third person strategy",
    "couriers",
    "messengers",
    "formations",
    "multiplayer browser game",
    "cloudflare workers",
    "three.js game",
    "gpt-6.1 sol",
    "codex",
  ],
  knowledgePanel: {
    type: "Browser game",
    facts: {
      Category: "Turn-based 4X strategy, played from behind your leader on the ground",
      Players: "2 to 4 in a shared room, or untimed solo practice",
      Rounds: "60, 120 or 180 seconds; everyone acting simultaneously, resolved together",
      Couriers: "Distant build, move and diplomatic orders travel by messenger and take effect on delivery",
      Combat: "Five formations: line, square, wedge, flank and encirclement effects",
      Victory: "Conquest, science (three cities with labs and the scientific method) or score at round 50",
      Origin: "A near-single-prompt build with GPT-6.1 Sol, then a controls, pacing and deployment pass",
      Hosting: "Cloudflare Workers with a D1 database, free tier",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
