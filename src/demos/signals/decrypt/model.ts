/**
 * Lab 1 decryption chain — pure array math, ported from the lab's encryption:
 *
 *   Y  = speech, length N, Fs = 44100
 *   Z  = Y(perm)                    perm = randperm(N) with rng(2023)
 *   W  = complex(Z(1:N/2), Z(N/2+1:N))     (real = first half, imag = second half)
 *   X  = complex(abs(W), angle(W))          (real = magnitude, imag = phase)
 *
 * The page ships X's real/imag parts as "mag" and "phase" and undoes each step:
 *
 *   1. unpackMagPhase  — W = mag * e^(j*phase)
 *   2. reformZ         — Z = concat(Re W, Im W)
 *   3. unpermuteY       — Y[perm[i]] = Z[i]
 *   4. flipY            — M = reverse(Y)   (the recognizable message: David's code plays flipud(Y))
 *
 * Every function here is pure (typed arrays in, typed arrays out) so it can be driven
 * directly by a test fixture without touching the DOM or fetch.
 */

/** Step 1: recover W = mag * e^(j*phase) from its magnitude/phase parts. */
export function unpackMagPhase(mag: Float64Array, phase: Float64Array): { re: Float64Array; im: Float64Array } {
  const n = mag.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const m = mag[i];
    const p = phase[i];
    re[i] = m * Math.cos(p);
    im[i] = m * Math.sin(p);
  }
  return { re, im };
}

/** Step 2: Z = concat(Re W, Im W). */
export function reformZ(re: Float64Array, im: Float64Array): Float64Array {
  const z = new Float64Array(re.length + im.length);
  z.set(re, 0);
  z.set(im, re.length);
  return z;
}

/** Step 3: undo Z = Y(perm), i.e. z[i] = y[perm[i]], by scattering: y[perm[i]] = z[i]. */
export function unpermuteY(z: Float64Array, perm: ArrayLike<number>): Float64Array {
  const y = new Float64Array(z.length);
  for (let i = 0; i < perm.length; i++) y[perm[i]] = z[i];
  return y;
}

/** Step 4: M = flipud(Y) — the message is the time-reversed decoded signal. */
export function flipY(y: Float64Array): Float64Array {
  const n = y.length;
  const m = new Float64Array(n);
  for (let i = 0; i < n; i++) m[i] = y[n - 1 - i];
  return m;
}

export interface DecodedChain {
  re: Float64Array;
  im: Float64Array;
  z: Float64Array;
  y: Float64Array;
  m: Float64Array;
}

/** Runs the full chain in one shot; convenient for the panel, which caches every step. */
export function decodeAll(mag: Float64Array, phase: Float64Array, perm: ArrayLike<number>): DecodedChain {
  const { re, im } = unpackMagPhase(mag, phase);
  const z = reformZ(re, im);
  const y = unpermuteY(z, perm);
  const m = flipY(y);
  return { re, im, z, y, m };
}
