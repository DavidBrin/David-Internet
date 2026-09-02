/**
 * /demos/<slug> — one statically generated page per registered demo.
 * Reads the Source-drawer files from disk and highlights them at build time.
 */
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demos, getDemo } from "@/lib/demos";
import { getManifest } from "@/lib/manifests";
import { highlight } from "@/components/demo/CodeBlock";
import DemoLayout from "@/components/demo/DemoLayout";
import DemoStage from "@/components/demo/DemoStage";
import type { SourceTab } from "@/components/demo/SourceDrawer";
import "../demos.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return demos.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const manifest = getManifest(slug);
  if (!manifest) return { title: "Not found - David's Internet" };
  return {
    title: `${manifest.displayName} - ${manifest.tagline}`,
    description: manifest.description,
  };
}

async function loadSources(slug: string): Promise<SourceTab[]> {
  const meta = getDemo(slug);
  if (!meta) return [];
  const tabs: SourceTab[] = [];
  for (const src of meta.sources) {
    const abs = path.join(process.cwd(), src.path);
    let code: string;
    try {
      code = fs.readFileSync(abs, "utf8");
    } catch {
      code = `// ${src.path} not found at build time`;
    }
    code = code.replace(/\r\n/g, "\n");
    tabs.push({
      name: src.name,
      note: src.note,
      html: await highlight(code, src.lang),
      lines: code.split("\n").length,
    });
  }
  return tabs;
}

export default async function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const manifest = getManifest(slug);
  const meta = getDemo(slug);
  if (!manifest || !meta) notFound();
  const sources = await loadSources(slug);

  return (
    <DemoLayout manifest={manifest} meta={meta} sources={sources}>
      <DemoStage slug={slug} />
    </DemoLayout>
  );
}
