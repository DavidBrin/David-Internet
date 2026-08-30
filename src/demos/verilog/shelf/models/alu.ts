/**
 * hw2 ALUs.
 * - `alu16` matches `alu_enum.sv` (`alu_e`): 16-bit, `a` signed, `b` unsigned, 8 `opa` commands.
 * - `alu4` matches `alu.sv`: N-bit add/sub/and/or selected by a 2-bit operation.
 * Flags are not RTL outputs; `aluFlags` derives the usual four from the operands/result.
 */

export const ALU_OPS = ["AADD", "ASUB", "AAND", "AOR", "AXOR", "ASL", "ASR", "ASRU"] as const;
export type AluOp = (typeof ALU_OPS)[number];

export const ALU_OP_TEXT: Record<AluOp, string> = {
  AADD: "r = a + b",
  ASUB: "r = a - b",
  AAND: "r = a & b",
  AOR: "r = a | b",
  AXOR: "r = a ^ b",
  ASL: "r = a << b",
  ASR: "r = a >>> b  (arithmetic)",
  ASRU: "r = a >> b  (logical)",
};

const M16 = 0xffff;

export function toSigned16(x: number): number {
  const v = x & M16;
  return v >= 0x8000 ? v - 0x10000 : v;
}

/** Returns the 16-bit result as an unsigned 0..65535 pattern (what `r` holds). */
export function alu16(op: AluOp, a: number, b: number): number {
  const ua = a & M16;
  const ub = b & M16;
  switch (op) {
    case "AADD":
      return (ua + ub) & M16;
    case "ASUB":
      return (ua - ub) & M16;
    case "AAND":
      return ua & ub;
    case "AOR":
      return ua | ub;
    case "AXOR":
      return ua ^ ub;
    case "ASL":
      return ub >= 16 ? 0 : (ua << ub) & M16;
    case "ASR":
      return ub >= 16 ? (ua & 0x8000 ? M16 : 0) : (toSigned16(ua) >> ub) & M16;
    case "ASRU":
      return ub >= 16 ? 0 : ua >>> ub;
  }
}

export interface AluFlags {
  zero: boolean;
  negative: boolean;
  carry: boolean;
  overflow: boolean;
}

export function aluFlags(op: AluOp, a: number, b: number, r: number): AluFlags {
  const ua = a & M16;
  const ub = b & M16;
  let carry = false;
  let overflow = false;
  if (op === "AADD") {
    carry = ua + ub > M16;
    overflow = toSigned16(ua) + toSigned16(ub) !== toSigned16(r);
  } else if (op === "ASUB") {
    carry = ua < ub; // borrow
    overflow = toSigned16(ua) - toSigned16(ub) !== toSigned16(r);
  }
  return { zero: (r & M16) === 0, negative: (r & 0x8000) !== 0, carry, overflow };
}

/** `alu.sv` (N-bit, 2-bit operation): 0 add, 1 sub, 2 and, 3 or. */
export function alu4(operation: number, a: number, b: number, n = 4): number {
  const mask = (1 << n) - 1;
  switch (operation & 3) {
    case 0:
      return (a + b) & mask;
    case 1:
      return (a - b) & mask;
    case 2:
      return a & b & mask;
    default:
      return (a | b) & mask;
  }
}
