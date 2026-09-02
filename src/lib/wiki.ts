/**
 * The Wikipedia replica — the user-facing encyclopedia over these projects.
 * Every project's repo documentation has a hand-written encyclopedia article
 * in Replicates/Wikipedia; docs links route there instead of to the vendored
 * README dumps. Slugs must match Replicates/Wikipedia src/content/projects.ts.
 */

/** Live deployment of the Wikipedia replica (no trailing slash). */
export const WIKIPEDIA_BASE_URL = "https://davids-wikipedia.vercel.app";

/** Fake display domain for wiki results, in the style of the manifests' fakeDomain. */
export const WIKIPEDIA_FAKE_DOMAIN = "wikipedia.davids.net";

/** Article slug per project slug. */
export const WIKI_SLUGS: Record<string, string> = {
  linear: "Linear_(replica)",
  notion: "Notion_(replica)",
  youtube: "YouTube_(replica)",
  "super-smash": "Super_Smash_(replica)",
  "fake-phone": "Fake_Phone",
  bet: "Bet_(app)",
  "dollar-pixels": "Dollar_Pixels",
  verilog: "Verilog",
  nocturnal: "Nocturnal_Neuro",
  signals: "Signals_and_Systems_Lab",
  quantum: "Quantum_Playground",
  hardhack: "HardHack_2026",
  esp32: "ESP32_Thermal_TinyML",
  organoids: "Organoids_on_Psychedelics",
  spikes: "Anatomy_of_a_Spike",
  vision: "Computer_Vision",
  arxiv: "ArXiv_Semantic_Graph",
  crossteach: "Cross-Teaching_Segmentation",
  p300: "P300_Speller",
  sql: "SQL_Playground",
  modeling: "Early_3D_Modeling",
  earlycode: "Early_Code",
};

/** true when the project has an encyclopedia article. */
export function hasWikiArticle(project: string): boolean {
  return project in WIKI_SLUGS;
}

/** Full URL of a project's encyclopedia article (base page if unmapped). */
export function wikiUrlFor(project: string): string {
  const slug = WIKI_SLUGS[project];
  return slug ? `${WIKIPEDIA_BASE_URL}/wiki/${slug}` : WIKIPEDIA_BASE_URL;
}

/** The article's display title, derived from its slug ("Super_Smash_(replica)" → "Super Smash (replica)"). */
export function wikiTitleFor(project: string): string | null {
  const slug = WIKI_SLUGS[project];
  return slug ? slug.replace(/_/g, " ") : null;
}
