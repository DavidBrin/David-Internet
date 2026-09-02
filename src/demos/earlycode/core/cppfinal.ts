/**
 * TS port of the 2021 C++ final (demos/cpp_2021_raw/final/main.cpp) for the
 * /demos/earlycode fake terminal. Quirks preserved on purpose and stated on
 * the page:
 *  - the first line of the file is skipped entirely (the original's getline
 *    swallows the "Numbers" header),
 *  - numbers above the chosen max are read but not tallied (they still count
 *    toward the file total),
 *  - if every count is zero, "most frequent" reports number 0 (highestCount
 *    starts at 0 and never updates) while "least frequent" reports 1 - the
 *    original's exact behavior.
 * Fixture-tested against a Python replica run over the shipped files.
 */

export interface ParsedFile {
  /** Whitespace-separated integers after the skipped header line. */
  numbers: number[];
  headerLine: string;
}

export function parseNumbersFile(text: string): ParsedFile {
  const nl = text.indexOf("\n");
  const headerLine = nl === -1 ? text : text.slice(0, nl);
  const rest = nl === -1 ? "" : text.slice(nl + 1);
  const numbers: number[] = [];
  for (const tok of rest.split(/\s+/)) {
    if (!tok) continue;
    const v = Number.parseInt(tok, 10);
    if (!Number.isNaN(v)) numbers.push(v);
  }
  return { numbers, headerLine };
}

export interface TallyResult {
  /** occurrences[i] = count of number i+1, exactly like the C++ array. */
  occurrences: number[];
  /** Count of ALL numbers read (readNumbersAndTallyOccurrences' return). */
  total: number;
}

export function tallyOccurrences(numbers: readonly number[], size: number): TallyResult {
  const occurrences = new Array<number>(size).fill(0);
  let total = 0;
  for (const n of numbers) {
    if (n >= 1 && n <= size) occurrences[n - 1]++;
    total++;
  }
  return { occurrences, total };
}

export interface MostLeast {
  /** The NUMBER (1-based) with the highest count; 0 when every count is 0 (original quirk). */
  highest: number;
  /** The NUMBER with the lowest count; first minimum wins. */
  lowest: number;
}

export function findMostAndLeastOccurrence(occurrences: readonly number[]): MostLeast {
  let current1 = 0;
  let current2 = 99999999;
  let highest = 0;
  let lowest = 0;
  for (let ind = 0; ind < occurrences.length; ind++) {
    if (occurrences[ind] > current1) {
      current1 = occurrences[ind];
      highest = ind + 1;
    }
    if (occurrences[ind] < current2) {
      current2 = occurrences[ind];
      lowest = ind + 1;
    }
  }
  return { highest, lowest };
}

export function findTotalOccurrenceCount(occurrences: readonly number[]): number {
  return occurrences.reduce((a, b) => a + b, 0);
}

export interface FinalRun {
  total: number;
  occurrences: number[];
  inRange: number;
  highest: number;
  lowest: number;
  /** True when the file had no numbers at all ("File does not have any numbers"). */
  empty: boolean;
}

/** The whole program for one (file, max) pair. */
export function runFinal(fileText: string, inputMax: number): FinalRun {
  const { numbers } = parseNumbersFile(fileText);
  const { occurrences, total } = tallyOccurrences(numbers, inputMax);
  if (total === 0) {
    return { total, occurrences, inRange: 0, highest: 0, lowest: 0, empty: true };
  }
  const { highest, lowest } = findMostAndLeastOccurrence(occurrences);
  return {
    total,
    occurrences,
    inRange: findTotalOccurrenceCount(occurrences),
    highest,
    lowest,
    empty: false,
  };
}
