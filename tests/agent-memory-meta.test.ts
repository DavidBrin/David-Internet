import { describe, expect, it } from "vitest";
import meta from "@/demos/agent-memory/meta";
import site from "@content/agent-memory/site";

describe("Agent Memory Timeline discovery metadata", () => {
  it("keeps the deterministic-trace and missing-feature disclosures discoverable", () => {
    expect(meta.slug).toBe("agent-memory");
    expect(meta.story.map((beat) => beat.body).join(" ")).toContain(
      "Memory OS v0 uses deterministic lexical candidate finding and a one-hop temporal entity index."
    );
    expect(meta.story.map((beat) => beat.body).join(" ")).toContain("does not yet use embeddings, a vector database");
  });

  it("attributes the seven Python files that define the replay", () => {
    expect(meta.sources.map((source) => source.name)).toEqual([
      "demo.py",
      "trace_export.py",
      "write_gate.py",
      "retrieval.py",
      "graph.py",
      "schema.py",
      "textutil.py",
    ]);
    expect(meta.sources.every((source) => source.path.startsWith("demos/agent_memory_raw/"))).toBe(true);
  });

  it("describes an internal static demo with its three timeline anchors", () => {
    expect(site).toMatchObject({
      project: "agent-memory",
      kind: "demo",
      liveUrl: "/demos/agent-memory",
      fakeDomain: "memory.davids.net",
      accentColor: "#475569",
      favicon: "🗃️",
      techStack: ["Python", "TypeScript", "React", "SVG", "JSON", "static export"],
    });
    expect(site.deepLinks.map((link) => link.path)).toEqual([
      "#rag-baseline",
      "#temporal-memory",
      "#context-graph-retrieval",
    ]);
  });
});
