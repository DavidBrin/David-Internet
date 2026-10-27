import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAllSearchDocs } from "@/lib/content.server";
import { getManifest } from "@/lib/manifests";
import { createEngine } from "@/lib/search";
import { WIKI_SLUGS, wikiTitleFor } from "@/lib/wiki";

const LIVE = "https://david-smash.leaders-game.workers.dev";

describe("David-Smash (the super-smash replica)", () => {
  it("is called David-Smash and links to its Cloudflare deployment", () => {
    const manifest = getManifest("super-smash");
    expect(manifest?.displayName).toBe("David-Smash");
    expect(manifest?.liveUrl).toBe(LIVE);
  });

  it("is still found by its old name", () => {
    const hits = createEngine(loadAllSearchDocs()).search("super smash");
    expect(hits.some((h) => h.doc.project === "super-smash")).toBe(true);
  });

  it("indexes the online lobby", () => {
    expect(getManifest("super-smash")?.deepLinks.some((l) => l.path === "/online")).toBe(true);
  });

  it("titles its wiki article David-Smash while keeping the old slug", () => {
    expect(WIKI_SLUGS["super-smash"]).toBe("Super_Smash_(replica)");
    expect(wikiTitleFor("super-smash")).toBe("David-Smash (replica)");
    expect(wikiTitleFor("linear")).toBe("Linear (replica)");
    const docs = loadAllSearchDocs().find((d) => d.id === "super-smash:docs");
    expect(docs?.title).toContain("David-Smash (replica)");
  });

  it("is labelled David-Smash on the journey", () => {
    const journey = fs.readFileSync(path.join(process.cwd(), "content", "path", "journey.ts"), "utf8");
    expect(journey).toContain('{ slug: "super-smash", label: "David-Smash", status: "docs" }');
  });
});
