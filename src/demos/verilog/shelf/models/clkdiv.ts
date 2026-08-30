/**
 * hw6 `clock_div_by_N.sv`: the counter advances on *both* edges of clkin (0..2N-1) and
 * clkout = (count > N-2) && (count < 2N-1), which gives a 50/50 output at clkin/N.
 */

export interface ClkDivState {
  count: number;
  clkout: 0 | 1;
}

export function clkDivOut(count: number, n: number): 0 | 1 {
  return count > n - 2 && count < 2 * n - 1 ? 1 : 0;
}

export function clkDivReset(n: number): ClkDivState {
  return { count: 0, clkout: clkDivOut(0, n) };
}

/** One clkin edge (rising or falling). */
export function clkDivStep(s: ClkDivState, n: number): ClkDivState {
  const count = s.count === 2 * n - 1 ? 0 : s.count + 1;
  return { count, clkout: clkDivOut(count, n) };
}

export interface ClkDivTrace {
  /** clkin level per half-period, starting high after the first edge */
  clkin: number[];
  clkout: number[];
  count: number[];
}

/** Levels after each of `edges` clkin edges, starting from reset. */
export function clkDivTrace(n: number, edges: number): ClkDivTrace {
  let s = clkDivReset(n);
  const t: ClkDivTrace = { clkin: [], clkout: [], count: [] };
  for (let e = 0; e < edges; e++) {
    s = clkDivStep(s, n);
    t.clkin.push(e % 2 === 0 ? 1 : 0);
    t.clkout.push(s.clkout);
    t.count.push(s.count);
  }
  return t;
}
