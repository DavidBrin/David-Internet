/** Shared canvas-chart math for the training panel. */

/** Points visible up to a fractional epoch position, with a lerp'd leading point for animation. */
export function progressivePoints(values: number[], epochFloat: number): { epoch: number; value: number }[] {
  const n = values.length;
  const clamped = Math.max(1, Math.min(n, epochFloat));
  const floor = Math.floor(clamped);
  const frac = clamped - floor;
  const pts: { epoch: number; value: number }[] = [];
  for (let i = 1; i <= floor; i++) pts.push({ epoch: i, value: values[i - 1] });
  if (frac > 0.002 && floor < n) {
    const a = values[floor - 1];
    const b = values[floor];
    pts.push({ epoch: floor + frac, value: a + (b - a) * frac });
  }
  return pts;
}
