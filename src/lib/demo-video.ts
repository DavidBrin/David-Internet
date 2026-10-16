/**
 * The site's demo videos, hosted on the YouTube replica.
 *
 * Both are seeded there by `pnpm seed:demo` in Replicates/youtube; each video
 * id is derived from its seed key, so the URLs are stable across re-seeds.
 * Rendered from the git-ignored brag-output directories with /brag.
 */

/** The 23-second demo of the site itself (seed key `davids-internet-demo`). */
export const DEMO_VIDEO_WATCH_PATH = "/watch?v=vhgG-DQ4d6j";
export const DEMO_VIDEO_URL = `https://youtube-david.vercel.app${DEMO_VIDEO_WATCH_PATH}`;
export const DEMO_VIDEO_POSTER = "/media/davids-internet-demo.jpg";
export const DEMO_VIDEO_DURATION = "0:23";

/**
 * The 24-second demo of the /demos page, featuring Cross-Teaching Segmentation,
 * Autonomous Car, Nocturnal Neuro and Quantum Playground (seed key
 * `davids-internet-demos`).
 */
export const DEMOS_VIDEO_WATCH_PATH = "/watch?v=GHSk3dRfPUD";
export const DEMOS_VIDEO_URL = `https://youtube-david.vercel.app${DEMOS_VIDEO_WATCH_PATH}`;
export const DEMOS_VIDEO_POSTER = "/media/davids-internet-demos.jpg";
export const DEMOS_VIDEO_DURATION = "0:24";
