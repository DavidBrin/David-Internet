/**
 * Self-contained fixture corpus for the search/snippet/media unit tests.
 * Deliberately does NOT import from content/ or src/lib/manifests.ts — those are owned by
 * other teams and must not couple to these tests.
 */
import type { SearchDoc, SiteManifest } from "@/lib/types";
import { displayUrlFor, resolveHref } from "@/lib/types";

export const youtubeManifest: SiteManifest = {
  project: "youtube",
  displayName: "YouTube Replica",
  fakeDomain: "youtube.davids.net",
  liveUrl: "https://youtube-david.vercel.app",
  tagline: "A pixel-faithful YouTube clone",
  description: "Video streaming replica with a watch page, subscriptions feed and comments.",
  accentColor: "#ff0000",
  favicon: "📺",
  techStack: ["Next.js", "TypeScript", "Tailwind"],
  needsDatabase: true,
  deepLinks: [
    {
      path: "/watch",
      title: "Watch page",
      snippet: "The video player, description panel and recommendation rail.",
      keywords: ["watch", "player", "video"],
    },
    {
      path: "/subscriptions",
      title: "Subscriptions feed",
      snippet: "Channels you follow, newest uploads first.",
      keywords: ["subscriptions", "channels", "feed"],
    },
  ],
  images: [
    {
      src: "/content/youtube/screenshots/home.png",
      caption: "YouTube home feed with recommendation grid",
      targetPath: "/",
    },
    {
      src: "/content/youtube/screenshots/watch.png",
      caption: "Watch page with the video player and comments",
      targetPath: "/watch",
    },
  ],
  videos: [
    {
      src: "/content/youtube/clips/walkthrough.mp4",
      poster: "/content/youtube/clips/walkthrough.jpg",
      caption: "Walkthrough of the video player and playlist queue",
      targetPath: "/watch",
      duration: "0:42",
    },
  ],
  keywords: ["youtube", "video", "streaming", "player", "comments"],
  knowledgePanel: {
    type: "Web application",
    facts: { Built: "2025", Stack: "Next.js" },
  },
  docs: { readme: true, spec: true, decisions: true },
};

export const linearManifest: SiteManifest = {
  project: "linear",
  displayName: "Linear Replica",
  fakeDomain: "linear.davids.net",
  liveUrl: "https://linear-david.vercel.app",
  tagline: "Issue tracking, keyboard first",
  description: "A Linear clone with issues, cycles and a keyboard-driven command menu.",
  accentColor: "#5e6ad2",
  favicon: "📐",
  techStack: ["Next.js", "TypeScript", "Postgres"],
  needsDatabase: true,
  deepLinks: [
    {
      path: "/issues",
      title: "Issue list",
      snippet: "Grouped, filterable issue list with inline editing.",
      keywords: ["issues", "backlog", "triage"],
    },
  ],
  images: [
    {
      src: "/content/linear/screenshots/board.png",
      caption: "Kanban board grouped by workflow status",
      targetPath: "/issues",
    },
  ],
  videos: [
    {
      src: "/content/linear/clips/command-menu.mp4",
      caption: "Command menu keyboard navigation",
      targetPath: "/issues",
      duration: "0:18",
    },
  ],
  keywords: ["linear", "issues", "kanban", "tracker", "productivity"],
  docs: { readme: true, spec: true, decisions: false },
};

/** liveUrl === null → every href must fall back to the project's Wikipedia article. */
export const fakePhoneManifest: SiteManifest = {
  project: "fake-phone",
  displayName: "Fake Phone",
  fakeDomain: "fakephone.davids.net",
  liveUrl: null,
  tagline: "A prank call simulator",
  description: "An iOS-style phone that fakes an incoming call on a timer.",
  accentColor: "#34c759",
  favicon: "📱",
  techStack: ["React", "Vite"],
  needsDatabase: false,
  deepLinks: [
    {
      path: "/call",
      title: "Incoming call screen",
      snippet: "The lock-screen incoming call with accept and decline.",
      keywords: ["call", "ringtone", "lockscreen"],
    },
  ],
  images: [
    {
      src: "/content/fake-phone/screenshots/call.png",
      caption: "Incoming call lock screen on an iPhone frame",
      targetPath: "/call",
    },
  ],
  videos: [
    {
      src: "/content/fake-phone/clips/ring.mp4",
      caption: "Prank call ringing and decline animation",
      targetPath: "/call",
      duration: "0:09",
    },
  ],
  keywords: ["phone", "prank", "call", "ios"],
  docs: { readme: true, spec: false, decisions: false },
};

