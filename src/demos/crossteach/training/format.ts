/** Fixed 3-decimal formatting for metrics, per the panel's numbers convention. */
export function fmt3(v: number): string {
  return v.toFixed(3);
}
