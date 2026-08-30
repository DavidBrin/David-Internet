/**
 * In-place iterative radix-2 complex FFT.  Power-of-two lengths only — that is all the
 * Welch estimator in coherence.ts needs (nperseg 128 / 256 / 512).
 *
 * Forward transform, unnormalised: X[k] = Σ x[n]·e^(−2πi·kn/N), same convention as
 * numpy.fft.fft, so the spectral scaling in coherence.ts can copy SciPy's line for line.
 */

/** Twiddle tables per length, built once. */
const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array }>();

function tablesFor(n: number) {
  let t = twiddles.get(n);
  if (!t) {
    const cos = new Float64Array(n / 2);
    const sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      cos[i] = Math.cos((2 * Math.PI * i) / n);
      sin[i] = -Math.sin((2 * Math.PI * i) / n);
    }
    t = { cos, sin };
    twiddles.set(n, t);
  }
  return t;
}

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/** Transform `re`/`im` in place. Both must have the same power-of-two length. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (!isPowerOfTwo(n)) throw new Error(`fft: length ${n} is not a power of two`);
  if (im.length !== n) throw new Error("fft: re/im length mismatch");

  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }

  const { cos, sin } = tablesFor(n);
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const stride = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * stride];
        const wi = sin[k * stride];
        const a = i + k;
        const b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}
