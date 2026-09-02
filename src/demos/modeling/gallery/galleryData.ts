/**
 * Static captions and layout metadata for the Inventor gallery. The feature
 * stories are inferred from the archived part filenames (the page says so in
 * its corner note) - phrasing kept close to the source notes.
 */

export interface GroupMeta {
  key: string;
  title: string;
  caption: string;
}

/** Grid order (also the JSON's own group order). */
export const GROUP_META: GroupMeta[] = [
  {
    key: "goldberg",
    title: "Goldberg machine",
    caption:
      "Goldberg Assembly.iam - 11 parts: ball ramps, a sphere, dominoes + domino ramp, a red cup, a table. The big assembly project.",
  },
  {
    key: "glider",
    title: "Glider",
    caption:
      "Glider Box.ipt - extrude, shell, airfoil-profile wings; plus the manufacturing drawing (three views, title block signed 'david', 1/26/2021).",
  },
  {
    key: "gears-simple",
    title: "Simple gear chain",
    caption: "Gear chain.iam - spur gears meshed on a pegboard.",
  },
  {
    key: "gears-complex",
    title: "Complex gear chain",
    caption:
      "Gear chain.iam - spur gears meshed on a pegboard; the complex chain adds ratios.",
  },
  {
    key: "space-crush",
    title: "Space Crush",
    caption:
      "Space Crush.iam - a box crusher: aluminum 2x2x6 box, clamp, crusher frame.",
  },
  {
    key: "space-launch",
    title: "Space Launch",
    caption: "gears + rail - the launch contraption study.",
  },
  {
    key: "sketch",
    title: "Basic Sketch",
    caption:
      "Basic Sketch.ipt - the constraint vocabulary: polygons, ellipse, spline, every dimension pinned.",
  },
];

/**
 * The green pegboard gear in renders/gears-simple-1.webp (1200x553), read off
 * the actual image with the Read tool: center ~(804, 293)px, radius ~150px.
 * Expressed as fractions of the image's own intrinsic box (0..1), so they are
 * independent of any letterboxing done by the card's fixed-aspect frame.
 */
export const GEAR_OVERLAY = {
  cxFrac: 0.67,
  cyFrac: 0.529,
  rFrac: 0.125, // radius as a fraction of the image's own intrinsic width
  imageAspect: 1200 / 553, // gears-simple-1.webp intrinsic size
};

/** Fixed aspect ratio (w/h) used for every card's photo frame. */
export const CARD_ASPECT = 4 / 3;

export interface CircleOverlayGeometry {
  /** Center x, as a percent of the card's photo frame width. */
  cx: number;
  /** Center y, as a percent of the card's photo frame height. */
  cy: number;
  /** Diameter, as a percent of the card's photo frame width. */
  dw: number;
  /** Diameter, as a percent of the card's photo frame height. */
  dh: number;
}

/**
 * Maps a circle defined in an image's own intrinsic-pixel fractions onto a
 * fixed-aspect card frame that shows that image with object-fit: contain
 * (i.e. accounts for whatever letterboxing contain introduces). Pure ratio
 * math, so it stays correct at any card size as long as the card frame keeps
 * `cardAspect`.
 */
export function computeCircleOverlay(
  imageAspect: number,
  cardAspect: number,
  cxFrac: number,
  cyFrac: number,
  rFrac: number
): CircleOverlayGeometry {
  if (imageAspect >= cardAspect) {
    // Width-constrained: image fills the frame's full width, letterboxed top/bottom.
    const displayedHeightFrac = cardAspect / imageAspect;
    const topOffset = (1 - displayedHeightFrac) / 2;
    return {
      cx: cxFrac * 100,
      cy: (topOffset + cyFrac * displayedHeightFrac) * 100,
      dw: rFrac * 2 * 100,
      dh: rFrac * 2 * cardAspect * 100,
    };
  }
  // Height-constrained: image fills the frame's full height, letterboxed left/right.
  const displayedWidthFrac = imageAspect / cardAspect;
  const leftOffset = (1 - displayedWidthFrac) / 2;
  const rFracOfImageHeight = rFrac * imageAspect;
  return {
    cx: (leftOffset + cxFrac * displayedWidthFrac) * 100,
    cy: cyFrac * 100,
    dw: ((2 * rFracOfImageHeight) / cardAspect) * 100,
    dh: rFracOfImageHeight * 2 * 100,
  };
}

export interface SpinnerLayerStyle {
  widthPct: number;
  heightPct: number;
  leftPct: number;
  topPct: number;
}

/**
 * Given the porthole circle's geometry (all in percent of the card frame),
 * returns the size/position (percent of the porthole div itself) for a
 * second copy of the full image placed inside that porthole so its content
 * lines up pixel-for-pixel with the base image. Spin the returned element
 * with transform-origin `${geom.cx}% ${geom.cy}%` (also frame-relative,
 * which is valid here because that element's own box equals the frame size).
 */
export function computeSpinnerLayer(geom: CircleOverlayGeometry): SpinnerLayerStyle {
  const frameLeft = geom.cx - geom.dw / 2;
  const frameTop = geom.cy - geom.dh / 2;
  return {
    widthPct: (100 / geom.dw) * 100,
    heightPct: (100 / geom.dh) * 100,
    leftPct: -(frameLeft / geom.dw) * 100,
    topPct: -(frameTop / geom.dh) * 100,
  };
}
