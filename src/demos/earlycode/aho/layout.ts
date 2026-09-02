/**
 * Tree-layout + read-only helpers for the automaton canvas. These only READ
 * the structure aho.ts already built (children map, parent chain) — no
 * failure-link or matching logic lives here.
 */
import type { AhoNode, Automaton } from "../core/aho";

/**
 * Row assignment for a left-to-right tree drawing: leaves get sequential
 * integer rows (in DFS / alphabetical-child order), internal nodes sit at
 * the average row of their children. Depth (already on the node) is the x
 * axis; this function only produces the y axis. Trees never overlap this
 * way because each subtree's leaves occupy a contiguous row range.
 */
export function computeTreeRows(nodes: AhoNode[]): Float64Array {
  const rows = new Float64Array(nodes.length);
  let nextLeafRow = 0;

  function sortedChildren(id: number): number[] {
    const children = nodes[id].children;
    return Object.keys(children)
      .sort()
      .map((ch) => children[ch]);
  }

  // iterative post-order to stay safe for deep patterns without recursion limits
  const stack: Array<{ id: number; kids: number[]; idx: number; sum: number }> = [
    { id: 0, kids: sortedChildren(0), idx: 0, sum: 0 },
  ];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.kids.length === 0) {
      rows[frame.id] = nextLeafRow;
      nextLeafRow += 1;
      stack.pop();
      if (stack.length > 0) stack[stack.length - 1].sum += rows[frame.id];
      continue;
    }
    if (frame.idx < frame.kids.length) {
      const childId = frame.kids[frame.idx];
      frame.idx += 1;
      stack.push({ id: childId, kids: sortedChildren(childId), idx: 0, sum: 0 });
      continue;
    }
    rows[frame.id] = frame.sum / frame.kids.length;
    stack.pop();
    if (stack.length > 0) stack[stack.length - 1].sum += rows[frame.id];
  }
  return rows;
}

/** For each node, the index of the first pattern (in list order) whose insertion path touches it. Root gets -1. */
export function attributePatterns(automaton: Automaton): Int32Array {
  const attribution = new Int32Array(automaton.nodes.length).fill(-1);
  automaton.patterns.forEach((pattern, pIdx) => {
    let cur = 0;
    for (const ch of pattern) {
      const next = automaton.nodes[cur].children[ch];
      if (next === undefined) return;
      cur = next;
      if (attribution[cur] === -1) attribution[cur] = pIdx;
    }
  });
  return attribution;
}

/** Reconstruct the prefix string leading to `id` by walking parent links. */
export function prefixOf(nodes: AhoNode[], id: number): string {
  const chars: string[] = [];
  let cur = id;
  while (cur > 0) {
    chars.push(nodes[cur].ch);
    cur = nodes[cur].parent;
  }
  chars.reverse();
  return chars.join("");
}

/** Root-to-`id` path, root first. */
export function pathToRoot(nodes: AhoNode[], id: number): number[] {
  const path: number[] = [];
  let cur = id;
  for (;;) {
    path.push(cur);
    if (cur === 0) break;
    cur = nodes[cur].parent;
  }
  path.reverse();
  return path;
}
