/**
 * hw5 `lfsr.sv`: N-bit Fibonacci LFSR, feedback = XOR of the tapped bits, shifted in at the LSB.
 * `lfsr_data <= {lfsr_data[N-2:0], ^(lfsr_data & tap_ptrn)}`
 */

/** Default (primitive-polynomial) tap masks after reset, from the RTL's `default_tap`. */
export const DEFAULT_TAPS: Record<number, number> = {
  2: 0b11,
  3: 0b110,
  4: 0b1100,
  5: 0b10100,
  6: 0b110000,
  7: 0b1100000,
  8: 0b10111000,
};

export function defaultTap(n: number): number {
  return DEFAULT_TAPS[n] ?? 0;
}

export function parity(x: number): number {
  let p = 0;
  while (x) {
    p ^= x & 1;
    x >>>= 1;
  }
  return p;
}

export function lfsrStep(state: number, taps: number, n: number): number {
  const mask = (1 << n) - 1;
  const feedback = parity(state & taps & mask);
  return ((state << 1) & mask) | feedback;
}

export interface LfsrSequence {
  /** states visited starting with the seed */
  states: number[];
  /** steps until the state first equals the seed again, or null if it never does within 2^n steps */
  period: number | null;
  maximal: boolean;
}

export function lfsrSequence(seed: number, taps: number, n: number): LfsrSequence {
  const limit = 1 << n;
  const states = [seed];
  let s = seed;
  for (let i = 1; i <= limit; i++) {
    s = lfsrStep(s, taps, n);
    if (s === seed) return { states, period: i, maximal: i === limit - 1 };
    states.push(s);
  }
  return { states, period: null, maximal: false };
}
