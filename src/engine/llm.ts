/**
 * Iteration-level LLM serving engine (CLAUDE.md §5.1).
 *
 * Every step the scheduler refills a batch of `slots` KV-cache slots from the highest
 * non-empty level; each batched request gains one token. Step time =
 * stepBase + stepPerSeq·batch + prefillPerTok·(prompts prefilled this step) + swap-in costs.
 */
import { makeRng } from './rng';
import { quantumFor } from './quantum';
import { percentile, percentileSorted, mean, max } from './metrics';
import {
  EV,
  POLICY_FLAGS,
  type Frame,
  type LLMConfig,
  type LLMRequest,
  type LLMRun,
  type Policy,
} from './types';

export const DEFAULT_LLM: LLMConfig = {
  slots: 16,
  quanta: [16, 32, 64],
  ref: 8,
  aging: [0, 1500, 3000], // Q0 unused; Q1→Q0 after 1.5 s, Q2→Q1 after 3 s
  stepBaseMs: 12,
  stepPerSeqMs: 0.6,
  prefillPerTokMs: 0.02,
  swapPerTokMs: 0.004,
  longCutoff: 512,
  chatFrac: 0.8,
  chatOutMedian: 120,
  // ASSUMPTION: the report gives medians only. These σ values put 2.0 req/s at ≈90% of
  // decode capacity, matching the report's load description. Replace with the values in
  // research/dmfqa_ai_sim.py once that file is in the repo.
  chatOutSigma: 0.7,
  longOutMedian: 900,
  longOutSigma: 0.5,
  chatPromptMedian: 250,
  longPromptMedian: 1200,
  promptSigma: 0.5,
};

export interface WorkloadOpts {
  rate: number; // requests per second
  n: number;
  seed: number;
}

export function genLLMWorkload(cfg: LLMConfig, { rate, n, seed }: WorkloadOpts): LLMRequest[] {
  const rng = makeRng(seed);
  const out: LLMRequest[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    t += rng.exponential(rate / 1000);
    const chat = rng.next() < cfg.chatFrac;
    const output = Math.max(
      1,
      Math.round(
        chat
          ? rng.lognormal(cfg.chatOutMedian, cfg.chatOutSigma)
          : rng.lognormal(cfg.longOutMedian, cfg.longOutSigma),
      ),
    );
    const prompt = Math.max(
      1,
      Math.round(
        rng.lognormal(chat ? cfg.chatPromptMedian : cfg.longPromptMedian, cfg.promptSigma),
      ),
    );
    out.push({ id: i, arrival: t, prompt, output, kind: chat ? 'chat' : 'long' });
  }
  return out;
}

/** Adds extra requests (e.g. "Inject long request") and re-numbers ids by arrival order. */
export function mergeRequests(base: LLMRequest[], extra: Omit<LLMRequest, 'id'>[]): LLMRequest[] {
  const all = [...base.map(({ id: _id, ...r }) => r), ...extra];
  all.sort((a, b) => a.arrival - b.arrival);
  return all.map((r, id) => ({ ...r, id }));
}

