/**
 * hw2 `counter_4bit.sv`: WIDTH-bit up counter, asynchronous active-high clear.
 */

export function counterStep(count: number, width = 4, clear = false): number {
  if (clear) return 0;
  return (count + 1) & ((1 << width) - 1);
}
