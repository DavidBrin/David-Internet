/**
 * The shipped VEX program listings must stay in sync with the raw archive:
 * the fixture records the listing line counts the prep parsed out of the
 * .vrblocks/.vrpython files (regenerate with `pnpm sync-demos modeling`).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(__dirname, "..");

interface ListingItem {
  d: number;
  t: string;
}
interface Program {
  id: string;
  title: string;
  kind: "blocks" | "python";
  playground: string;
  listing: ListingItem[];
  python?: string;
  reconstructed?: boolean;
}

const programs = (
  JSON.parse(
    fs.readFileSync(path.join(ROOT, "public", "demos", "modeling", "vex", "programs.json"), "utf8"),
  ) as { programs: Program[] }
).programs;
const fixture = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests", "fixtures", "modeling-vex.json"), "utf8"),
) as { listingCounts: Record<string, number> };

describe("modeling vex programs", () => {
  it("ships all six programs", () => {
    expect(programs.map((p) => p.id).sort()).toEqual(
      ["artcanvas", "dance", "experiment", "maze", "perimeter", "random"].sort(),
    );
  });

  for (const prog of programs) {
    it(`${prog.id} listing matches the fixture`, () => {
      expect(prog.listing.length).toBe(fixture.listingCounts[prog.id]);
      expect(prog.listing.length).toBeGreaterThan(5);
      for (const item of prog.listing) {
        expect(item.d).toBeGreaterThanOrEqual(0);
        // python listings keep their blank source lines; block listings never
        // produce an empty line
        if (prog.kind === "blocks") expect(item.t.length).toBeGreaterThan(0);
      }
    });
  }

  it("block programs parsed real structure (not just the start block)", () => {
    const maze = programs.find((p) => p.id === "maze")!;
    expect(maze.listing.length).toBeGreaterThan(20);
    expect(maze.listing.some((l) => l.d > 0)).toBe(true);
    expect(maze.listing[0].t).toContain("when started");
  });

  it("python programs carry their source text", () => {
    for (const id of ["artcanvas", "experiment"]) {
      const p = programs.find((x) => x.id === id)!;
      expect(p.kind).toBe("python");
      expect(p.python).toContain("def main():");
      expect(p.python).toContain("drivetrain");
    }
  });

  it("perimeter is labeled reconstructed", () => {
    expect(programs.find((p) => p.id === "perimeter")!.reconstructed).toBe(true);
  });
});
