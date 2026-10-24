/** Percentile with linear interpolation between closest ranks (numpy's default). */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/** Same as `percentile` for an already ascending array, without copying. */
export function percentileSorted(s: readonly number[], p: number): number {
  if (s.length === 0) return NaN;
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

export function max(values: readonly number[]): number {
  let m = values.length ? -Infinity : NaN;
  for (const v of values) if (v > m) m = v;
  return m;
}
