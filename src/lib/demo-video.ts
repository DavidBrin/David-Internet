/**
 * The 23-second demo video of this site, hosted on the YouTube replica.
 *
 * It is seeded there by `pnpm seed:demo` in Replicates/youtube under the key
 * `davids-internet-demo`; the video id is derived from that key, so the URL is
 * stable across re-seeds. Rendered from brag-output/ (git-ignored) with /brag.
 */
export const DEMO_VIDEO_WATCH_PATH = "/watch?v=vhgG-DQ4d6j";
export const DEMO_VIDEO_URL = `https://youtube-david.vercel.app${DEMO_VIDEO_WATCH_PATH}`;
export const DEMO_VIDEO_POSTER = "/media/davids-internet-demo.jpg";
export const DEMO_VIDEO_DURATION = "0:23";
