import { describe, expect, it } from 'vitest';
import { dynQuantum, quantumFor } from '@/engine/quantum';
import { makeRng } from '@/engine/rng';
import { percentile } from '@/engine/metrics';
import { DEFAULT_LLM, genLLMWorkload, llmMeters, simulateLLM } from '@/engine/llm';
import { DEFAULT_GPU, genGPUWorkload, gpuMeters, simulateGPU } from '@/engine/gpu';
import { CPU_PRESETS, DEFAULT_CPU, simulateCPU } from '@/engine/cpu';
import { CPU_POLICIES, POLICIES, type LLMRequest } from '@/engine/types';

describe('dynQuantum', () => {
  it('follows q = min(2b, b + floor(b·min(R, ref)/ref))', () => {
    expect(dynQuantum(8, 0, 8)).toBe(8);
    expect(dynQuantum(8, 3, 8)).toBe(11);
    expect(dynQuantum(8, 8, 8)).toBe(16);
    expect(dynQuantum(8, 50, 8)).toBe(16);
    expect(dynQuantum(16, 5, 8)).toBe(26);
    expect(dynQuantum(32, 1, 8)).toBe(36);
  });
  it('keeps Q0 fixed and ignores R when dynamic quanta are off', () => {
    expect(quantumFor(0, [4, 8, 16], true, 8, 8)).toBe(4);
    expect(quantumFor(2, [4, 8, 16], false, 8, 8)).toBe(16);
    expect(quantumFor(2, [4, 8, 16], true, 8, 8)).toBe(32);
  });
});

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = makeRng(11);
    const b = makeRng(11);
    for (let i = 0; i < 100; i++) expect(a.normal()).toBe(b.normal());
  });
  it('matches the expected first draws of mulberry32(1)', () => {
    const r = makeRng(1);
    expect(r.next()).toBeCloseTo(0.6270739405881613, 12);
  });
});

describe('percentile', () => {
  it('interpolates linearly like numpy', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([10], 99)).toBe(10);
    expect(percentile([0, 100], 99)).toBe(99);
  });
});

const req = (id: number, arrival: number, output: number, prompt = 10): LLMRequest => ({
  id,
  arrival,
  output,
  prompt,
  kind: output > 512 ? 'long' : 'chat',
});

describe('LLM engine rules', () => {
  const cfg = { ...DEFAULT_LLM, slots: 1 };

  it('FCFS never preempts: a long head blocks a later chat', () => {
    const r = simulateLLM(cfg, 'FCFS', [req(0, 0, 600), req(1, 1, 5)]);
    expect(r.summary.swaps).toBe(0);
    expect(r.firstToken[1]).toBeGreaterThan(r.finish[0] - 1e-9);
  });

  it('MLFQ demotes after the Q0 budget and lets the chat preempt', () => {
    const r = simulateLLM(cfg, 'MLFQ', [req(0, 0, 600), req(1, 1, 5)], { trace: true });
    expect(r.finish[1]).toBeLessThan(r.finish[0]);
    expect(r.summary.swaps).toBeGreaterThan(0);
    const demotes = r.frames!.flatMap((f) => (f.ev.includes(1) ? [f] : []));
    expect(demotes.length).toBeGreaterThan(0);
  });

  it('every batched request gains exactly one token per step', () => {
    const w = genLLMWorkload(DEFAULT_LLM, { rate: 2, n: 120, seed: 11 });
    for (const p of POLICIES) {
      const r = simulateLLM(DEFAULT_LLM, p, w, { trace: true });
      let tokens = 0;
      for (const f of r.frames!) {
        tokens += f.slots.filter((s) => s >= 0).length;
        for (let k = 0; k < f.ev.length; k += 3) if (f.ev[k] === 4) tokens++;
      }
      expect(tokens).toBe(w.reduce((s, q) => s + q.output, 0));
    }
  });

  it('aging policies equal their twins when nothing waits past a threshold', () => {
    const w = [req(0, 0, 40), req(1, 5000, 40), req(2, 10000, 40)];
    expect(simulateLLM(DEFAULT_LLM, 'Aging MLFQ', w).summary).toEqual({
      ...simulateLLM(DEFAULT_LLM, 'MLFQ', w).summary,
      policy: 'Aging MLFQ',
    });
  });

  it('is deterministic for a seed', () => {
    const w = genLLMWorkload(DEFAULT_LLM, { rate: 2.2, n: 200, seed: 23 });
    expect(simulateLLM(DEFAULT_LLM, 'DMFQ-A', w).summary).toEqual(
      simulateLLM(DEFAULT_LLM, 'DMFQ-A', w).summary,
    );
  });

  it('live meters at the last frame equal the summary', () => {
    const w = genLLMWorkload(DEFAULT_LLM, { rate: 2.0, n: 300, seed: 11 });
    for (const p of POLICIES) {
      const run = simulateLLM(DEFAULT_LLM, p, w, { trace: true });
      const m = llmMeters(DEFAULT_LLM, run);
      const L = run.frames!.length - 1;
      expect(m.p99[L]).toBeCloseTo(run.summary.shortP99TTFT, 9);
      expect(m.stall[L]).toBeCloseTo(run.summary.longestStallLong, 9);
      expect(m.swaps[L]).toBe(run.summary.swaps);
      expect(m.tps[L]).toBeCloseTo(run.summary.throughput, 6);
    }
  });

  it('runs 400 requests in under 300 ms', () => {
    const w = genLLMWorkload(DEFAULT_LLM, { rate: 2.2, n: 400, seed: 11 });
    const t0 = performance.now();
    simulateLLM(DEFAULT_LLM, 'DMFQ-A', w, { trace: true });
    expect(performance.now() - t0).toBeLessThan(300);
  });
});

