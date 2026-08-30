/**
 * hw1: the same three circuits written three ways. Each style is evaluated literally as the
 * RTL describes it (gate netlist, dataflow expression, behavioral case/if); all must agree.
 */

export type Style = "gate" | "dataflow" | "behavioral";
export const STYLES: Style[] = ["gate", "dataflow", "behavioral"];

const not = (x: number) => x ^ 1;
const and = (...xs: number[]) => xs.reduce((acc, x) => acc & x, 1);
const or = (...xs: number[]) => xs.reduce((acc, x) => acc | x, 0);
const xor = (a: number, b: number) => a ^ b;

// ---- 2-to-4 decoder -------------------------------------------------------------------

export function decoderGate(sel: number): number {
  const s0 = sel & 1;
  const s1 = (sel >> 1) & 1;
  const w0 = not(s0);
  const w1 = not(s1);
  return and(w1, w0) | (and(w1, s0) << 1) | (and(s1, w0) << 2) | (and(s1, s0) << 3);
}

export function decoderDataflow(sel: number): number {
  const s0 = sel & 1;
  const s1 = (sel >> 1) & 1;
  const out0 = Number(!s0 && !s1);
  const out1 = Number(!!s0 && !s1);
  const out2 = Number(!s0 && !!s1);
  const out3 = Number(!!s0 && !!s1);
  return out0 | (out1 << 1) | (out2 << 2) | (out3 << 3);
}

export function decoderBehavioral(sel: number): number {
  switch (sel & 3) {
    case 0:
      return 0b0001;
    case 1:
      return 0b0010;
    case 2:
      return 0b0100;
    case 3:
      return 0b1000;
    default:
      return 0;
  }
}

export function decoder2to4(sel: number): Record<Style, number> {
  return { gate: decoderGate(sel), dataflow: decoderDataflow(sel), behavioral: decoderBehavioral(sel) };
}

// ---- full adder -----------------------------------------------------------------------

export interface FaOut {
  sum: number;
  cout: number;
}

export function fullAdderGate(a: number, b: number, cin: number): FaOut {
  const w0 = xor(b, a);
  const w1 = and(b, a);
  const w2 = and(w0, cin);
  return { cout: or(w2, w1), sum: xor(w0, cin) };
}

export function fullAdderDataflow(a: number, b: number, cin: number): FaOut {
  const p = a ^ b;
  const q = a & b;
  return { sum: p ^ cin, cout: q | (p & cin) };
}

export function fullAdderBehavioral(a: number, b: number, cin: number): FaOut {
  const t = a + b + cin;
  return { sum: t & 1, cout: (t >> 1) & 1 };
}

export function fullAdder(a: number, b: number, cin: number): Record<Style, FaOut> {
  return {
    gate: fullAdderGate(a, b, cin),
    dataflow: fullAdderDataflow(a, b, cin),
    behavioral: fullAdderBehavioral(a, b, cin),
  };
}

// ---- 2x1 mux --------------------------------------------------------------------------

export function muxGate(in0: number, in1: number, sel: number): number {
  const invSel = not(sel);
  const a0 = and(in0, invSel);
  const a1 = and(in1, sel);
  return or(a0, a1);
}

export function muxDataflow(in0: number, in1: number, sel: number): number {
  return Number((!sel && !!in0) || (!!sel && !!in1));
}

export function muxBehavioral(in0: number, in1: number, sel: number): number {
  return sel === 0 ? in0 : in1;
}

export function mux2(in0: number, in1: number, sel: number): Record<Style, number> {
  return { gate: muxGate(in0, in1, sel), dataflow: muxDataflow(in0, in1, sel), behavioral: muxBehavioral(in0, in1, sel) };
}
