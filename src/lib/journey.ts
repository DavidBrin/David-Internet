/**
 * Types for "The Path" — the river-journey page (/path).
 * Data lives in content/path/journey.ts (David-editable).
 * Kept out of types.ts because that file is a frozen contract.
 */

export type WaterMood = "trickle" | "stream" | "rapids" | "delta";
export type SceneLight = "dawn" | "day" | "dusk" | "night";

/** Which authored backdrop art a phase uses (see SceneBackdrop). */
export type SceneArt =
  | "sierra"
  | "meadow"
  | "suburb"
  | "ventures"
  | "campus"
  | "lab"
  | "braid"
  | "nordic"
  | "industrial"
  | "runup"
  | "sanfrancisco"
  | "delta"
  | "sea";

export interface SceneSpec {
  art: SceneArt;
  palette: { sky: string; skyLow: string; water: string; accent: string; ink: string };
  light: SceneLight;
  waterMood: WaterMood;
}

export interface PhaseMedia {
  src: string;
  alt: string;
  caption?: string;
  reveal?: "wash-sand" | "wash-paper" | "fade" | "none";
  /** No asset yet — render an empty "photo coming" frame. */
  placeholder?: boolean;
  /**
   * How the image sits in the 4:3 frame. Default "cover" crops to fill;
   * "contain" letterboxes the whole image (for wide slides/banners that
   * shouldn't be cropped) against a dark mat.
   */
  fit?: "cover" | "contain";
  /**
   * object-position for a cover crop (e.g. "50% 25%"), to keep the subject —
   * usually a face — in frame when a tall photo is cropped to the wide slot.
   */
  focus?: string;
}

/** A project demo placed on the river. In-progress ⇒ inert, un-rebuilt stone. */
export interface DemoRef {
  slug: string;
  label: string;
  status: "live" | "docs" | "in-progress";
  needsAssets?: boolean;
  /** Honest one-liner for a stone with nothing to click yet: what it was, why there's no demo. */
  note?: string;
  href?: string;
  /** Optional encyclopedia article, shown alongside a distinct demo link. */
  wikiHref?: string;
}

export interface BranchSpec {
  label: string;
  rejoins: boolean;
}

export type EffectKind =
  | "rain-birth"
  | "etch-anchor"
  | "wash-sand"
  | "wash-paper"
  | "bounce-demo"
  | "fork"
  | "delta-fan";

export interface JourneyPhase {
  id: string;
  title: string;
  period?: string;
  kicker?: string;
  /** PROVISIONAL story copy — David finalizes. */
  body: string;
  scene: SceneSpec;
  media: PhaseMedia[];
  effect?: EffectKind;
  branch?: BranchSpec;
  demos?: DemoRef[];
  links?: { label: string; href: string; external?: boolean }[];
}

/** Sand-etched aside that washes away. Source pool: "Daily Dose of Damn" export. */
export interface DisappearingMessage {
  text: string;
  /** true only for the desk-etched anchor line (it lingers instead of washing). */
  fixed?: boolean;
}

export interface Journey {
  hero: { title: string; subtitle: string; tagline: string };
  phases: JourneyPhase[];
  outro: { line: string; cta: { label: string; href: string } };
  messages: DisappearingMessage[];
}
