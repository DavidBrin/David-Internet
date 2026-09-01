/**
 * A-priori frequent-pair mining — TS port of David's course exercise
 * (A-priori_freqPairs.py: get_frequent_itemsets + calculate_lift), exact-matched
 * on the real groceries baskets in tests/fixtures/arxiv-apriori.json.
 *
 * Baskets are arrays of item indices (see public/demos/arxiv/baskets.json).
 */

export interface AprioriResult {
  /** per-item basket counts (all items, unfiltered) */
  itemCounts: Map<number, number>;
  /** items meeting min support */
  frequentItems: Set<number>;
  /** pair key = a * 100000 + b with a < b -> count */
  frequentPairs: Map<number, number>;
}

export const pairKey = (a: number, b: number): number => (a < b ? a * 100000 + b : b * 100000 + a);
export const unpairKey = (k: number): [number, number] => [Math.floor(k / 100000), k % 100000];

export function getFrequentItemsets(baskets: number[][], minSupport: number): AprioriResult {
  const itemCounts = new Map<number, number>();
  for (const basket of baskets) {
    for (const item of basket) itemCounts.set(item, (itemCounts.get(item) ?? 0) + 1);
  }
  const frequentItems = new Set<number>();
  for (const [item, c] of itemCounts) if (c >= minSupport) frequentItems.add(item);

  const pairCounts = new Map<number, number>();
  for (const basket of baskets) {
    const filtered = basket.filter((i) => frequentItems.has(i));
    for (let i = 0; i < filtered.length; i++) {
      for (let j = i + 1; j < filtered.length; j++) {
        const k = pairKey(filtered[i], filtered[j]);
        pairCounts.set(k, (pairCounts.get(k) ?? 0) + 1);
      }
    }
  }
  const frequentPairs = new Map<number, number>();
  for (const [k, c] of pairCounts) if (c >= minSupport) frequentPairs.set(k, c);
  return { itemCounts, frequentItems, frequentPairs };
}

/** Lift(A,B) = P(A and B) / (P(A) P(B)) — David's calculate_lift. */
export function calculateLift(
  itemCounts: Map<number, number>,
  frequentPairs: Map<number, number>,
  totalBaskets: number
): Map<number, number> {
  const lift = new Map<number, number>();
  for (const [k, pc] of frequentPairs) {
    const [a, b] = unpairKey(k);
    const pa = (itemCounts.get(a) ?? 0) / totalBaskets;
    const pb = (itemCounts.get(b) ?? 0) / totalBaskets;
    const pab = pc / totalBaskets;
    lift.set(k, pa * pb > 0 ? pab / (pa * pb) : 0);
  }
  return lift;
}
