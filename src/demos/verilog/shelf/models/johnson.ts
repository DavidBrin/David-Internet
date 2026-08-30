/**
 * hw3 `johnson_counter.sv`: count <= {~count[0], count[n-1:1]} — the inverted LSB is fed back
 * into the MSB, so an n-bit ring walks a 2n-state sequence (0000 1000 1100 1110 1111 0111 0011 0001).
 * `clear` is asynchronous active-low; `preset` low loads `load_cnt` synchronously.
 */

export function johnsonStep(count: number, n: number): number {
  const mask = (1 << n) - 1;
  const lsb = count & 1;
  return (((lsb ^ 1) << (n - 1)) | (count >>> 1)) & mask;
}

/** Full 2n-state cycle starting from `start`. */
export function johnsonSequence(start: number, n: number): number[] {
  const seq = [start];
  let s = start;
  for (let i = 1; i < 2 * n; i++) {
    s = johnsonStep(s, n);
    seq.push(s);
  }
  return seq;
}
