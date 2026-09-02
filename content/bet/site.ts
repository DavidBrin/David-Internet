import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "bet",
  displayName: "Bet",
  fakeDomain: "bet.davids.net",
  liveUrl: "https://bet-david-pink.vercel.app",
  tagline: "wanna bet? — make the groupchat put their money where their mouth is",
  description:
    "A private, friend-first prediction market where every bet lives inside a group and carries its own groupchat where trades appear inline as they happen. It ships with a fully seeded play-money world (12 users, 3 groups, 10 private markets, ~24 public Explore markets) and a public read-only Explore surface styled as a Kalshi x Polymarket hybrid. Play money only — no real currency, payments, or deposits.",
  accentColor: "#10B981",
  favicon: "🎲",
  techStack: [
    "Next.js 16 (App Router)",
    "React 19",
    "TypeScript",
    "Tailwind CSS 4",
    "Zod",
    "Zustand",
    "jose (JWT sessions)",
    "Vitest + fast-check",
    "Playwright",
    "Hexagonal architecture",
  ],
  needsDatabase: false,
  deepLinks: [
    {
      path: "/",
      title: "Bet — wanna bet?",
      snippet:
        "Full-bleed dark hero with the private prediction market pitch, a Start betting CTA, and a live-looking demo market card.",
      keywords: ["bet", "prediction market", "wanna bet", "home"],
    },
    {
      path: "/app",
      title: "Group dashboard — Bet",
      snippet:
        "Your groups as tabs (Sunday League, The Roommates, Fantasy 2026) with market cards sorted into Closing soon, Open, Awaiting resolution and Settled.",
      keywords: ["group dashboard", "my bets", "markets"],
    },
    {
      path: "/app/new",
      title: "Create a bet — 5-step wizard",
      snippet:
        "Question, outcomes, pricing engine (market-priced, set your own odds, or pool), invite friends as chips, then review and create.",
      keywords: ["create bet", "new market", "wizard"],
    },
    {
      path: "/app/friends",
      title: "Friends — Bet",
      snippet:
        "Instagram-shaped friends screen with requests and username search — you can never see another user's friend list.",
      keywords: ["friends", "friend requests", "search users"],
    },
    {
      path: "/app/activity",
      title: "Activity — notifications and trade history",
      snippet: "Notifications feed and trade history for the signed-in user.",
      keywords: ["activity", "notifications", "trade history"],
    },
    {
      path: "/explore",
      title: "Explore — public markets (Bet)",
      snippet:
        "A public, read-only surface styled as a deliberate mix of Kalshi and Polymarket, with category tabs, chip filters, and a dense card grid.",
      keywords: ["explore", "public markets", "kalshi", "polymarket"],
    },
    {
      path: "/signin",
      title: "Sign in — Bet",
      snippet: "Demo user picker; pick @dev to sign in, no password required.",
      keywords: ["sign in", "login", "demo user"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "bet",
    "prediction market",
    "friend group betting app",
    "play money betting",
    "kalshi clone",
    "polymarket clone",
    "LMSR pricing",
    "group chat trading app",
  ],
  knowledgePanel: {
    type: "Web application",
    facts: {
      Category: "Private, friend-first prediction market",
      Currency: "Play money only (credits) — no real money, payments, or deposits",
      "Pricing engines":
        "LMSR (default automated market maker), fixed odds, and parimutuel pool — three strategies behind one interface",
      Architecture:
        "Hexagonal: pure-TypeScript domain, ports/adapters, in-memory DataStore by default",
      "Test suite":
        "~664 unit, property, and route-handler tests plus Playwright end-to-end tests",
    },
  },
  docs: { readme: true, spec: true, decisions: true },
};

export default site;