export const manifests: SiteManifest[] = [youtubeManifest, linearManifest, fakePhoneManifest];

function doc(partial: Omit<SearchDoc, "favicon" | "accentColor" | "external">, manifest: SiteManifest | null): SearchDoc {
  return {
    ...partial,
    favicon: manifest?.favicon ?? "🌐",
    accentColor: manifest?.accentColor ?? "#4285f4",
    external: Boolean(manifest?.liveUrl) && partial.href.startsWith("http"),
  };
}

export const docs: SearchDoc[] = [
  doc(
    {
      id: "youtube:home",
      project: "youtube",
      kind: "home",
      title: "YouTube Replica — David's Internet",
      snippet: "A pixel-faithful YouTube clone with a watch page, subscriptions and comments.",
      body:
        "YouTube Replica is a full video streaming front end rebuilt from scratch. The home feed renders a responsive recommendation grid, the watch page hosts the video player, and the subscriptions feed lists new uploads from every channel you follow. Comments, likes and playlist queueing all work against a Postgres backed API.",
      displayUrl: displayUrlFor(youtubeManifest.fakeDomain, "/"),
      href: resolveHref(youtubeManifest, "/"),
      keywords: ["youtube", "video", "streaming", "player"],
    },
    youtubeManifest,
  ),
  doc(
    {
      id: "youtube:watch",
      project: "youtube",
      kind: "deeplink",
      title: "Watch page — YouTube Replica",
      snippet: "The video player, description panel and recommendation rail.",
      body:
        "The watch page is the heart of the YouTube replica. A custom video player exposes scrubbing, playback speed and captions, while the description panel collapses long text. Below it a threaded comments list loads lazily and the recommendation rail suggests the next video.",
      displayUrl: displayUrlFor(youtubeManifest.fakeDomain, "/watch"),
      href: resolveHref(youtubeManifest, "/watch"),
      keywords: ["watch", "player", "video", "youtube"],
    },
    youtubeManifest,
  ),
  doc(
    {
      id: "youtube:subscriptions",
      project: "youtube",
      kind: "deeplink",
      title: "Subscriptions feed — YouTube Replica",
      snippet: "Channels you follow, newest uploads first.",
      body:
        "The subscriptions feed groups new uploads by channel and day. Each row shows the channel avatar, the upload age and a hover preview of the video thumbnail.",
      displayUrl: displayUrlFor(youtubeManifest.fakeDomain, "/subscriptions"),
      href: resolveHref(youtubeManifest, "/subscriptions"),
      keywords: ["subscriptions", "channels", "feed", "youtube"],
    },
    youtubeManifest,
  ),
  doc(
    {
      id: "youtube:docs",
      project: "youtube",
      kind: "docs",
      title: "README — YouTube Replica",
      snippet: "How the YouTube replica is built, run and deployed.",
      body:
        "Install dependencies, seed the database and run the dev server. The YouTube replica separates the player package from the feed package so the video component can be reused. Deployment runs on Vercel with a Postgres instance for comments.",
      displayUrl: displayUrlFor(youtubeManifest.fakeDomain, "/docs"),
      href: "/sites/youtube/docs",
      keywords: ["readme", "docs", "youtube", "setup"],
    },
    youtubeManifest,
  ),
  doc(
    {
      id: "youtube:decisions",
      project: "youtube",
      kind: "decisions",
      title: "Decisions — YouTube Replica",
      snippet: "Why the player is custom rather than an embed.",
      body:
        "Decision one: build the video player on the native media element instead of embedding an iframe, so the scrubber and captions can be styled. Decision two: keep the comments tree flat in the database and nest it at render time.",
      displayUrl: displayUrlFor(youtubeManifest.fakeDomain, "/decisions"),
      href: "/sites/youtube/decisions",
      keywords: ["decisions", "architecture", "youtube"],
    },
    youtubeManifest,
  ),
  doc(
    {
      id: "linear:home",
      project: "linear",
      kind: "home",
      title: "Linear Replica — David's Internet",
      snippet: "Issue tracking, keyboard first, with cycles and a command menu.",
      body:
        "Linear Replica rebuilds the issue tracker experience: a grouped issue list, drag and drop kanban board, cycles with burndown, and a command menu bound to every action. Keyboard navigation is the primary interface and the mouse is optional.",
      displayUrl: displayUrlFor(linearManifest.fakeDomain, "/"),
      href: resolveHref(linearManifest, "/"),
      keywords: ["linear", "issues", "kanban", "tracker"],
    },
    linearManifest,
  ),
  doc(
    {
      id: "linear:issues",
      project: "linear",
      kind: "deeplink",
      title: "Issue list — Linear Replica",
      snippet: "Grouped, filterable issue list with inline editing.",
      body:
        "The issue list groups by status, assignee or cycle. Inline editing lets you change priority without leaving the row, and the filter bar composes predicates that are serialised into the URL.",
      displayUrl: displayUrlFor(linearManifest.fakeDomain, "/issues"),
      href: resolveHref(linearManifest, "/issues"),
      keywords: ["issues", "backlog", "triage", "linear"],
    },
    linearManifest,
  ),
  doc(
    {
      id: "linear:docs",
      project: "linear",
      kind: "docs",
      title: "README — Linear Replica",
      snippet: "Running the Linear replica locally.",
      body:
        "The Linear replica needs Postgres for issues and cycles. Run the migrations, seed a workspace and start the dev server. Realtime updates use server sent events.",
      displayUrl: displayUrlFor(linearManifest.fakeDomain, "/docs"),
      href: "/sites/linear/docs",
      keywords: ["readme", "docs", "linear", "setup"],
    },
    linearManifest,
  ),
  doc(
    {
      id: "fake-phone:home",
      project: "fake-phone",
      kind: "home",
      title: "Fake Phone — David's Internet",
      snippet: "A prank call simulator with an iOS style lock screen.",
      body:
        "Fake Phone renders an iPhone frame and fires a convincing incoming call after a delay you choose. The ringtone, vibration pattern and caller identity are all configurable before you hand the phone over.",
      displayUrl: displayUrlFor(fakePhoneManifest.fakeDomain, "/"),
      href: resolveHref(fakePhoneManifest, "/"),
      keywords: ["phone", "prank", "call", "ios"],
    },
    fakePhoneManifest,
  ),
  doc(
    {
      id: "fake-phone:call",
      project: "fake-phone",
      kind: "deeplink",
      title: "Incoming call screen — Fake Phone",
      snippet: "The lock-screen incoming call with accept and decline.",
      body:
        "The incoming call screen mimics the iOS lock screen, with the slide to answer control, the caller photo and the decline button. A prank call can be scheduled from the home screen.",
      displayUrl: displayUrlFor(fakePhoneManifest.fakeDomain, "/call"),
      href: resolveHref(fakePhoneManifest, "/call"),
      keywords: ["call", "ringtone", "lockscreen", "phone"],
    },
    fakePhoneManifest,
  ),
  doc(
    {
      id: "about",
      project: null,
      kind: "about",
      title: "About David — David's Internet",
      snippet: "Who David is and why this portfolio looks like a search engine.",
      body:
        "David builds product-shaped software: replicas of the tools he uses daily, shipped end to end. This portfolio is a search engine over those projects because a list of cards was never going to be memorable.",
      displayUrl: "davids.net › about",
      href: "/about",
      keywords: ["about", "david", "portfolio", "contact"],
    },
    null,
  ),
];
