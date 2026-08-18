/**
 * Build-time content loader — content team owns this file. Server-only (uses fs).
 * FROZEN API: loadAllSearchDocs() is what pages call to get the full corpus.
 */
import fs from "node:fs";
import path from "node:path";
import type { SearchDoc, SiteManifest } from "./types";
import { resolveHref, displayUrlFor } from "./types";
import { manifests } from "./manifests";

/** Where `pnpm sync-content` drops the vendored markdown. */
const CONTENT_ROOT = path.join(process.cwd(), "content");

/** Hard cap on an indexed body so a 4k-line SPEC doesn't dominate the index. */
const MAX_BODY_CHARS = 5000;

/** Default (query-less) snippet length shown before buildSnippet() re-windows it. */
const SNIPPET_CHARS = 300;

/** About-page bio, also indexed as the "about" SearchDoc body. */
export const ABOUT_BODY = [
  "David Brin — San Diego, California. Co-founder of Katalyxt AI, an enterprise AI platform that translates fragmented business data and organizational context into AI-accessible insight.",
  "Raised a $200K pre-seed from NFX, KP Scout and Long Journey; reached $30K ARR in a one-month sprint with four industry design partners. Leads product and engineering across design, DevOps, cloud infrastructure, security, and ML / LLM / memory systems.",
  "B.S. Computer Engineering, UC San Diego (2026). Regents Scholar, 3.9 GPA, with an exchange semester at DTU covering Deep Learning, Quantum Information, Databases and Computational Data Science.",
  "Previously: embedded firmware in C for a camera driver and control system at General Atomics; neural-data pipelines for patch-clamp and multi-electrode-array recordings at UC San Diego's Voytek Lab; cohort lead at Berkeley Coding Academy.",
  "Projects: semi-supervised microtomography segmentation with a U-Net and ViT cross-teaching ensemble; an autonomous car on ROS 2 with onboard NVIDIA compute; an EEG-based bipolar-disorder diagnostic concept; drone PCB design in Altium.",
  "Skills: Python, C, C++, TypeScript, PyTorch, computer vision, embedded systems, Linux, ROS 2, Azure.",
  "This whole site is a tour of David's personal projects, dressed up as a search engine. Search for anything.",
  "Contact: david.e.brin@gmail.com",
].join("\n\n");

