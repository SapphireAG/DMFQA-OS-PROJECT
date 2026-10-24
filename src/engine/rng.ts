/** Seeded RNG: mulberry32 with Box–Muller normals and inverse-CDF exponentials. */

export interface Rng {
  next(): number; // uniform [0, 1)
  normal(): number;
  lognormal(median: number, sigma: number): number;
  exponential(rate: number): number;
  choice<T>(items: readonly T[], probs: readonly number[]): T;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: number): Rng {
  const u = mulberry32(seed);
  let spare: number | null = null;
  const normal = () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u1 = u();
    while (u1 <= Number.EPSILON) u1 = u();
    const u2 = u();
    const r = Math.sqrt(-2 * Math.log(u1));
    spare = r * Math.sin(2 * Math.PI * u2);
    return r * Math.cos(2 * Math.PI * u2);
  };
  return {
    next: u,
    normal,
    lognormal: (median, sigma) => median * Math.exp(sigma * normal()),
    exponential: (rate) => -Math.log(1 - u()) / rate,
    choice(items, probs) {
      const x = u();
      let acc = 0;
      for (let i = 0; i < items.length; i++) {
        acc += probs[i];
        if (x < acc) return items[i];
      }
      return items[items.length - 1];
    },
  };
}
