/**
 * hw6 `carry_lookahead_adder.sv`: per-bit generate G = A&B, propagate P = A|B,
 * c[j+1] = G[j] | (P[j] & c[j]), sum[j] = A ^ B ^ c[j], result = {c[N], sum}.
 *
 * The RTL writes the carry chain in G/P form, which is what a lookahead unit flattens into
 * c[i] = G[i-1] | P[i-1]G[i-2] | ... | P[i-1]..P[0]c0 (two gate levels for every carry). A
 * plain ripple chain evaluates the same equation serially, so carry i settles after i
 * gate-delays. `depthRipple` / `depthLookahead` give those arrival times for the race widget.
 */

export interface ClaResult {
  n: number;
  a: number[];
  b: number[];
  g: number[];
  p: number[];
  /** carries c[0..n]; c[0] = cin */
  carry: number[];
  sum: number[];
  result: number;
  /** gate-delay at which carry i is valid in a ripple chain: i (0 for cin) */
  depthRipple: number[];
  /** gate-delay at which carry i is valid with lookahead: 0 for cin, else 2 */
  depthLookahead: number[];
}

export function cla(aVal: number, bVal: number, cin: number, n: number): ClaResult {
  const a: number[] = [];
  const b: number[] = [];
  const g: number[] = [];
  const p: number[] = [];
  const carry: number[] = [cin & 1];
  const sum: number[] = [];
  for (let i = 0; i < n; i++) {
    const ai = (aVal >>> i) & 1;
    const bi = (bVal >>> i) & 1;
    a.push(ai);
    b.push(bi);
    g.push(ai & bi);
    p.push(ai | bi);
    sum.push(ai ^ bi ^ carry[i]);
    carry.push(g[i] | (p[i] & carry[i]));
  }
  let result = carry[n];
  for (let i = n - 1; i >= 0; i--) result = result * 2 + sum[i]; // stays exact past 32 bits
  const depthRipple = carry.map((_, i) => i);
  const depthLookahead = carry.map((_, i) => (i === 0 ? 0 : 2));
  return { n, a, b, g, p, carry, sum, result, depthRipple, depthLookahead };
}

/** Sum-of-products expansion of c[i], as a lookahead unit computes it (for display). */
export function lookaheadTerm(i: number): string {
  if (i === 0) return "cin";
  const terms: string[] = [];
  for (let k = i - 1; k >= 0; k--) {
    let t = `G${k}`;
    for (let j = k + 1; j <= i - 1; j++) t = `P${j}·` + t;
    terms.push(t);
  }
  let last = "cin";
  for (let j = 0; j <= i - 1; j++) last = `P${j}·` + last;
  terms.push(last);
  return terms.join(" + ");
}
