/**
 * TS port of the p300-speller notebook's letter-decoding logic
 * (P300speller.ipynb, cells 21-29; see demos/p300_src/p300speller_extract.py).
 * Fixture-tested against the Python original in tests/p300-core.test.ts.
 *
 * Vocabulary: `stimulus` codes are the BCI Competition III StimulusCode values:
 * 1-6 = columns (left to right), 7-12 = rows (top to bottom). `predictions` are
 * per-flash classifier scores in flash order; one "epoch" in the notebook's
 * naming is one repetition of all 12 flashes.
 */

/** The 6x6 speller matrix, row-major: A-Z, 1-9, _. */
export const CHAR_SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789_";

/** listMatrix[i]: chars of column i (i=0..5) then row i-6 (i=6..11) — as in the notebook. */
export const LIST_MATRIX: string[][] = (() => {
  const out: string[][] = [];
  for (let i = 0; i < 6; i++) {
    const col: string[] = [];
    for (let j = i; j < 36; j += 6) col.push(CHAR_SET[j]);
    out.push(col);
  }
  for (let i = 0; i < 6; i++) {
    out.push(CHAR_SET.slice(i * 6, i * 6 + 6).split(""));
  }
  return out;
})();

/** Reorder one repetition's 12 flash scores into stimulus order 1..12. */
export function sortPredictions(pred: readonly number[], stim: readonly number[]): number[] {
  const sorted = new Array<number>(12).fill(0);
  for (let i = 0; i < 12; i++) sorted[stim[i] - 1] = pred[i];
  return sorted;
}

/** Mean of the per-repetition sorted score vectors over the first nEpoch repetitions. */
export function meanPredictions(
  predictions: readonly number[],
  stimulus: readonly number[],
  nEpoch: number,
): number[] {
  const acc = new Array<number>(12).fill(0);
  for (let epoch = 1; epoch <= nEpoch; epoch++) {
    const pred = predictions.slice(12 * (epoch - 1), 12 * epoch);
    const stim = stimulus.slice(12 * (epoch - 1), 12 * epoch);
    const sorted = sortPredictions(pred, stim);
    for (let i = 0; i < 12; i++) acc[i] += sorted[i];
  }
  return acc.map((v) => v / nEpoch);
}

/** Binarize: 1 for every entry equal to the max among columns (0-5) and among rows (6-11). */
export function roundArgmax(sorted: readonly number[]): number[] {
  const out = new Array<number>(12).fill(0);
  const colMax = Math.max(...sorted.slice(0, 6));
  const rowMax = Math.max(...sorted.slice(6, 12));
  for (let i = 0; i < 6; i++) if (sorted[i] === colMax) out[i] = 1;
  for (let i = 0; i < 6; i++) if (sorted[6 + i] === rowMax) out[6 + i] = 1;
  return out;
}

/** Intersection letter of stimulus codes x and y (one column + one row), else null. */
export function checkLetter(x: number, y: number): string | null {
  if ((x >= 1 && x <= 6 && y >= 1 && y <= 6) || (x >= 7 && x <= 12 && y >= 7 && y <= 12)) {
    return null;
  }
  const list1 = LIST_MATRIX[x - 1];
  const list2 = LIST_MATRIX[y - 1];
  for (const c of list1) if (list2.includes(c)) return c;
  return null;
}

/** All pairwise column-row intersection letters of the flagged stimulus codes. */
export function checkIntersect(listColrow: readonly number[]): string[] {
  const intersect: string[] = [];
  for (let x = 0; x < listColrow.length - 1; x++) {
    for (let y = x + 1; y < listColrow.length; y++) {
      const tmp = checkLetter(listColrow[x], listColrow[y]);
      if (tmp) intersect.push(tmp);
    }
  }
  return intersect;
}

/** Candidate letters from a binarized 12-vector (may be several when scores tie). */
export function charPredictions(rounded: readonly number[]): string[] {
  const listFlash: number[] = [];
  for (let i = 0; i < 12; i++) if (rounded[i] === 1) listFlash.push(i + 1);
  return checkIntersect(listFlash);
}

/**
 * Per-letter occurrence weights across repetitions (notebook defaults A=1, B=0:
 * each repetition's candidate letters share weight 1/len(candidates)).
 */
export function dictPredictions(
  predictions: readonly number[],
  stimulus: readonly number[],
  nEpoch: number,
  A = 1,
  B = 0,
): Map<string, number> {
  const dict = new Map<string, number>();
  for (let epoch = 1; epoch <= nEpoch; epoch++) {
    const pred = predictions.slice(12 * (epoch - 1), 12 * epoch);
    const stim = stimulus.slice(12 * (epoch - 1), 12 * epoch);
    const rounded = roundArgmax(sortPredictions(pred, stim));
    const listFlash: number[] = [];
    for (let i = 0; i < 12; i++) if (rounded[i] === 1) listFlash.push(i + 1);
    const intersect = checkIntersect(listFlash);
    for (const inter of intersect) {
      const add = A * (1 / intersect.length) + B * ((epoch + 1) / nEpoch);
      dict.set(inter, (dict.get(inter) ?? 0) + add);
    }
  }
  return dict;
}

/**
 * Break ties between candidate letters using the occurrence dict; `rand` in
 * [0,1) stands in for Python's random.choice. Returns null on no candidates
 * (the Python original would throw there; never reached with real scores).
 */
export function breakTies(
  wordPred: readonly string[],
  dictPred: Map<string, number>,
  rand: () => number = Math.random,
): string | null {
  if (wordPred.length === 0) return null;
  let maxOcc = 0;
  const letters: string[] = [];
  const results: string[] = [];
  for (const letter of wordPred) {
    if (dictPred.has(letter)) {
      letters.push(letter);
      const v = dictPred.get(letter)!;
      if (v > maxOcc) maxOcc = v;
    }
  }
  if (maxOcc > 0) {
    for (const letter of letters) {
      if (dictPred.get(letter) === maxOcc) results.push(letter);
    }
  }
  const pool = results.length ? results : (wordPred as string[]);
  return pool[Math.floor(rand() * pool.length)];
}

/** Full per-character decode: mean scores -> argmax -> candidates -> tie-break. */
export function decodeCharacter(
  predictions: readonly number[],
  stimulus: readonly number[],
  nEpoch: number,
  rand: () => number = Math.random,
): { letter: string | null; mean: number[]; rounded: number[]; candidates: string[] } {
  const mean = meanPredictions(predictions, stimulus, nEpoch);
  const rounded = roundArgmax(mean);
  const candidates = charPredictions(rounded);
  const dict = dictPredictions(predictions, stimulus, nEpoch);
  const letter = breakTies(candidates, dict, rand);
  return { letter, mean, rounded, candidates };
}
