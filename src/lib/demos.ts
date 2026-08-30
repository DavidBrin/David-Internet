/**
 * Demo registry — metadata for every interactive demo page at /demos/<slug>.
 *
 * A demo = a SiteManifest (content/<slug>/site.ts, kind: "demo") + a DemoMeta here
 * (story beats, source files for the drawer) + a client Stage component registered in
 * src/components/demo/DemoStage.tsx. Specs live in demos/specs/NN_<slug>.md.
 *
 * Server-safe: no React, no fs. Source files are read at build by the page.
 */
import verilog from "@/demos/verilog/meta";
import nocturnal from "@/demos/nocturnal/meta";

/** One file shown in the Source drawer. `path` is relative to the repo root. */
export interface DemoSource {
  /** Tab label, e.g. "decoder.sv" */
  name: string;
  path: string;
  /** shiki language id: "verilog" | "typescript" | "python" | "cpp" | "java" | "matlab" | ... */
  lang: string;
  /** One-line note shown above the code (what it is / who wrote it). */
  note?: string;
}

/** One beat in the Story rail. */
export interface DemoStoryBeat {
  title: string;
  body: string;
  /** Optional stage anchor this beat points at, e.g. "#trellis". */
  anchor?: string;
}

export interface DemoMeta {
  slug: string;
  /** Three short chips under the title. */
  what: string;
  why: string;
  when: string;
  story: DemoStoryBeat[];
  sources: DemoSource[];
  /** Single attribution/footer line under the Source drawer. */
  sourceFooter?: string;
}

export const demos: DemoMeta[] = [verilog, nocturnal];

export function getDemo(slug: string): DemoMeta | undefined {
  return demos.find((d) => d.slug === slug);
}
