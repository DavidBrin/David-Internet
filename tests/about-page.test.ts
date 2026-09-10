import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("About page demo count", () => {
  it("does not imply every selected project has a browser demo", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/about/page.tsx"), "utf8");

    expect(page).toContain("{demos.length} demos are playable in the browser");
    expect(page).not.toContain("{demos.length} of these are playable");
  });
});
