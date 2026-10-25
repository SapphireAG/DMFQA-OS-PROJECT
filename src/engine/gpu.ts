/**
 * GPU training-cluster engine (CLAUDE.md §5.1): one-minute steps, gang placement.
 * Multilevel policies fill greedily in (level, seq) order with backfill; FCFS is strict FIFO,
 * so the head job blocks everything behind it. A resumed job spends `restoreMin` minutes
 * restoring its checkpoint before it makes progress again.
 */
import { makeRng } from './rng';
import { quantumFor } from './quantum';
import { percentile, mean, max } from './metrics';
import {
  EV,
  POLICY_FLAGS,
  type GPUConfig,
  type GPUFrame,
  type GPUJob,
  type GPURun,
  type GPUSummary,
  type Policy,
} from './types';

export const DEFAULT_GPU: GPUConfig = {
  gpus: 64,
  quanta: [60, 240, 960],
  ref: 8,
  aging: [0, 60, 120], // Q1→Q0 after 1 h, Q2→Q1 after 2 h
  restoreMin: 2,
  longCutoff: 960,
  sizes: [1, 2, 4, 8, 16],
  sizeProbs: [0.35, 0.2, 0.2, 0.15, 0.1],
  durMedian: 60,
  // ASSUMPTION: the report says "median 60 min, heavy tail". σ = 1.15 puts 6 jobs/h at ≈77%
  // offered utilisation. Replace with the value in research/dmfqa_ai_sim.py when available.
  durSigma: 1.15,
  durCap: 3 * 24 * 60,
};

export function genGPUWorkload(
  cfg: GPUConfig,
  { rate, n, seed }: { rate: number; n: number; seed: number },
): GPUJob[] {
  const rng = makeRng(seed);
  const jobs: GPUJob[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    t += rng.exponential(rate / 60);
    const gpus = rng.choice(cfg.sizes, cfg.sizeProbs);
    const duration = Math.min(cfg.durCap, Math.max(1, Math.round(rng.lognormal(cfg.durMedian, cfg.durSigma))));
    jobs.push({ id: i, arrival: t, gpus, duration });
  }
  return jobs;
}

/** Extra GPU event code: a job is placed on GPUs. */
export const EV_START = 6;

export function simulateGPU(
  cfg: GPUConfig,
  policy: Policy,
  jobs: GPUJob[],
  opts: { trace?: boolean } = {},
): GPURun {
  const { multilevel, dynamic, aging } = POLICY_FLAGS[policy];
  const n = jobs.length;
  const G = cfg.gpus;

  const level = new Int8Array(n);
  const seq = new Float64Array(n);
  const qLeft = new Float64Array(n);
  const ageStart = new Float64Array(n);
  const waitStart = new Float64Array(n);
  const maxWait = new Float64Array(n);
  const progress = new Int32Array(n);
  const restoreLeft = new Int32Array(n);
  const running = new Uint8Array(n);
  const finish = new Float64Array(n).fill(NaN);
  const gpusOf: number[][] = Array.from({ length: n }, () => []);
  const grid = new Array<number>(G).fill(-1);

  let active: number[] = [];
  let seqCtr = 0;
  let next = 0;
  let done = 0;
  let preemptions = 0;
  let busy = 0;
  let t = 0;
  const frames: GPUFrame[] = [];

  const release = (j: number) => {
    for (const g of gpusOf[j]) grid[g] = -1;
    gpusOf[j] = [];
  };
  const place = (j: number) => {
    let need = jobs[j].gpus;
    for (let g = 0; g < G && need > 0; g++) {
      if (grid[g] === -1) {
        grid[g] = j;
        gpusOf[j].push(g);
        need--;
      }
    }
  };

  while (done < n) {
    const ev: number[] = [];

    while (next < n && jobs[next].arrival <= t) {
      const j = next++;
      level[j] = 0;
      seq[j] = seqCtr++;
      qLeft[j] = multilevel ? cfg.quanta[0] : Infinity;
      ageStart[j] = t;
      waitStart[j] = jobs[j].arrival;
      active.push(j);
      ev.push(EV.arrive, j, 0);
    }
    if (active.length === 0) {
      t = Math.ceil(jobs[next].arrival);
      continue;
    }

    if (aging) {
      let waiting = 0;
      for (const j of active) if (!running[j]) waiting++;
      for (const j of active) {
        if (running[j] || level[j] === 0) continue;
        if (t - ageStart[j] >= cfg.aging[level[j]]) {
          const L = level[j] - 1;
          level[j] = L;
          qLeft[j] = quantumFor(L, cfg.quanta, dynamic, waiting - 1, cfg.ref);
          ageStart[j] = t;
          seq[j] = seqCtr++;
          ev.push(EV.promote, j, L);
        }
      }
    }

    // placement
    const start: number[] = [];
    if (!multilevel) {
      let free = G;
      for (const j of active) if (running[j]) free -= jobs[j].gpus;
      // active is in arrival order; strict FIFO stops at the first job that does not fit
      for (const j of active) {
        if (running[j]) continue;
        if (jobs[j].gpus > free) break;
        free -= jobs[j].gpus;
        start.push(j);
      }
    } else {
      const order = active.slice().sort((a, b) => level[a] - level[b] || seq[a] - seq[b]);
      let free = G;
      const keep = new Set<number>();
      for (const j of order) {
        if (jobs[j].gpus <= free) {
          free -= jobs[j].gpus;
          keep.add(j);
        }
      }
      for (const j of active) {
        if (running[j] && !keep.has(j)) {
          running[j] = 0;
          release(j);
          restoreLeft[j] = cfg.restoreMin;
          waitStart[j] = t;
          preemptions++;
          ev.push(EV.preempt, j, level[j]);
        }
      }
      for (const j of order) if (keep.has(j) && !running[j]) start.push(j);
    }
    for (const j of start) {
      running[j] = 1;
      place(j);
      maxWait[j] = Math.max(maxWait[j], t - waitStart[j]);
      ev.push(EV_START, j, level[j]);
    }

    // one minute of work
    let waitingAfter = 0;
    for (const j of active) if (!running[j]) waitingAfter++;
    const finished: number[] = [];
    for (const j of active) {
      if (!running[j]) continue;
      busy += jobs[j].gpus;
      if (restoreLeft[j] > 0) {
        restoreLeft[j]--;
      } else {
        progress[j]++;
        qLeft[j] -= jobs[j].gpus;
      }
      if (progress[j] >= jobs[j].duration) {
        finish[j] = t + 1;
        running[j] = 0;
        release(j);
        finished.push(j);
        done++;
        ev.push(EV.finish, j, level[j]);
        continue;
      }
      ageStart[j] = t + 1;
      if (multilevel && qLeft[j] <= 0) {
        const L = Math.min(level[j] + 1, 2);
        level[j] = L;
        seq[j] = seqCtr++;
        qLeft[j] = quantumFor(L, cfg.quanta, dynamic, waitingAfter, cfg.ref);
        ev.push(EV.demote, j, L);
      }
    }
    if (finished.length) {
      const f = new Set(finished);
      active = active.filter((j) => !f.has(j));
    }
    t += 1;
    if (opts.trace) frames.push({ t, grid: grid.slice(), ev });
  }

  return {
    summary: summarizeGPU(cfg, policy, jobs, Array.from(finish), Array.from(maxWait), preemptions, busy),
    jobs,
    frames: opts.trace ? frames : undefined,
  };
}