/** Read a vendored markdown file, or null if it wasn't vendored. */
function readDoc(project: string, file: string): string | null {
  const p = path.join(CONTENT_ROOT, project, file);
  try {
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/**
 * Flatten markdown into prose so search snippets read like sentences rather than
 * syntax: drop front matter, code fences, headings markers, emphasis, list bullets,
 * table pipes, and reduce links/images to their text.
 */
export function markdownToText(md: string): string {
  return md
    .replace(/^---\n[\s\S]*?\n---\n/, "") // YAML front matter
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ") // html comments
    .replace(/<[^>]+>/g, " ") // inline html tags
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images → alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → link text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // heading markers
    .replace(/^\s{0,3}>\s?/gm, "") // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "") // bullets
    .replace(/^\s*\d+\.\s+/gm, "") // ordered list markers
    .replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/gm, " ") // table rules
    .replace(/\|/g, " ") // table pipes
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/~~(.*?)~~/g, "$1") // strikethrough
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function capBody(text: string): string {
  if (text.length <= MAX_BODY_CHARS) return text;
  const cut = text.slice(0, MAX_BODY_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > MAX_BODY_CHARS * 0.8 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

function defaultSnippet(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= SNIPPET_CHARS) return flat;
  const cut = flat.slice(0, SNIPPET_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

function homeDoc(m: SiteManifest): SearchDoc {
  const body = capBody(
    [m.description, m.keywords.join(", "), `Built with ${m.techStack.join(", ")}.`].join("\n\n"),
  );
  return {
    id: `${m.project}:home`,
    project: m.project,
    kind: "home",
    title: `${m.displayName} — ${m.tagline}`,
    snippet: defaultSnippet(m.description),
    body,
    displayUrl: m.fakeDomain,
    href: resolveHref(m, "/"),
    keywords: [...m.keywords, m.displayName, m.project],
    favicon: m.favicon,
    accentColor: m.accentColor,
    external: !!m.liveUrl,
  };
}

function deepLinkDocs(m: SiteManifest): SearchDoc[] {
  return m.deepLinks.map((dl, i) => ({
    id: `${m.project}:deeplink:${i}`,
    project: m.project,
    kind: "deeplink" as const,
    title: dl.title,
    snippet: defaultSnippet(dl.snippet),
    body: capBody([dl.snippet, dl.keywords.join(", ")].join("\n\n")),
    displayUrl: displayUrlFor(m.fakeDomain, dl.path),
    href: resolveHref(m, dl.path),
    keywords: [...dl.keywords, ...m.keywords],
    favicon: m.favicon,
    accentColor: m.accentColor,
    external: !!m.liveUrl,
  }));
}

function markdownDoc(
  m: SiteManifest,
  kind: "docs" | "decisions",
  raw: string,
  extraRaw?: string | null,
): SearchDoc {
  const isDocs = kind === "docs";
  const text = markdownToText(extraRaw ? `${raw}\n\n${extraRaw}` : raw);
  return {
    id: `${m.project}:${kind}`,
    project: m.project,
    kind,
    title: `${m.displayName} — ${isDocs ? "Documentation" : "Design decisions"}`,
    snippet: defaultSnippet(text),
    body: capBody(text),
    displayUrl: `${m.fakeDomain} › ${isDocs ? "docs" : "decisions"}`,
    href: `/sites/${m.project}/${isDocs ? "docs" : "decisions"}`,
    keywords: [
      ...m.keywords,
      isDocs ? "documentation" : "decisions",
      isDocs ? "readme" : "design decisions",
      isDocs ? "spec" : "architecture",
      m.displayName,
    ],
    favicon: m.favicon,
    accentColor: m.accentColor,
    // Internal cached-copy pages always live on David's Internet.
    external: false,
  };
}

function aboutDoc(): SearchDoc {
  return {
    id: "about",
    project: null,
    kind: "about",
    title: "About David",
    snippet: defaultSnippet(ABOUT_BODY),
    body: capBody(ABOUT_BODY),
    displayUrl: "about.davids.net",
    href: "/about",
    keywords: [
      "david",
      "david brin",
      "about",
      "about david",
      "who is david",
      "resume",
      "cv",
      "bio",
      "contact",
      "katalyxt",
      "uc san diego",
      "computer engineering",
      "san diego",
      "portfolio",
    ],
    favicon: "👤",
    accentColor: "#4285F4",
    external: false,
  };
}

/**
 * Build the full SearchDoc corpus at build time:
 *  - one "home" doc per project (fake domain root → live URL or docs fallback)
 *  - one "deeplink" doc per manifest deep link
 *  - one "docs" / "decisions" doc per vendored markdown file (body = markdown text via fs)
 *  - one "about" doc for /about
 */
export function loadAllSearchDocs(): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const m of manifests) {
    docs.push(homeDoc(m));
    docs.push(...deepLinkDocs(m));

    const readme = readDoc(m.project, "README.md");
    if (readme) {
      // The docs page renders README + SPEC together, so index them together too.
      docs.push(markdownDoc(m, "docs", readme, readDoc(m.project, "SPEC.md")));
    }

    const decisions = readDoc(m.project, "DECISIONS.md");
    if (decisions) docs.push(markdownDoc(m, "decisions", decisions));
  }

  docs.push(aboutDoc());
  docs.push(howThisWorksDoc());
  return docs;
}

/** The footer's "How this works" explainer, indexed so it's findable by search too. */
function howThisWorksDoc(): SearchDoc {
  const body = [
    "David's Internet is a portfolio dressed up as a search engine. It looks like Google because, for this tiny parallel internet, it is Google: the front door to every website that exists here — and every one of them is a project David built from scratch.",
    "The index covers full-scale working replicas of real products — an issue tracker, a video platform, a block editor, a fighting game, a prediction market, and more — each rebuilt from the ground up. For every site it indexes the homepage, deep links, documentation, and design-decision logs.",
    "Results show a fake display URL but link to the real destination: the live deployment when a site is up, or its cached-copy documentation until then. Autocomplete, did-you-mean, and I'm Feeling Lucky all run against the same index, entirely in your browser.",
  ].join("\n\n");
  return {
    id: "how-this-works",
    project: null,
    kind: "about",
    title: "How this works — David's Internet",
    snippet: defaultSnippet(body),
    body,
    displayUrl: "davids.net › how-search-works",
    href: "/how-this-works",
    keywords: [
      "how this works",
      "how search works",
      "search engine",
      "david's internet",
      "portfolio",
      "what is this",
      "replicas",
    ],
    favicon: "🔍",
    accentColor: "#4285F4",
    external: false,
  };
}

/** Raw vendored markdown for a project doc, for the cached-copy pages. Null if absent. */
export function loadProjectMarkdown(
  project: string,
  file: "README.md" | "SPEC.md" | "DECISIONS.md",
): string | null {
  return readDoc(project, file);
}
