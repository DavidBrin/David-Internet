/**
 * hw4 barrel shifter. `barrelShift` reproduces the three-stage mux network of
 * `barrel_shifter_mux_stages.sv` (stage k shifts by 2^k when shift_value[k] is set) and
 * returns every intermediate word; `barrelShiftValue` is the behavioral formula of
 * `barrel_shifter.sv`. Both must agree bit for bit (see tests).
 */

export type ShiftDir = "left" | "right";

export interface BarrelStage {
  /** shift distance this stage can apply (1, 2, 4, ...) */
  distance: number;
  /** whether this stage's mux selected the shifted input (shift_value bit set) */
  active: boolean;
  /** word after this stage, as bits LSB-first */
  bits: number[];
  /** for each output bit i, the index in the previous stage that feeds it when active (-1 = constant 0) */
  source: number[];
}

export interface BarrelResult {
  n: number;
  input: number[];
  stages: BarrelStage[];
  out: number;
}

export function toBits(value: number, n: number): number[] {
  const bits: number[] = [];
  for (let i = 0; i < n; i++) bits.push((value >>> i) & 1);
  return bits;
}

export function fromBits(bits: number[]): number {
  let v = 0;
  for (let i = bits.length - 1; i >= 0; i--) v = (v << 1) | (bits[i] & 1);
  return v >>> 0;
}

export function barrelShift(n: number, din: number, amount: number, dir: ShiftDir, rotate: boolean): BarrelResult {
  const layers = Math.ceil(Math.log2(n));
  const input = toBits(din, n);
  let prev = input;
  const stages: BarrelStage[] = [];
  for (let k = 0; k < layers; k++) {
    const d = 1 << k;
    const active = ((amount >> k) & 1) === 1;
    const source: number[] = [];
    const bits: number[] = [];
    for (let i = 0; i < n; i++) {
      let src: number;
      if (dir === "right") src = rotate ? (i + d) % n : i + d < n ? i + d : -1;
      else src = rotate ? (i - d + n) % n : i - d >= 0 ? i - d : -1;
      source.push(src);
      bits.push(active ? (src < 0 ? 0 : prev[src]) : prev[i]);
    }
    stages.push({ distance: d, active, bits, source });
    prev = bits;
  }
  return { n, input, stages, out: fromBits(prev) };
}

/** Behavioral form from `barrel_shifter.sv`. */
export function barrelShiftValue(n: number, din: number, amount: number, dir: ShiftDir, rotate: boolean): number {
  const mask = n >= 32 ? 0xffffffff : (1 << n) - 1;
  const x = din & mask;
  const shl = (v: number, s: number) => (s >= n ? 0 : (v << s) & mask) >>> 0;
  const shr = (v: number, s: number) => (s >= n ? 0 : v >>> s) >>> 0;
  if (dir === "left") return rotate ? (shl(x, amount) | shr(x, n - amount)) >>> 0 : shl(x, amount);
  return rotate ? (shr(x, amount) | shl(x, n - amount)) >>> 0 : shr(x, amount);
}
