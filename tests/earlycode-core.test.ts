/**
 * The earlycode TS ports must reproduce the pure-Python references the prep
 * ran (fixture from `pnpm sync-demos earlycode`): the C++ final's tally logic
 * over the shipped numbers files (quirks preserved) and the from-scratch
 * Aho-Corasick automaton (trie size, match tuples) — including the headline
 * fact that the automaton has 106 nodes, exactly what the notebook's
 * pyahocorasick call reported.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NOTEBOOK_PATTERNS, buildAutomaton, match, nodeCount } from "@/demos/earlycode/core/aho";
import { runFinal } from "@/demos/earlycode/core/cppfinal";

const ROOT = path.join(__dirname, "..");

interface CppCase {
  file: string;
  max: number;
  total: number;
  occurrences: number[];
  inRange: number;
  highest: number;
  lowest: number;
  empty: boolean;
}
interface AhoFx {
  patterns: string[];
  nodeCount: number;
  notebookNodeCount: number;
  cases: { text: string; matches: [number, string][] }[];
}

const fx = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests", "fixtures", "earlycode-core.json"), "utf8"),
) as { cpp: CppCase[]; aho: AhoFx };

describe("cpp final port", () => {
  for (const c of fx.cpp) {
    it(`${c.file} max=${c.max}`, () => {
      const text = fs.readFileSync(
        path.join(ROOT, "public", "demos", "earlycode", "numbers", c.file),
        "utf8",
      );
      const r = runFinal(text, c.max);
      expect(r.total).toBe(c.total);
      expect(r.empty).toBe(c.empty);
      expect(r.occurrences).toEqual(c.occurrences);
      expect(r.inRange).toBe(c.inRange);
      expect(r.highest).toBe(c.highest);
      expect(r.lowest).toBe(c.lowest);
    });
  }
});

describe("aho-corasick port", () => {
  const automaton = buildAutomaton(fx.aho.patterns);

  it("patterns match the notebook's list", () => {
    expect(fx.aho.patterns).toEqual(NOTEBOOK_PATTERNS);
  });

  it(`has ${fx.aho.nodeCount} nodes — the notebook's pyahocorasick count`, () => {
    expect(nodeCount(automaton)).toBe(fx.aho.nodeCount);
    expect(fx.aho.nodeCount).toBe(fx.aho.notebookNodeCount);
  });

  for (const [i, c] of fx.aho.cases.entries()) {
    it(`case ${i}: "${c.text.slice(0, 30)}..."`, () => {
      const got = match(automaton, c.text).map((e) => [e.end, e.pattern]);
      expect(got).toEqual(c.matches);
    });
  }

  it("failure links exist and BFS order covers every non-root node", () => {
    expect(automaton.bfsOrder.length).toBe(automaton.nodes.length - 1);
    for (const n of automaton.nodes.slice(1)) {
      expect(n.fail).toBeGreaterThanOrEqual(0);
      expect(n.fail).not.toBe(n.id);
    }
  });
});