export function simulateLLM(
  cfg: LLMConfig,
  policy: Policy,
  requests: LLMRequest[],
  opts: { trace?: boolean } = {},
): LLMRun {
  const { multilevel, dynamic, aging } = POLICY_FLAGS[policy];
  const n = requests.length;
  const S = cfg.slots;

  const level = new Int8Array(n);
  const seq = new Float64Array(n);
  const qLeft = new Float64Array(n);
  const ageStart = new Float64Array(n);
  const generated = new Int32Array(n);
  const running = new Uint8Array(n);
  const swapped = new Uint8Array(n);
  const prefilled = new Uint8Array(n);
  const slotOf = new Int32Array(n).fill(-1);
  const lastTok = new Float64Array(n);
  const maxGap = new Float64Array(n);
  const firstToken = new Array<number>(n).fill(NaN);
  const finish = new Array<number>(n).fill(NaN);

  const slots = new Array<number>(S).fill(-1);
  let active: number[] = [];
  let seqCtr = 0;
  let next = 0;
  let done = 0;
  let swaps = 0;
  let t = 0;
  const frames: Frame[] = [];

  const byPriority = (a: number, b: number) => level[a] - level[b] || seq[a] - seq[b];

  while (done < n) {
    const ev: number[] = [];

    // 1. admit arrivals into Q0
    while (next < n && requests[next].arrival <= t) {
      const i = next++;
      level[i] = 0;
      seq[i] = seqCtr++;
      qLeft[i] = multilevel ? cfg.quanta[0] : Infinity;
      ageStart[i] = requests[i].arrival;
      lastTok[i] = requests[i].arrival;
      active.push(i);
      ev.push(EV.arrive, i, 0);
    }
    if (active.length === 0) {
      t = requests[next].arrival;
      continue;
    }

    // 2. aging — waiting items only, one level at a time
    if (aging) {
      let waiting = 0;
      for (const i of active) if (!running[i]) waiting++;
      for (const i of active) {
        if (running[i] || level[i] === 0) continue;
        if (t - ageStart[i] >= cfg.aging[level[i]]) {
          const L = level[i] - 1;
          level[i] = L;
          qLeft[i] = quantumFor(L, cfg.quanta, dynamic, waiting - 1, cfg.ref);
          ageStart[i] = t;
          seq[i] = seqCtr++;
          ev.push(EV.promote, i, L);
        }
      }
    }

    // 3. selection by (level, seq); FCFS has a single level so this is arrival order
    const order = active.slice().sort(byPriority);
    const chosen = order.slice(0, S);
    const chosenSet = new Set(chosen);

    for (const i of active) {
      if (running[i] && !chosenSet.has(i)) {
        running[i] = 0;
        swapped[i] = 1;
        swaps++;
        slots[slotOf[i]] = -1;
        slotOf[i] = -1;
        ev.push(EV.preempt, i, level[i]);
      }
    }

    let prefillTok = 0;
    let swapMs = 0;
    for (const i of chosen) {
      if (running[i]) continue;
      running[i] = 1;
      const s = slots.indexOf(-1);
      slots[s] = i;
      slotOf[i] = s;
      if (swapped[i]) {
        swapMs += cfg.swapPerTokMs * (requests[i].prompt + generated[i]);
        swapped[i] = 0;
        ev.push(EV.resume, i, level[i]);
      }
      if (!prefilled[i]) {
        prefillTok += requests[i].prompt;
        prefilled[i] = 1;
      }
    }

    // 4. one decoding iteration
    const batch = chosen.length;
    const dt =
      cfg.stepBaseMs + cfg.stepPerSeqMs * batch + cfg.prefillPerTokMs * prefillTok + swapMs;
    const tEnd = t + dt;
    const waitingAfter = active.length - batch;
    const finished: number[] = [];

    for (const i of chosen) {
      generated[i]++;
      qLeft[i]--;
      const gap = tEnd - lastTok[i];
      if (gap > maxGap[i]) maxGap[i] = gap;
      lastTok[i] = tEnd;
      if (generated[i] === 1) firstToken[i] = tEnd;

      if (generated[i] >= requests[i].output) {
        finish[i] = tEnd;
        running[i] = 0;
        slots[slotOf[i]] = -1;
        slotOf[i] = -1;
        finished.push(i);
        done++;
        ev.push(EV.finish, i, level[i]);
        continue;
      }
      ageStart[i] = tEnd; // running items reset their aging clock every step
      if (multilevel && qLeft[i] <= 0) {
        const L = Math.min(level[i] + 1, 2);
        level[i] = L;
        seq[i] = seqCtr++;
        qLeft[i] = quantumFor(L, cfg.quanta, dynamic, waitingAfter, cfg.ref);
        ev.push(EV.demote, i, L);
      }
    }
    if (finished.length) {
      const f = new Set(finished);
      active = active.filter((i) => !f.has(i));
    }
    t = tEnd;
    if (opts.trace) frames.push({ t, slots: slots.slice(), ev });
  }

  return {
    summary: summarizeLLM(cfg, policy, requests, firstToken, finish, Array.from(maxGap), swaps),
    requests,
    firstToken,
    finish,
    frames: opts.trace ? frames : undefined,
  };
}

