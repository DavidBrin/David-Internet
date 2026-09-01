/**
 * Pure helpers for AprioriCard: shaping the live getFrequentItemsets/calculateLift
 * output (from ../core/apriori) into render-ready rows. No state, no fetching.
 */

export interface BasketsJson {
  items: string[];
  baskets: number[][];
  note: string;
}

export interface ItemCountRow {
  item: number;
  name: string;
  count: number;
}

/** Top-N items by raw basket count (unfiltered by support). */
export function topItemCounts(itemCounts: Map<number, number>, items: string[], n: number): ItemCountRow[] {
  return [...itemCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item, count]) => ({ item, name: items[item] ?? `#${item}`, count }));
}

export interface PairRow {
  a: number;
  b: number;
  nameA: string;
  nameB: string;
  count: number;
  lift: number;
}

/** Top-N frequent pairs by count, joined with names + lift. */
export function pairRows(
  frequentPairs: Map<number, number>,
  lift: Map<number, number>,
  items: string[],
  unpairKey: (k: number) => [number, number],
  n: number
): PairRow[] {
  return [...frequentPairs.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, n)
    .map(([k, count]) => {
      const [a, b] = unpairKey(k);
      return { a, b, nameA: items[a] ?? `#${a}`, nameB: items[b] ?? `#${b}`, count, lift: lift.get(k) ?? 0 };
    });
}

export interface ScatterPoint {
  count: number;
  lift: number;
}

/** count/lift for every frequent pair (for the scatter). */
export function scatterPoints(frequentPairs: Map<number, number>, lift: Map<number, number>): ScatterPoint[] {
  return [...frequentPairs.entries()].map(([k, count]) => ({ count, lift: lift.get(k) ?? 0 }));
}