function summarizeGPU(
  cfg: GPUConfig,
  policy: Policy,
  jobs: GPUJob[],
  finish: number[],
  maxWait: number[],
  preemptions: number,
  busy: number,
): GPUSummary {
  const shortJCT: number[] = [];
  const longJCT: number[] = [];
  const longWait: number[] = [];
  let last = 0;
  for (const j of jobs) {
    const jct = finish[j.id] - j.arrival;
    last = Math.max(last, finish[j.id]);
    if (j.gpus * j.duration > cfg.longCutoff) {
      longJCT.push(jct);
      longWait.push(maxWait[j.id]);
    } else shortJCT.push(jct);
  }
  const first = jobs.length ? jobs[0].arrival : 0;
  return {
    policy,
    n: jobs.length,
    shortMeanJCT: mean(shortJCT) / 60,
    longP95JCT: percentile(longJCT, 95) / 60,
    longestWaitLong: max(longWait) / 60,
    preemptions,
    utilisation: busy / (cfg.gpus * (last - first)),
    makespan: last / 60,
  };
}

/** Per-frame live meters for the GPU page; the last frame equals the run summary. */
export interface GPUMeters {
  shortJCT: Float64Array; // h, mean over short jobs finished so far
  longWait: Float64Array; // h, longest wait of a long job so far (incl. ongoing waits)
  preemptions: Int32Array;
  util: Float64Array; // 0..1 since first arrival
}

export function gpuMeters(cfg: GPUConfig, run: GPURun): GPUMeters {
  const frames = run.frames ?? [];
  const jobs = run.jobs;
  const F = frames.length;
  const m: GPUMeters = {
    shortJCT: new Float64Array(F),
    longWait: new Float64Array(F),
    preemptions: new Int32Array(F),
    util: new Float64Array(F),
  };
  const isLong = (j: number) => jobs[j].gpus * jobs[j].duration > cfg.longCutoff;
  const waitStart = new Float64Array(jobs.length);
  const waitingLong = new Set<number>();
  const first = jobs.length ? jobs[0].arrival : 0;
  let sum = 0;
  let cnt = 0;
  let maxWait = 0;
  let pre = 0;
  let busy = 0;
  for (let f = 0; f < F; f++) {
    const fr = frames[f];
    const s = fr.t - 1; // step start
    for (let k = 0; k < fr.ev.length; k += 3) {
      const code = fr.ev[k];
      const j = fr.ev[k + 1];
      if (code === EV.arrive) {
        waitStart[j] = jobs[j].arrival;
        if (isLong(j)) waitingLong.add(j);
      } else if (code === EV.preempt) {
        pre++;
        waitStart[j] = s;
        if (isLong(j)) waitingLong.add(j);
      } else if (code === EV_START) {
        if (isLong(j)) maxWait = Math.max(maxWait, s - waitStart[j]);
        waitingLong.delete(j);
      } else if (code === EV.finish) {
        busy += jobs[j].gpus;
        if (!isLong(j)) {
          sum += fr.t - jobs[j].arrival;
          cnt++;
        }
      }
    }
    for (const j of fr.grid) if (j >= 0) busy++;
    let ongoing = maxWait;
    for (const j of waitingLong) ongoing = Math.max(ongoing, s - waitStart[j]);
    m.shortJCT[f] = cnt ? sum / cnt / 60 : NaN;
    m.longWait[f] = ongoing / 60;
    m.preemptions[f] = pre;
    m.util[f] = busy / (cfg.gpus * (fr.t - first));
  }
  return m;
}