export function summarizeLLM(
  cfg: LLMConfig,
  policy: Policy,
  requests: LLMRequest[],
  firstToken: number[],
  finish: number[],
  maxGap: number[],
  swaps: number,
) {
  const shortTTFT: number[] = [];
  const longLat: number[] = [];
  const longGap: number[] = [];
  const perTok: number[] = [];
  let tokens = 0;
  let lastFinish = 0;
  for (const r of requests) {
    const lat = finish[r.id] - r.arrival;
    perTok.push(lat / r.output);
    tokens += r.output;
    lastFinish = Math.max(lastFinish, finish[r.id]);
    if (r.output > cfg.longCutoff) {
      longLat.push(lat);
      longGap.push(maxGap[r.id]);
    } else {
      shortTTFT.push(firstToken[r.id] - r.arrival);
    }
  }
  const first = requests.length ? requests[0].arrival : 0;
  return {
    policy,
    n: requests.length,
    shortP99TTFT: percentile(shortTTFT, 99) / 1000,
    shortMeanTTFT: mean(shortTTFT) / 1000,
    longP99Latency: percentile(longLat, 99) / 1000,
    longestStallLong: max(longGap) / 1000,
    meanLatencyPerToken: mean(perTok),
    swaps,
    throughput: tokens / ((lastFinish - first) / 1000),
    makespan: lastFinish / 1000,
  };
}

/**
 * Per-frame live meters, derived only from the trace. At the last frame every value
 * equals the summary of the same run (tested in engine.unit.test.ts).
 */
export interface LLMMeters {
  p99: Float64Array; // s, short-request p99 TTFT among first tokens emitted so far
  stall: Float64Array; // s, longest stall of a long request so far (incl. ongoing waits)
  swaps: Int32Array;
  tps: Float64Array; // tokens/s since first arrival
}

export function llmMeters(cfg: LLMConfig, run: LLMRun): LLMMeters {
  const frames = run.frames ?? [];
  const reqs = run.requests;
  const F = frames.length;
  const m: LLMMeters = {
    p99: new Float64Array(F),
    stall: new Float64Array(F),
    swaps: new Int32Array(F),
    tps: new Float64Array(F),
  };
  const isLong = (i: number) => reqs[i].output > cfg.longCutoff;
  const sorted: number[] = [];
  const lastTok = new Float64Array(reqs.length);
  const gen = new Int32Array(reqs.length);
  const activeLong = new Set<number>();
  let maxStall = 0;
  let swaps = 0;
  let tokens = 0;
  const first = reqs.length ? reqs[0].arrival : 0;

  const insert = (v: number) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    sorted.splice(lo, 0, v);
  };

  for (let f = 0; f < F; f++) {
    const fr = frames[f];
    for (let k = 0; k < fr.ev.length; k += 3) {
      const code = fr.ev[k];
      const i = fr.ev[k + 1];
      if (code === EV.arrive) {
        lastTok[i] = reqs[i].arrival;
        if (isLong(i)) activeLong.add(i);
      } else if (code === EV.preempt) swaps++;
    }
    for (const i of fr.slots) {
      if (i < 0) continue;
      tokens++;
      gen[i]++;
      const gap = fr.t - lastTok[i];
      if (isLong(i) && gap > maxStall) maxStall = gap;
      lastTok[i] = fr.t;
      if (gen[i] === 1 && !isLong(i)) insert(fr.t - reqs[i].arrival);
    }
    // finished requests leave the slot table in the same frame they emit their last token
    for (let k = 0; k < fr.ev.length; k += 3) {
      const i = fr.ev[k + 1];
      if (fr.ev[k] !== EV.finish) continue;
      tokens++;
      gen[i]++;
      const gap = fr.t - lastTok[i];
      if (isLong(i) && gap > maxStall) maxStall = gap;
      lastTok[i] = fr.t;
      if (gen[i] === 1 && !isLong(i)) insert(fr.t - reqs[i].arrival);
      activeLong.delete(i);
    }
    let ongoing = maxStall;
    for (const i of activeLong) ongoing = Math.max(ongoing, fr.t - lastTok[i]);
    m.p99[f] = sorted.length ? percentileSorted(sorted, 99) / 1000 : NaN;
    m.stall[f] = ongoing / 1000;
    m.swaps[f] = swaps;
    m.tps[f] = tokens / ((fr.t - first) / 1000);
  }
  return m;
}
