import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "art-wall",
  displayName: "Art Wall",
  fakeDomain: "artwall.davids.net",
  liveUrl: "https://art-wall-pi.vercel.app",
  tagline: "A public chalkboard you can actually draw on",
  description:
    "THE Public Art Wall: a shared canvas with three surfaces — street, ideas, and a photographed chalkboard. Anyone can leave strokes or text; there are no accounts. Marks persist in Postgres and show up for everyone within a couple of seconds.",
  accentColor: "#25586e",
  favicon: "🖍️",
  techStack: [
    "Next.js 16",
    "React 19",
    "TypeScript",
    "Canvas",
    "Neon Postgres",
    "Tailwind CSS 4",
    "Vitest",
  ],
  needsDatabase: true,
  deepLinks: [
    {
      path: "/",
      title: "Art Wall — the public drawing wall",
      snippet:
        "Full-screen shared canvas. Menu and About are the only chrome. Draw, erase, or drop text on the street, ideas, or chalkboard surface.",
      keywords: ["art wall", "art-wall", "public chalkboard", "shared canvas", "draw together"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "art wall",
    "art-wall",
    "artwall",
    "public art wall",
    "chalkboard",
    "shared canvas",
    "collaborative drawing",
  ],
  knowledgePanel: {
    type: "Web application",
    facts: {
      Surfaces: "Street, Ideas, and Chalkboard (photographed slate)",
      Persistence: "Neon Postgres — strokes and text, no accounts",
      Sync: "The wall polls for new marks every few seconds",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
