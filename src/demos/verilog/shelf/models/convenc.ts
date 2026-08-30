/**
 * hw7 `conv_enc.sv`: rate-1/2 convolutional encoder. `history <= {data_in, history[N-1:1]}`
 * (new bit enters at the MSB), `data_out[k] = ^(mask_k & history)`.
 */

import { parity } from "./lfsr";

export interface ConvEncState {
  history: number;
  /** [data_out[0], data_out[1]] for the current history */
  out: [number, number];
}

export function convEncOutputs(history: number, mask0: number, mask1: number): [number, number] {
  return [parity(history & mask0), parity(history & mask1)];
}

export function convEncReset(mask0: number, mask1: number): ConvEncState {
  return { history: 0, out: convEncOutputs(0, mask0, mask1) };
}

/** One clock with `load_mask == 00` and reset released. */
export function convEncStep(s: ConvEncState, dataIn: number, mask0: number, mask1: number, n: number): ConvEncState {
  const mask = (1 << n) - 1;
  const history = (((dataIn & 1) << (n - 1)) | (s.history >>> 1)) & mask;
  return { history, out: convEncOutputs(history, mask0, mask1) };
}

/** Encode a whole bit sequence; returns the symbol pairs emitted after each input. */
export function convEncode(bits: number[], mask0: number, mask1: number, n: number): [number, number][] {
  let s = convEncReset(mask0, mask1);
  const out: [number, number][] = [];
  for (const b of bits) {
    s = convEncStep(s, b, mask0, mask1, n);
    out.push(s.out);
  }
  return out;
}
