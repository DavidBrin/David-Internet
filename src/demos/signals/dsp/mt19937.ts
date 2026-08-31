/**
 * MT19937 (mt19937ar) — the generator behind MATLAB's rng(seed,'twister') and NumPy's
 * RandomState(seed). random53() reproduces genrand_res53(), the exact double stream of
 * MATLAB's rand() and NumPy's random_sample().
 *
 * matlabRandperm(n, seed) reproduces MATLAB's rng(seed); randperm(n) for this lab:
 * [~, p] = sort(rand(1, n)) — verified against the decoded Lab 1 recording (the wrong
 * algorithm yields noise; this one yields speech). Tested against a NumPy fixture.
 */

const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

export class MT19937 {
  private mt = new Uint32Array(N);
  private mti = N + 1;

  constructor(seed: number) {
    this.mt[0] = seed >>> 0;
    for (let i = 1; i < N; i++) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      // 1812433253 * prev + i, in 32-bit arithmetic without precision loss
      const lo = (prev & 0xffff) * 1812433253;
      const hi = ((prev >>> 16) * 1812433253) & 0xffff;
      this.mt[i] = (((hi << 16) >>> 0) + lo + i) >>> 0;
    }
    this.mti = N;
  }

  /** Next 32-bit unsigned integer. */
  uint32(): number {
    let y: number;
    if (this.mti >= N) {
      const mt = this.mt;
      for (let k = 0; k < N - M; k++) {
        y = (mt[k] & UPPER_MASK) | (mt[k + 1] & LOWER_MASK);
        mt[k] = mt[k + M] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      for (let k = N - M; k < N - 1; k++) {
        y = (mt[k] & UPPER_MASK) | (mt[k + 1] & LOWER_MASK);
        mt[k] = mt[k + (M - N)] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      y = (mt[N - 1] & UPPER_MASK) | (mt[0] & LOWER_MASK);
      mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      this.mti = 0;
    }
    y = this.mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /** Next double in [0, 1) with 53-bit resolution (genrand_res53). */
  random53(): number {
    const a = this.uint32() >>> 5;
    const b = this.uint32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }
}

/** MATLAB rng(seed); randperm(n) → 0-based permutation p, so that Z = Y(perm) is z[i] = y[p[i]]. */
export function matlabRandperm(n: number, seed: number): Uint32Array {
  const gen = new MT19937(seed);
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) r[i] = gen.random53();
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  // TypedArray.sort is not guaranteed stable, but ties in 53-bit doubles are ~impossible;
  // sort index pairs via Array for stability anyway.
  const arr = Array.from(idx);
  arr.sort((a, b) => r[a] - r[b]);
  return Uint32Array.from(arr);
}

/** Inverse permutation: inv[p[i]] = i. */
export function invertPerm(p: Uint32Array): Uint32Array {
  const inv = new Uint32Array(p.length);
  for (let i = 0; i < p.length; i++) inv[p[i]] = i;
  return inv;
}
