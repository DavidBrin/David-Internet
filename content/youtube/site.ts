import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "youtube",
  displayName: "YouTube (Replica)",
  fakeDomain: "youtube.davids.net",
  liveUrl: "https://youtube-david.vercel.app",
  tagline: "the video platform, with the transcoding moved to the uploader",
  description:
    "A from-scratch rebuild of YouTube's core: upload, an adaptive HLS player, channels, subscriptions, playlists, threaded comments, search, a co-visitation recommender, watch history, Shorts, and audio-fingerprint Content ID. The architectural bet is that the uploader's browser encodes the entire rendition ladder before anything is sent, so the server never opens a codec and there is no transcode queue, worker pool, or backlog to manage.",
  accentColor: "#FF0000",
  favicon: "▶️",
  techStack: [
    "Next.js 16",
    "React 19",
    "TypeScript",
    "PGlite (Postgres 18.3 WASM) / Neon in production",
    "Cloudflare R2 (filesystem in dev)",
    "WebCodecs",
    "Hand-written fMP4 muxer and MP4 demuxer",
    "Hand-rolled HLS packager, parser, ABR player",
    "Zustand",
    "Zod",
    "jose (JWT sessions)",
    "Tailwind CSS",
    "Vitest + Playwright",
  ],
  needsDatabase: true,
  deepLinks: [
    {
      path: "/",
      title: "YouTube Replica - Home",
      snippet:
        "Home feed ordered by co-visitation recommendations first, then a view-count-ranked backfill pool, plus a Shorts shelf sorted newest first.",
      keywords: ["youtube home", "video feed", "watch videos"],
    },
    {
      path: "/watch",
      title: "Watch - YouTube Replica",
      snippet:
        "Adaptive HLS video player with a hand-rolled ABR buffer controller, threaded comments, reactions, and watch-history/resume tracking.",
      keywords: ["watch video", "video player", "hls player", "comments"],
    },
    {
      path: "/results",
      title: "Search Results - YouTube Replica",
      snippet:
        "Full-text search over videos and channels with filters and suggestions, backed by Postgres tsvector.",
      keywords: ["search videos", "video search", "find channel"],
    },
    {
      path: "/shorts",
      title: "Shorts - YouTube Replica",
      snippet: "Vertical short-form video shelf, ordered newest first regardless of view count.",
      keywords: ["shorts", "short videos", "vertical video"],
    },
    {
      path: "/studio/upload",
      title: "Upload Studio - YouTube Replica",
      snippet:
        "The real upload pipeline: your browser demuxes, decodes once, fans frames out to multiple VideoEncoders, muxes fMP4, and uploads an HLS ladder — the server never opens a codec.",
      keywords: ["upload video", "creator studio", "video encoder", "hls upload"],
    },
    {
      path: "/feed/subscriptions",
      title: "Subscriptions - YouTube Replica",
      snippet: "Videos from channels you subscribe to, requires signing in first.",
      keywords: ["subscriptions feed", "subscribed channels"],
    },
    {
      path: "/feed/history",
      title: "Watch History - YouTube Replica",
      snippet:
        "Chronological history of watched videos with a resume bar for in-progress views, groupable and clearable per session.",
      keywords: ["watch history", "continue watching", "resume video"],
    },
    {
      path: "/@opencinema",
      title: "Channel - YouTube Replica",
      snippet:
        "A channel page with tabs for videos, playlists, and about — e.g. the seeded Open Cinema channel at @opencinema.",
      keywords: ["channel page", "creator channel", "subscribe"],
    },
  ],
  images: [
    {
      src: "/content/youtube/screenshots/replica-home-1920.png",
      caption: "Home feed grid at 1920px, 3 columns of cards with the Shorts shelf up top",
      targetPath: "/",
    },
    {
      src: "/content/youtube/screenshots/replica-watch-1920.png",
      caption: "Watch page with the adaptive HLS player, description, and comments",
      targetPath: "/watch",
    },
  ],
  videos: [],
  keywords: [
    "youtube clone",
    "youtube replica",
    "video platform",
    "video upload",
    "hls video player",
    "webcodecs video encoder",
    "content id audio fingerprint",
    "co-visitation recommender",
    "watch history resume",
    "youtube shorts clone",
    "in-browser transcoding",
  ],
  knowledgePanel: {
    type: "Web application",
    facts: {
      Architecture:
        "Transcoding happens entirely in the uploader's browser via WebCodecs; the server only stores and serves opaque byte ranges",
      "Media pipeline":
        "Hand-written MP4 demuxer, fMP4 muxer, and HLS packager/parser/ABR — no ffmpeg.wasm, mp4box.js, hls.js, or mux.js",
      "Content ID":
        "Landmark audio fingerprinting (Wang, ISMIR 2003) with a derived match threshold of 250",
      Recommender: "Co-visitation algorithm after Davidson et al., RecSys 2010",
      Testing: "2,227 unit tests and 38 e2e specs; a 23-table Postgres schema",
    },
  },
  docs: { readme: true, spec: true, decisions: true },
};

export default site;
