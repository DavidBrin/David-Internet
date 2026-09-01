/**
 * SSD / NCC window matching — TS port of David's CSE 152A HW2 solution
 * (ssd_match, ncc_match, naive_matching), fixture-tested against the notebook's
 * own unit tests and real warrior-pair windows in tests/fixtures/vision-match.json.
 */
import type { Grid } from "./stereo";

/** Window centered at c = [x, y] with radius R; returns null if out of bounds. */
function inBounds(img: Grid, c: [number, number], R: number): boolean {
  return c[0] - R >= 0 && c[0] + R + 1 <= img.w && c[1] - R >= 0 && c[1] + R + 1 <= img.h;
}

export function ssdMatch(img1: Grid, img2: Grid, c1: [number, number], c2: [number, number], R: number): number {
  let acc = 0;
  for (let dy = -R; dy <= R; dy++) {
    const r1 = (c1[1] + dy) * img1.w + c1[0];
    const r2 = (c2[1] + dy) * img2.w + c2[0];
    for (let dx = -R; dx <= R; dx++) {
      const d = img1.data[r1 + dx] - img2.data[r2 + dx];
      acc += d * d;
    }
  }
  return acc;
}

export function nccMatch(img1: Grid, img2: Grid, c1: [number, number], c2: [number, number], R: number): number {
  const n = (2 * R + 1) * (2 * R + 1);
  let s1 = 0,
    s2 = 0;
  for (let dy = -R; dy <= R; dy++) {
    const r1 = (c1[1] + dy) * img1.w + c1[0];
    const r2 = (c2[1] + dy) * img2.w + c2[0];
    for (let dx = -R; dx <= R; dx++) {
      s1 += img1.data[r1 + dx];
      s2 += img2.data[r2 + dx];
    }
  }
  const a1 = s1 / n,
    a2 = s2 / n;
  let v1 = 0,
    v2 = 0,
    cov = 0;
  for (let dy = -R; dy <= R; dy++) {
    const r1 = (c1[1] + dy) * img1.w + c1[0];
    const r2 = (c2[1] + dy) * img2.w + c2[0];
    for (let dx = -R; dx <= R; dx++) {
      const d1 = img1.data[r1 + dx] - a1;
      const d2 = img2.data[r2 + dx] - a2;
      v1 += d1 * d1;
      v2 += d2 * d2;
      cov += d1 * d2;
    }
  }
  const std1 = Math.sqrt(v1 / n);
  const std2 = Math.sqrt(v2 / n);
  return cov / (std1 * std2) / n;
}

export interface MatchPair {
  c1: [number, number];
  c2: [number, number];
  ncc: number;
}

/** David's naive_matching: best NCC partner per left corner, thresholded. */
export function naiveMatching(
  img1: Grid,
  img2: Grid,
  corners1: [number, number][],
  corners2: [number, number][],
  R: number,
  nccTh: number
): MatchPair[] {
  const out: MatchPair[] = [];
  for (const c1 of corners1) {
    if (!inBounds(img1, c1, R)) continue;
    let best: [number, number] | null = null;
    let bestNcc = -1;
    for (const c2 of corners2) {
      if (!inBounds(img2, c2, R)) continue;
      const v = nccMatch(img1, img2, c1, c2, R);
      if (v > bestNcc) {
        bestNcc = v;
        best = c2;
      }
    }
    if (best && bestNcc >= nccTh) out.push({ c1, c2: best, ncc: bestNcc });
  }
  return out;
}

/**
 * Scan both matchers along a set of candidate centers in image 2 (e.g. samples
 * of an epipolar line) — the "SSD vs NCC race" primitive. Returns score arrays
 * (NaN where the window falls out of bounds) and each metric's best index.
 */
export function scanScores(
  img1: Grid,
  img2: Grid,
  c1: [number, number],
  candidates: [number, number][],
  R: number
): { ssd: number[]; ncc: number[]; bestSsd: number; bestNcc: number } {
  const ssd: number[] = [];
  const ncc: number[] = [];
  let bestSsd = -1,
    bestNcc = -1;
  for (let i = 0; i < candidates.length; i++) {
    const c2 = candidates[i];
    if (!inBounds(img1, c1, R) || !inBounds(img2, c2, R)) {
      ssd.push(NaN);
      ncc.push(NaN);
      continue;
    }
    const s = ssdMatch(img1, img2, c1, c2, R);
    const c = nccMatch(img1, img2, c1, c2, R);
    ssd.push(s);
    ncc.push(c);
    if (bestSsd < 0 || s < ssd[bestSsd]) bestSsd = i;
    if (bestNcc < 0 || c > ncc[bestNcc]) bestNcc = i;
  }
  return { ssd, ncc, bestSsd, bestNcc };
}