describe('GPU engine rules', () => {
  it('FCFS is strict FIFO: a 16-GPU head blocks smaller jobs behind it', () => {
    const cfg = { ...DEFAULT_GPU, gpus: 16 };
    const jobs = [
      { id: 0, arrival: 0, gpus: 8, duration: 100 },
      { id: 1, arrival: 1, gpus: 16, duration: 10 },
      { id: 2, arrival: 2, gpus: 1, duration: 10 },
    ];
    const r = simulateGPU(cfg, 'FCFS', jobs, { trace: true });
    // job 2 cannot start before the head (job 1) does, although 8 GPUs sit idle
    const startOf = (id: number) => r.frames!.findIndex((f) => f.grid.includes(id));
    expect(startOf(2)).toBeGreaterThanOrEqual(startOf(1));
    // multilevel policies backfill instead
    const m = simulateGPU(cfg, 'MLFQ', jobs, { trace: true });
    expect(m.frames!.findIndex((f) => f.grid.includes(2))).toBeLessThan(startOf(1));
  });

  it('places gangs all-or-nothing', () => {
    const w = genGPUWorkload(DEFAULT_GPU, { rate: 6, n: 120, seed: 11 });
    const r = simulateGPU(DEFAULT_GPU, 'DMFQ-A', w, { trace: true });
    for (const f of r.frames!) {
      const count = new Map<number, number>();
      for (const j of f.grid) if (j >= 0) count.set(j, (count.get(j) ?? 0) + 1);
      for (const [j, c] of count) expect(c).toBe(w[j].gpus);
    }
  });

  it('live meters at the last frame equal the summary', () => {
    const w = genGPUWorkload(DEFAULT_GPU, { rate: 6, n: 200, seed: 23 });
    for (const p of POLICIES) {
      const run = simulateGPU(DEFAULT_GPU, p, w, { trace: true });
      const m = gpuMeters(DEFAULT_GPU, run);
      const L = run.frames!.length - 1;
      expect(m.shortJCT[L]).toBeCloseTo(run.summary.shortMeanJCT, 9);
      expect(m.longWait[L]).toBeCloseTo(run.summary.longestWaitLong, 9);
      expect(m.preemptions[L]).toBe(run.summary.preemptions);
      expect(m.util[L]).toBeCloseTo(run.summary.utilisation, 9);
    }
  });

  it('completes every job for every policy', () => {
    const w = genGPUWorkload(DEFAULT_GPU, { rate: 6, n: 150, seed: 37 });
    for (const p of POLICIES) expect(simulateGPU(DEFAULT_GPU, p, w).summary.n).toBe(150);
  });
});

describe('CPU engine rules', () => {
  it('produces a Gantt that covers each burst exactly', () => {
    for (const [, procs] of Object.entries(CPU_PRESETS)) {
      for (const p of CPU_POLICIES) {
        const r = simulateCPU(DEFAULT_CPU, p, procs);
        for (const proc of procs) {
          const ran = r.segments.filter((s) => s.pid === proc.pid).reduce((s, g) => s + g.end - g.start, 0);
          expect(ran).toBe(proc.burst);
        }
      }
    }
  });

  it('demotes a CPU-bound job Q0 → Q1 → Q2 after 4 ms and 8 ms', () => {
    const r = simulateCPU(DEFAULT_CPU, 'MLFQ', [{ pid: 'A', arrival: 0, burst: 30 }]);
    expect(r.segments.map((s) => [s.level, s.end - s.start])).toEqual([
      [0, 4],
      [1, 8],
      [2, 18],
    ]);
  });

  it('only aging policies promote', () => {
    const procs = CPU_PRESETS['Heavy CPU'];
    expect(simulateCPU(DEFAULT_CPU, 'MLFQ', procs).marks.some((m) => m.kind === 'promote')).toBe(false);
    expect(simulateCPU(DEFAULT_CPU, 'DMFQ-A', procs).marks.some((m) => m.kind === 'promote')).toBe(true);
  });
});
