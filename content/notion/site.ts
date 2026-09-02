import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "notion",
  displayName: "Notion",
  fakeDomain: "notion.davids.net",
  liveUrl: "https://notion-david.vercel.app",
  tagline: "A working Notion replica — real block editor, real databases, all in the browser.",
  description:
    "A full-fidelity clone of Notion's marketing site and product, built by a team of coding agents in a single session. Pages are made of editable blocks, databases render as board/table/list/calendar views with drag-and-drop, and everything persists locally via IndexedDB with no server or database required.",
  accentColor: "#191919",
  favicon: "📝",
  techStack: [
    "Next.js 16",
    "React 19",
    "TypeScript",
    "Zustand",
    "Tailwind CSS 4",
    "dnd-kit",
    "IndexedDB",
    "Vitest",
    "React Testing Library",
  ],
  needsDatabase: false,
  deepLinks: [
    {
      path: "/",
      title: "Notion — the connected workspace",
      snippet:
        "Marketing landing page with a sticky mega-menu nav, animated rotating-word hero, sticker rail, logo marquee, feature sections, testimonials and a stats marquee.",
      keywords: ["notion landing page", "notion marketing site", "notion homepage"],
    },
    {
      path: "/workspace",
      title: "Workspace — Notion",
      snippet:
        "The product itself: a resizable sidebar with a nested page tree, favorites, trash, and a block editor with 15 block types, slash menu, and markdown shortcuts.",
      keywords: ["notion workspace", "notion app", "notion sidebar", "notion editor"],
    },
    {
      path: "/workspace/page-roadmap",
      title: "Product roadmap — Notion",
      snippet:
        "A demo page with a gradient cover and emoji icon showing an inline database that breaks out to full page width.",
      keywords: ["notion roadmap", "notion page example", "notion database"],
    },
    {
      path: "/workspace/page-engineering",
      title: "Engineering handbook — Notion",
      snippet:
        "A nested demo page demonstrating the block editor's headings, callouts, toggles and code blocks.",
      keywords: ["notion engineering handbook", "notion docs", "notion nested pages"],
    },
    {
      path: "/workspace/page-meeting-notes",
      title: "Weekly sync — Notion",
      snippet:
        "A meeting-notes page with a nested child page, showing the page tree's drag-to-reorder and breadcrumb navigation.",
      keywords: ["notion meeting notes", "notion child pages", "notion breadcrumbs"],
    },
    {
      path: "/pricing",
      title: "Pricing — Notion",
      snippet: "The pricing page from the marketing site, part of the notion.com replica.",
      keywords: ["notion pricing", "notion plans", "notion cost"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "notion clone",
    "notion replica",
    "block editor",
    "notion database views",
    "kanban board app",
    "notion workspace app",
  ],
  knowledgePanel: {
    type: "Web application",
    facts: {
      "Built by":
        "A team of coding agents in a single session (research → foundation → parallel build → review)",
      Persistence: "IndexedDB by default, no environment variables and no database required",
      "Test suite": "147 tests via Vitest + React Testing Library, roughly two seconds",
      "Block types": "15 editable block types, 13 Notion property types across 4 database views",
      "Design source":
        "Colour palette extracted directly from Notion's own shipped CSS custom properties",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
