/** Engine API exposed to the UI through a comlink Web Worker (CLAUDE.md §5.3). */
import { genLLMWorkload, llmMeters, mergeRequests, simulateLLM, type LLMMeters } from './llm';
import { genGPUWorkload, simulateGPU } from './gpu';
import { simulateCPU } from './cpu';
import type {
  CPUConfig,
  CPUProcess,
  CPURun,
  Frame,
  GPUConfig,
  GPUFrame,
  GPUJob,
  GPUSummary,
  LLMConfig,
  LLMRequest,
  LLMSummary,
  Policy,
} from './types';

export interface LLMRunOpts {
  rate: number;
  n: number;
  seed: number;
  trace?: boolean;
  /** extra requests injected by the demo controls (arrival in ms) */
  extra?: Omit<LLMRequest, 'id'>[];
}

export interface LLMRunResult {
  summary: LLMSummary;
  frames?: Frame[];
  requests: LLMRequest[];
  firstToken: number[];
  meters?: LLMMeters;
}

export interface GPURunResult {
  summary: GPUSummary;
  jobs: GPUJob[];
  frames?: GPUFrame[];
}

export interface LLMSweepRow extends LLMSummary {
  rate: number;
  seed: number;
}

function llmWorkload(cfg: LLMConfig, o: LLMRunOpts) {
  const base = genLLMWorkload(cfg, o);
  return o.extra?.length ? mergeRequests(base, o.extra) : base;
}

export const api = {
  runLLM(cfg: LLMConfig, policy: Policy, opts: LLMRunOpts): LLMRunResult {
    const run = simulateLLM(cfg, policy, llmWorkload(cfg, opts), { trace: opts.trace });
    return {
      summary: run.summary,
      frames: run.frames,
      requests: run.requests,
      firstToken: run.firstToken,
      meters: opts.trace ? llmMeters(cfg, run) : undefined,
    };
  },

  runLLMMany(cfg: LLMConfig, policies: Policy[], opts: LLMRunOpts): LLMRunResult[] {
    return policies.map((p) => api.runLLM(cfg, p, opts));
  },

  runGPU(
    cfg: GPUConfig,
    policy: Policy,
    opts: { rate: number; n: number; seed: number; trace?: boolean },
  ): GPURunResult {
    const run = simulateGPU(cfg, policy, genGPUWorkload(cfg, opts), { trace: opts.trace });
    return { summary: run.summary, jobs: run.jobs, frames: run.frames };
  },

  runCPU(cfg: CPUConfig, policy: Policy, procs: CPUProcess[]): CPURun {
    return simulateCPU(cfg, policy, procs);
  },

  sweepLLM(
    cfg: LLMConfig,
    rates: number[],
    seeds: number[],
    policies: Policy[],
    n: number,
    onProgress?: (done: number, total: number) => void,
  ): LLMSweepRow[] {
    const rows: LLMSweepRow[] = [];
    const total = rates.length * seeds.length;
    let done = 0;
    for (const rate of rates) {
      for (const seed of seeds) {
        const reqs = genLLMWorkload(cfg, { rate, n, seed });
        for (const p of policies) rows.push({ ...simulateLLM(cfg, p, reqs).summary, rate, seed });
        onProgress?.(++done, total);
      }
    }
    return rows;
  },
};

export type EngineAPI = typeof api;
