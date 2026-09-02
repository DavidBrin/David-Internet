/**
 * Aho-Corasick from scratch, for the /demos/earlycode automaton widget.
 *
 * The CSE 100 notebook builds its automaton with the pyahocorasick library
 * (and counts 106 nodes for the Fast & Furious title list); this file is the
 * page's own implementation of what that library call hides: the trie, the
 * BFS failure links, the dictionary-suffix (output) links, and the scan.
 * Fixture-tested against a pure-Python reference in tests/earlycode-core.test.ts.
 *
 * Match semantics mirror pyahocorasick's iterator: tuples (endIndex, pattern)
 * emitted as the scan passes each end position; at one position, the deepest
 * (longest) pattern first, then up the dictionary-suffix chain.
 */

export interface AhoNode {
  id: number;
  /** Parent node id (-1 for root). */
  parent: number;
  /** Edge character from the parent ("" for root). */
  ch: string;
  depth: number;
  children: Record<string, number>;
  /** Failure link (root points to itself). */
  fail: number;
  /** Dictionary-suffix link: nearest proper-suffix node that ends a pattern, or -1. */
  dict: number;
  /** The pattern that ends here, if any. */
  word: string | null;
}

export interface Automaton {
  nodes: AhoNode[];
  patterns: string[];
  /** BFS order in which failure links were computed (for the build animation). */
  bfsOrder: number[];
}

export function buildTrie(patterns: string[]): AhoNode[] {
  const nodes: AhoNode[] = [
    { id: 0, parent: -1, ch: "", depth: 0, children: {}, fail: 0, dict: -1, word: null },
  ];
  for (const pattern of patterns) {
    let cur = 0;
    for (const ch of pattern) {
      let next = nodes[cur].children[ch];
      if (next === undefined) {
        next = nodes.length;
        nodes.push({
          id: next,
          parent: cur,
          ch,
          depth: nodes[cur].depth + 1,
          children: {},
          fail: 0,
          dict: -1,
          word: null,
        });
        nodes[cur].children[ch] = next;
      }
      cur = next;
    }
    nodes[cur].word = pattern;
  }
  return nodes;
}

/** Compute failure + dictionary-suffix links (BFS); returns the visit order. */
export function computeFailures(nodes: AhoNode[]): number[] {
  const order: number[] = [];
  const queue: number[] = [];
  for (const childId of Object.values(nodes[0].children)) {
    nodes[childId].fail = 0;
    queue.push(childId);
  }
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    const node = nodes[id];
    for (const [ch, childId] of Object.entries(node.children)) {
      // walk the fail chain to find the deepest proper suffix with this edge
      let f = node.fail;
      while (f !== 0 && nodes[f].children[ch] === undefined) f = nodes[f].fail;
      const target = nodes[f].children[ch];
      nodes[childId].fail = target !== undefined && target !== childId ? target : 0;
      queue.push(childId);
    }
    const failNode = nodes[node.fail];
    node.dict = failNode.word !== null ? failNode.id : failNode.dict;
  }
  return order;
}

export function buildAutomaton(patterns: string[]): Automaton {
  const nodes = buildTrie(patterns);
  const bfsOrder = computeFailures(nodes);
  return { nodes, patterns: [...patterns], bfsOrder };
}

export interface Emit {
  /** 0-based index of the pattern's LAST character in the text (pyahocorasick convention). */
  end: number;
  pattern: string;
}

/** One scan step: consume `ch` from `state`, returning the new state + emits. */
export function stepMatch(
  a: Automaton,
  state: number,
  ch: string,
  position: number,
): { state: number; emits: Emit[]; failJumps: number[] } {
  const failJumps: number[] = [];
  let s = state;
  while (s !== 0 && a.nodes[s].children[ch] === undefined) {
    s = a.nodes[s].fail;
    failJumps.push(s);
  }
  s = a.nodes[s].children[ch] ?? 0;
  const emits: Emit[] = [];
  let d = a.nodes[s].word !== null ? s : a.nodes[s].dict;
  while (d !== -1 && d !== 0) {
    const w = a.nodes[d].word;
    if (w !== null) emits.push({ end: position, pattern: w });
    d = a.nodes[d].dict;
  }
  return { state: s, emits, failJumps };
}

/** Full scan of `text`, pyahocorasick-iter-style tuples. */
export function match(a: Automaton, text: string): Emit[] {
  const out: Emit[] = [];
  let state = 0;
  for (let i = 0; i < text.length; i++) {
    const r = stepMatch(a, state, text[i], i);
    state = r.state;
    out.push(...r.emits);
  }
  return out;
}

/** Node count, including the root — the notebook's automaton counted 106. */
export function nodeCount(a: Automaton): number {
  return a.nodes.length;
}

/** The notebook's pattern list (Fast & Furious titles, typos preserved). */
export const NOTEBOOK_PATTERNS = [
  "TheFastAndTheFurious",
  "2Fast2Furious",
  "TheFastAndTheFuriousTokyoDpift",
  "FastAndFurious",
  "FastFive",
  "FastAndFurious6",
  "Furious7",
  "TheFateOfTheFurious",
  "FastAndFuriousPresentshobbsAndShaw",
  "F9",
  "FastX",
];
