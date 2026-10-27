import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "super-smash",
  displayName: "David-Smash",
  fakeDomain: "smash.davids.net",
  liveUrl: "https://david-smash.leaders-game.workers.dev",
  tagline:
    "Eight fighters, one keyboard, sixty frames a second: a browser rebuild of Smash Ultimate's versus mode",
  description:
    "A browser rebuild of Super Smash Bros. Ultimate's versus mode, with menus, HUD and physics reproduced from measured values rather than approximated by feel: the knockback equation is Ultimate's, the stage geometry is Kurogane Hammer's, and frame data comes from the game's own decompiled scripts. Fighters are drawn entirely from code (a bone hierarchy of capsules and circles posed from keyframe data), since no Nintendo art is used anywhere. It adds online play with rollback netcode over WebRTC — two browsers meet through a room code on a Cloudflare Durable Object, with Cloudflare TURN behind it — something the original (delay-based) doesn't have.",
  accentColor: "#E60012",
  favicon: "🎮",
  techStack: [
    "Next.js 16",
    "React 19",
    "TypeScript",
    "Zustand",
    "WebRTC (Durable Object signalling)",
    "Cloudflare Workers + Durable Objects",
    "Tailwind CSS 4",
    "Canvas rendering",
    "Web Audio API (synthesized sound)",
    "Vitest + fast-check",
    "Playwright",
  ],
  needsDatabase: false,
  deepLinks: [
    {
      path: "/",
      title: "David-Smash: Title",
      snippet:
        "PRESS ANY BUTTON over the wordmark. The entry point to an eight-fighter browser brawl with no keys, no database, no account required.",
      keywords: ["super smash", "smash bros title screen", "browser fighting game"],
    },
    {
      path: "/menu",
      title: "Main Menu: David-Smash",
      snippet:
        "The main menu: five diagonally-slashed mode tiles, reproduced pixel-for-pixel from Ultimate's sheared visual language.",
      keywords: ["smash main menu", "game menu"],
    },
    {
      path: "/fighters",
      title: "Character Select: David-Smash",
      snippet:
        "A portrait grid ordered by fighter number (Mario, Donkey Kong, Link, Samus, Kirby, Fox, Pikachu and Marth) with sheared player panels below.",
      keywords: ["smash character select", "fighter roster", "pick a character"],
    },
    {
      path: "/stage",
      title: "Stage Select: David-Smash",
      snippet:
        "Six competitive-legal stages with real blast-zone geometry from Kurogane Hammer, plus a Normal / Battlefield / Omega toggle.",
      keywords: ["smash stage select", "battlefield final destination"],
    },
    {
      path: "/rules",
      title: "Rules: David-Smash",
      snippet:
        "Set stock or time, stock count, and whether the Smash Ball spawns before the match begins.",
      keywords: ["smash rules", "stock or time"],
    },
    {
      path: "/play",
      title: "Match: David-Smash",
      snippet:
        "The brawl itself: fixed-point deterministic physics, real knockback formulas, and rollback netcode for online play.",
      keywords: ["play super smash", "smash bros match", "fighting game online"],
    },
    {
      path: "/online",
      title: "Online: David-Smash",
      snippet:
        "Create a room and read out its four-letter code, or type one in: two browsers, rollback netcode, Cloudflare TURN when no direct path exists.",
      keywords: ["smash online", "room code", "play smash online"],
    },
    {
      path: "/controls",
      title: "Controls: David-Smash",
      snippet:
        "Two mirrored keyboard schemes (Arrows and WASD) plus a third preset for local co-op, all rebindable per player.",
      keywords: ["smash keyboard controls", "control scheme"],
    },
    {
      path: "/results",
      title: "Results: David-Smash",
      snippet: "Final placings, KOs, falls and self-destructs after the match ends.",
      keywords: ["smash match results", "kos and stocks"],
    },
  ],
  images: [
    {
      src: "/content/super-smash/screenshots/title.png",
      caption: "Title screen, PRESS ANY BUTTON over the wordmark",
      targetPath: "/",
    },
    {
      src: "/content/super-smash/screenshots/main-menu.png",
      caption: "Main menu: five diagonally-slashed mode tiles",
      targetPath: "/menu",
    },
    {
      src: "/content/super-smash/screenshots/character-select.png",
      caption: "Character select: portrait grid ordered by fighter number",
      targetPath: "/fighters",
    },
    {
      src: "/content/super-smash/screenshots/stage-select.png",
      caption: "Stage select with the Normal / Battlefield / Omega toggle",
      targetPath: "/stage",
    },
    {
      src: "/content/super-smash/screenshots/rules.png",
      caption: "The rules panel: stock or time, stock count, Smash Ball",
      targetPath: "/rules",
    },
    {
      src: "/content/super-smash/screenshots/match.png",
      caption:
        "Mario and Donkey Kong fighting on Battlefield, with the damage HUD below",
      targetPath: "/play",
    },
    {
      src: "/content/super-smash/screenshots/match-2.png",
      caption: "A second match in progress, showing the damage meter and stage geometry",
      targetPath: "/play",
    },
    {
      src: "/content/super-smash/screenshots/controls.png",
      caption: "The controls screen showing both keyboard schemes on a keyboard diagram",
      targetPath: "/controls",
    },
  ],
  videos: [],
  keywords: [
    "super smash bros",
    "smash ultimate browser game",
    "fighting game online",
    "rollback netcode",
    "keyboard fighting game",
    "smash clone",
    "canvas fighting game",
    "cloudflare durable objects game",
    "david-smash",
  ],
  knowledgePanel: {
    type: "Browser game",
    facts: {
      Roster: "8 fighters: Mario, Donkey Kong, Link, Samus, Kirby, Fox, Pikachu, Marth",
      Physics:
        "Fixed 60Hz simulation using Q12 fixed-point integers and a trig lookup table for cross-browser determinism",
      Netcode:
        "Rollback over WebRTC (Durable Object signalling, Cloudflare TURN), 2 frames of input delay, 8-frame prediction cap",
      Stages: "6 competitive-legal stages with geometry sourced from Kurogane Hammer",
      Art: "No Nintendo assets; every fighter is a code-drawn bone hierarchy, and all sound is synthesized",
    },
  },
  docs: { readme: true, spec: true, decisions: true },
};

export default site;
