import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "linear",
  displayName: "Linear",
  fakeDomain: "linear.davids.net",
  liveUrl: null,
  tagline:
    "The issue tracker, rebuilt from measurements — issues, projects and teams with real multi-user permissions.",
  description:
    "A from-scratch rebuild of Linear.app's core issue tracker: identifier-based issues, list/board views, projects, and teams, backed by a real four-role permission system (owner/admin/member/guest). It adds one feature Linear itself lacks — a per-team DAG tab that draws the full blocking-relation graph, including cross-team chains and cycles — built on Next.js 16 with PostgreSQL everywhere (PGlite locally, Neon in production).",
  accentColor: "#5E6AD2",
  favicon: "📋",
  techStack: [
    "Next.js 16 (App Router)",
    "React 19.2",
    "TypeScript (strict)",
    "Tailwind CSS v4",
    "PostgreSQL (PGlite WASM locally, Neon in production)",
    "Raw SQL, no ORM",
    "jose (JWT auth)",
    "Zustand",
    "Vitest",
    "Playwright",
  ],
  needsDatabase: true,
  deepLinks: [
    {
      path: "/",
      title: "Linear clone — marketing page",
      snippet:
        "The landing page for the rebuilt Linear, with sign-in as owner, admin, member or guest demo accounts.",
      keywords: ["linear clone", "issue tracker", "project management app"],
    },
    {
      path: "/demo",
      title: "Demo Workspace — Issues",
      snippet:
        "Grouped issue list with status glyphs, priority icons, labels and assignees, filtered and manually ordered.",
      keywords: ["issue list", "linear issues", "workspace dashboard"],
    },
    {
      path: "/demo/issue/ENG-123",
      title: "ENG-123 — Issue detail",
      snippet:
        "Full issue view: markdown description, workflow state, priority, assignee, sub-issues, relations, activity feed and threaded comments.",
      keywords: ["issue detail", "ticket view", "activity feed"],
    },
    {
      path: "/demo/team/eng/board",
      title: "Engineering team — Board",
      snippet:
        "Kanban-style board with columns from the current grouping, drag-to-reorder within columns.",
      keywords: ["kanban board", "team board", "linear board view"],
    },
    {
      path: "/demo/team/eng/dag",
      title: "Engineering team — Dependency graph (DAG)",
      snippet:
        "Blocking relations drawn as a directed graph across team boundaries, with cycles highlighted in red — a feature Linear itself does not offer.",
      keywords: ["dependency graph", "blocking issues", "DAG view", "cycle detection"],
    },
    {
      path: "/demo/projects",
      title: "Demo Workspace — Projects",
      snippet: "Project list with health, lead and progress across milestones and updates.",
      keywords: ["project list", "project health", "project tracking"],
    },
    {
      path: "/demo/settings/members",
      title: "Workspace members & roles",
      snippet:
        "Manage workspace members, roles and pending invitations; a guest or member without rights is refused outright rather than shown a read-only view.",
      keywords: ["team members", "permissions", "roles", "invitations"],
    },
    {
      path: "/demo/my-issues",
      title: "My Issues",
      snippet:
        "The signed-in user's assigned issues across every team and project they can see.",
      keywords: ["my issues", "assigned tickets"],
    },
  ],
  images: [
    {
      src: "/content/linear/screenshots/issue-list.png",
      caption: "Grouped issue list with status glyphs, priority icons, labels and assignees",
      targetPath: "/demo",
    },
    {
      src: "/content/linear/screenshots/issue-detail.png",
      caption: "Issue detail with properties rail, activity feed and threaded comments",
      targetPath: "/demo/issue/ENG-123",
    },
    {
      src: "/content/linear/screenshots/board.png",
      caption: "Board with columns from the current grouping",
      targetPath: "/demo/team/eng/board",
    },
    {
      src: "/content/linear/screenshots/projects.png",
      caption: "Project list with health, lead and progress",
      targetPath: "/demo/projects",
    },
    {
      src: "/content/linear/screenshots/members.png",
      caption: "Workspace members with roles and invitations",
      targetPath: "/demo/settings/members",
    },
    {
      src: "/content/linear/screenshots/marketing.png",
      caption: "Marketing / landing page",
      targetPath: "/",
    },
    {
      src: "/content/linear/screenshots/dag.png",
      caption:
        "Blocking relations drawn as a directed graph, blockers on the left pointing at what they block",
      targetPath: "/demo/team/eng/dag",
    },
    {
      src: "/content/linear/screenshots/command-palette.png",
      caption: "Keyboard-first command palette",
      targetPath: "/demo",
    },
  ],
  videos: [],
  keywords: [
    "linear clone",
    "issue tracker",
    "project management",
    "kanban board",
    "linear app replica",
    "dependency graph tool",
    "team permissions app",
    "next.js issue tracker",
  ],
  knowledgePanel: {
    type: "Web application",
    facts: {
      Tests: "1,559 unit tests + 23 e2e tests (none skipped)",
      Database:
        "PostgreSQL everywhere — PGlite (WASM) locally, Neon deployed — 25 tables",
      Permissions: "416-case authorization matrix, compiler-proven exhaustive via satisfies",
      "Research base": "9,095 lines across 6 parallel research lanes before any application code",
      "Unique feature":
        "Per-team DAG tab visualizing blocking relations across teams, including cycles — absent from real Linear",
    },
  },
  docs: { readme: true, spec: true, decisions: true },
};

export default site;
