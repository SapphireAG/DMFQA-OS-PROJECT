/**
 * Adaptive quantum for Q1/Q2: q = min(2b, b + floor(b * min(R, ref) / ref)).
 * R = number of waiting items excluding the receiver.
 */
export function dynQuantum(b: number, R: number, ref: number): number {
  return Math.min(2 * b, b + Math.floor((b * Math.min(R, ref)) / ref));
}

/** Quantum for an item entering `level`. Q0 is always fixed. */
export function quantumFor(
  level: number,
  quanta: readonly number[],
  dynamic: boolean,
  R: number,
  ref: number,
): number {
  const b = quanta[level];
  if (level === 0 || !dynamic) return b;
  return dynQuantum(b, R, ref);
}
