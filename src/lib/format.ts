/** Number formatting. Every number shown carries a unit. */
const nf = (d: number) =>
  new Intl.NumberFormat('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmt = (v: number, digits = 0) => (Number.isFinite(v) ? nf(digits).format(v) : '—');

export const sec = (v: number, d = 2) => `${fmt(v, d)} s`;
export const ms = (v: number, d = 1) => `${fmt(v, d)} ms`;
export const hours = (v: number, d = 1) => `${fmt(v, d)} h`;
export const count = (v: number, unit: string) => `${fmt(v, 0)} ${unit}`;
export const pct = (v: number, d = 0) => `${fmt(v * 100, d)}%`;

/** Adaptive precision for seconds: 0.07 s, 2.9 s, 41.8 s. */
export const secAuto = (v: number) => sec(v, Math.abs(v) < 1 ? 2 : 1);

export function clock(msTotal: number) {
  const s = Math.max(0, msTotal / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}

export function hm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h} h ${String(m).padStart(2, '0')} min`;
}
