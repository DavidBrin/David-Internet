import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "fake-phone",
  displayName: "fake-phone",
  fakeDomain: "fake-phone.davids.net",
  liveUrl: "https://fake-phone-david.vercel.app",
  tagline: "A staged incoming call, so you never feel alone.",
  description:
    "A personal-safety web app that opens directly into a ringing fake incoming call, with pixel-faithful iOS and Android call-screen replicas and a fake live-stream broadcast mode. Built research-first with three voice tiers (silent, scripted, and an AI tier that's fully wired but inert without an API key), it's designed as a deterrent and social cover, never as a prank or a way to contact emergency services.",
  accentColor: "#F59E0B",
  favicon: "📱",
  techStack: [
    "Next.js 16",
    "React 19",
    "TypeScript",
    "Tailwind CSS 4",
    "Zustand",
    "Zod",
    "Vitest",
    "Playwright",
    "Anthropic API (optional, server-side)",
  ],
  needsDatabase: false,
  deepLinks: [
    {
      path: "/",
      title: "fake-phone — Incoming Call",
      snippet:
        "Cold-boot lands you straight on a ringing incoming-call screen — no splash, no menu. Answer to start the fake call, or decline/end to reveal settings.",
      keywords: [
        "fake call",
        "incoming call",
        "iOS call screen",
        "android call screen",
        "fake incoming call app",
      ],
    },
    {
      path: "/home",
      title: "fake-phone — Home & Settings",
      snippet:
        "The only way in is by ending a call: configure caller name, photo, call skin, voice tier, persona, ring delay, and live-mode settings from here.",
      keywords: ["fake phone settings", "caller id settings", "personal safety app settings"],
    },
    {
      path: "/live",
      title: "fake-phone — Live Mode",
      snippet:
        "Puts your front camera on screen with a LIVE badge, rising viewer count, scrolling comments and floating hearts — implying many people are watching right now.",
      keywords: [
        "fake live stream",
        "fake instagram live",
        "fake broadcast",
        "live viewer count fake",
      ],
    },
  ],
  images: [
    {
      src: "/content/fake-phone/screenshots/ios-incoming.png",
      caption: "iOS incoming call, post-iOS-17 bottom-anchored button stack",
      targetPath: "/",
    },
    {
      src: "/content/fake-phone/screenshots/ios-in-call.png",
      caption: "iOS active call with mute engaged, frosted-glass control grid",
      targetPath: "/",
    },
    {
      src: "/content/fake-phone/screenshots/android-incoming.png",
      caption: "Android swipe-to-answer, Material 3 Expressive styling",
      targetPath: "/",
    },
    {
      src: "/content/fake-phone/screenshots/android-in-call.png",
      caption: "Android in-call screen with stadium-pill decline/end buttons",
      targetPath: "/",
    },
    {
      src: "/content/fake-phone/screenshots/home.png",
      caption: "Home / settings surface — dark, calm, amber accent",
      targetPath: "/home",
    },
    {
      src: "/content/fake-phone/screenshots/home-full.png",
      caption: "Full home/settings screen showing all configurable options",
      targetPath: "/home",
    },
    {
      src: "/content/fake-phone/screenshots/live-streaming.png",
      caption: "Live-stream mode with LIVE badge, viewer count and comment feed",
      targetPath: "/live",
    },
    {
      src: "/content/fake-phone/screenshots/live-primer.png",
      caption: "Live mode camera-permission primer screen",
      targetPath: "/live",
    },
    {
      src: "/content/fake-phone/screenshots/ring-countdown.png",
      caption: "Delayed-ring countdown state before the fake call begins",
      targetPath: "/",
    },
  ],
  videos: [],
  keywords: [
    "fake call app",
    "fake incoming call",
    "personal safety app",
    "fake phone call generator",
    "escape a bad date app",
    "fake live stream app",
    "iOS call screen replica",
    "android call screen replica",
    "safety deterrent app",
    "never feel alone",
  ],
  knowledgePanel: {
    type: "Web application",
    facts: {
      Category: "Personal-safety / de-escalation tool",
      "Voice tiers": "Silent, Scripted (default), AI (Anthropic-powered, inert without an API key)",
      Storage:
        "Fully client-side — all settings and photos saved to localStorage, no backend database",
      "App Store stance":
        "Deliberately avoids 'prank'/'joke' language and never simulates contact with emergency services",
      "Build approach":
        "One-shot, research-first build — six parallel research lanes followed by six parallel build slices against a frozen contract",
    },
  },
  docs: { readme: true, spec: true, decisions: true },
};

export default site;
