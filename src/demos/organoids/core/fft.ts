/** Radix-2 FFT + real DFT helpers for the organoids demo (self-contained). */

/** In-place radix-2 FFT. re/im length must be a power of 2. */
export function fft(re: Float64Array, im: Float64Array, invert = false): void {
  const n = re.length;
  if ((n & (n - 1)) !== 0) throw new Error("fft length must be a power of 2");
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((invert ? 1 : -1) * 2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;
        const nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }
  if (invert) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

/**
 * One-sided DFT power of a (short, arbitrary-length) real segment.
 * Direct O(n²) — used for Welch segments (n = 200), where it is plenty fast.
 * Returns |X[k]|² for k = 0..n/2.
 */
export function dftPower(x: Float64Array, out: Float64Array): void {
  const n = x.length;
  const half = Math.floor(n / 2);
  for (let k = 0; k <= half; k++) {
    let sr = 0;
    let si = 0;
    const w = (-2 * Math.PI * k) / n;
    for (let t = 0; t < n; t++) {
      const a = w * t;
      sr += x[t] * Math.cos(a);
      si += x[t] * Math.sin(a);
    }
    out[k] = sr * sr + si * si;
  }
}
