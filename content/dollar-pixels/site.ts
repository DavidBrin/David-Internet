import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "dollar-pixels",
  displayName: "Dollar Pixels",
  fakeDomain: "pixels.davids.net",
  liveUrl: "https://dollar-pixels-david.vercel.app",
  tagline: "$1 buys nine pixels — a Million Dollar Homepage rebuild in blocks of nine",
  description:
    "A rebuild of the 2005 Million Dollar Homepage where blocks of nine pixels (a 3x3 square) sell for $1 on a 1200x1200 grid of 160,000 blocks. Unlike the original, buyers can make their own page and claims never link anywhere — Play money is the default, with a one-env-var switch to real Stripe payments through the same settlement code path.",
  accentColor: "#FFD700",
  favicon: "🟨",
  techStack: [
    "Next.js 16",
    "React 19",
    "TypeScript",
    "Zod",
    "Stripe",
    "Neon Postgres",
    "SQLite (node:sqlite)",
    "Tailwind CSS 4",
    "Vitest",
    "fast-check",
    "Playwright",
  ],
  needsDatabase: true,
  deepLinks: [
    {
      path: "/",
      title: "Dollar Pixels — $1 buys nine pixels",
      snippet:
        "The landing page: the pitch, live sold/available counters, a link to the wall and the directory.",
      keywords: ["million dollar homepage", "pixel grid", "buy pixels", "landing page"],
    },
    {
      path: "/p/the-wall",
      title: "The Wall — the flagship 1200x1200 pixel grid",
      snippet:
        "The flagship page: a 400x400-block grid worth $160,000 in face value, where you drag to select and buy blocks of nine pixels.",
      keywords: ["the wall", "pixel wall", "buy blocks", "million dollar homepage clone"],
    },
    {
      path: "/pages",
      title: "Directory — premium pages",
      snippet:
        "Browse the directory of listed premium pages, where block sales pay the page's creator.",
      keywords: ["directory", "premium pages", "listed pages"],
    },
    {
      path: "/new",
      title: "Create a page — unlisted or premium",
      snippet:
        "Make your own page: pick a size, see the live price, and check slug availability. Unlisted pages are $10 flat; premium pages cost blocks times $0.50.",
      keywords: ["create page", "make your own page", "new page", "premium page"],
    },
    {
      path: "/dashboard",
      title: "Dashboard — your pages, claims and earnings",
      snippet:
        "See the pages you own, the claims you've bought, and your creator earnings ledger.",
      keywords: ["dashboard", "earnings", "my pages", "ledger"],
    },
  ],
  images: [
    {
      src: "/content/dollar-pixels/screenshots/landing.png",
      caption: "The landing page pitch with live sold/available counters",
      targetPath: "/",
    },
    {
      src: "/content/dollar-pixels/screenshots/the-wall.png",
      caption: "The flagship 1200x1200 pixel grid, 'the wall'",
      targetPath: "/p/the-wall",
    },
    {
      src: "/content/dollar-pixels/screenshots/selecting.png",
      caption: "Dragging a selection rectangle to buy blocks",
      targetPath: "/p/the-wall",
    },
    {
      src: "/content/dollar-pixels/screenshots/zoomed.png",
      caption: "Zoomed-in view of the pixel grid",
      targetPath: "/p/the-wall",
    },
    {
      src: "/content/dollar-pixels/screenshots/checkout.png",
      caption: "The fake-money mock checkout screen",
      targetPath: "/p/the-wall",
    },
    {
      src: "/content/dollar-pixels/screenshots/directory.png",
      caption: "The directory of listed premium pages",
      targetPath: "/pages",
    },
    {
      src: "/content/dollar-pixels/screenshots/new-page.png",
      caption: "Creating a new unlisted or premium page",
      targetPath: "/new",
    },
  ],
  videos: [],
  keywords: [
    "million dollar homepage",
    "buy pixels",
    "pixel grid",
    "internet history clone",
    "pixel art wall",
    "sell pixels for money",
    "advertising pixels",
  ],
  knowledgePanel: {
    type: "Web application",
    facts: {
      "Grid size": "1200 x 1200 pixels (400 x 400 blocks = 160,000 blocks)",
      Price: "$1 per 3x3 pixel block, computed server-side",
      Payment:
        "Play money by default; one env var flips to real Stripe payments through the same settlement code",
      "Page types":
        "Flagship, unlisted ($10 flat, 69 free blocks) and premium (blocks x $0.50, creator gets paid)",
      Testing: "414 unit/property tests plus 30 Playwright e2e specs",
    },
  },
  docs: { readme: true, spec: true, decisions: true },
};

export default site;
