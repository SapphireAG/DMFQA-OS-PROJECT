import { EV, type Frame } from '@/engine/types';

/**
 * Reconstructs queue membership from compact frames. Moving forward applies events
 * incrementally; seeking backwards replays from the start.
 */
export class Replay {
  level: Int8Array;
  order: Float64Array; // entry counter within a level (mirrors the engine's seq)
  present = new Set<number>();
  idx = -1;
  private ctr = 0;

  constructor(
    private frames: { ev: number[] }[],
    private n: number,
  ) {
    this.level = new Int8Array(n);
    this.order = new Float64Array(n);
  }

  seek(f: number) {
    if (f < this.idx) {
      this.level.fill(0);
      this.order.fill(0);
      this.present.clear();
      this.idx = -1;
      this.ctr = 0;
    }
    while (this.idx < f) {
      this.idx++;
      const ev = this.frames[this.idx].ev;
      for (let k = 0; k < ev.length; k += 3) {
        const code = ev[k];
        const i = ev[k + 1];
        if (code === EV.arrive || code === EV.demote || code === EV.promote) {
          this.level[i] = ev[k + 2];
          this.order[i] = this.ctr++;
          if (code === EV.arrive) this.present.add(i);
        } else if (code === EV.finish) this.present.delete(i);
      }
    }
  }

  /** Waiting requests per level, in service order. */
  lanes(slots: readonly number[]): number[][] {
    const running = new Set(slots);
    const out: number[][] = [[], [], []];
    for (const i of this.present) if (!running.has(i)) out[this.level[i]].push(i);
    for (const l of out) l.sort((a, b) => this.order[a] - this.order[b]);
    return out;
  }
}

/** Largest frame index with t ≤ time (−1 if none). */
export function frameAt(frames: Frame[], time: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= time) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Per-request token emission times, for the chat windows. */
export function tokenTimes(frames: Frame[], ids: number[]): Map<number, number[]> {
  const out = new Map<number, number[]>(ids.map((i) => [i, []]));
  for (const f of frames) {
    for (const s of f.slots) out.get(s)?.push(f.t);
    for (let k = 0; k < f.ev.length; k += 3) if (f.ev[k] === EV.finish) out.get(f.ev[k + 1])?.push(f.t);
  }
  return out;
}
