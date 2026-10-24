/** Shared engine types. Rules follow CLAUDE.md §5.1 (port of research/dmfqa_ai_sim.py). */

export type Policy = 'FCFS' | 'MLFQ' | 'Dynamic MLFQ' | 'Aging MLFQ' | 'DMFQ-A';

export const POLICIES: readonly Policy[] = ['FCFS', 'MLFQ', 'Dynamic MLFQ', 'Aging MLFQ', 'DMFQ-A'];
/** The CPU core study has no FCFS baseline. */
export const CPU_POLICIES: readonly Policy[] = ['MLFQ', 'Dynamic MLFQ', 'Aging MLFQ', 'DMFQ-A'];

export interface PolicyFlags {
  multilevel: boolean;
  dynamic: boolean;
  aging: boolean;
}

export const POLICY_FLAGS: Record<Policy, PolicyFlags> = {
  FCFS: { multilevel: false, dynamic: false, aging: false },
  MLFQ: { multilevel: true, dynamic: false, aging: false },
  'Dynamic MLFQ': { multilevel: true, dynamic: true, aging: false },
  'Aging MLFQ': { multilevel: true, dynamic: false, aging: true },
  'DMFQ-A': { multilevel: true, dynamic: true, aging: true },
};

/** Level indices 0..2. */
export type Level = 0 | 1 | 2;

// ───────────────────────────── LLM serving ─────────────────────────────

export interface LLMConfig {
  slots: number; // KV-cache slots (iteration-level batch size)
  quanta: [number, number, number]; // Q0 fixed, Q1/Q2 base (tokens)
  ref: number;
  aging: [number, number, number]; // ms of continuous waiting before promotion, per level (Q0 unused)
  stepBaseMs: number;
  stepPerSeqMs: number;
  prefillPerTokMs: number;
  swapPerTokMs: number;
  longCutoff: number; // output tokens; > cutoff counts as "long"
  // workload mix (synthetic)
  chatFrac: number;
  chatOutMedian: number;
  chatOutSigma: number;
  longOutMedian: number;
  longOutSigma: number;
  chatPromptMedian: number;
  longPromptMedian: number;
  promptSigma: number;
}

export interface LLMRequest {
  id: number;
  arrival: number; // ms
  prompt: number; // tokens
  output: number; // tokens (unknown to the scheduler)
  kind: 'chat' | 'long'; // generator class, for display only
}

export interface LLMSummary {
  policy: Policy;
  n: number;
  shortP99TTFT: number; // s
  shortMeanTTFT: number; // s
  longP99Latency: number; // s
  longestStallLong: number; // s
  meanLatencyPerToken: number; // ms
  swaps: number;
  throughput: number; // tokens/s
  makespan: number; // s
}

/** Event codes used in compact frames. */
export const EV = { arrive: 0, demote: 1, promote: 2, preempt: 3, finish: 4, resume: 5 } as const;
export type EventCode = (typeof EV)[keyof typeof EV];

/** One per engine step. `ev` is flat: [code, id, level, code, id, level, ...]. */
export interface Frame {
  t: number; // ms, end of step (tokens emitted at this time)
  slots: number[]; // slot -> request id, -1 = free
  ev: number[];
}

export interface LLMRun {
  summary: LLMSummary;
  requests: LLMRequest[];
  /** per-request time of first token (ms), NaN if never */
  firstToken: number[];
  finish: number[];
  frames?: Frame[];
}

// ───────────────────────────── GPU cluster ─────────────────────────────

export interface GPUConfig {
  gpus: number;
  quanta: [number, number, number]; // attained GPU-minutes
  ref: number;
  aging: [number, number, number]; // minutes
  restoreMin: number;
  longCutoff: number; // GPU-minutes
  sizes: number[];
  sizeProbs: number[];
  durMedian: number; // minutes
  durSigma: number;
  durCap: number; // minutes
}

export interface GPUJob {
  id: number;
  arrival: number; // minutes
  gpus: number;
  duration: number; // minutes of running on its gang
}

export interface GPUSummary {
  policy: Policy;
  n: number;
  shortMeanJCT: number; // h
  longP95JCT: number; // h
  longestWaitLong: number; // h
  preemptions: number;
  utilisation: number; // 0..1
  makespan: number; // h
}

export interface GPUFrame {
  t: number; // minute
  /** gpu index -> job id, -1 idle */
  grid: number[];
  ev: number[];
}

export interface GPURun {
  summary: GPUSummary;
  jobs: GPUJob[];
  frames?: GPUFrame[];
}

// ───────────────────────────── CPU core study ─────────────────────────────

export interface CPUConfig {
  quanta: [number, number, number]; // ms
  ref: number;
  aging: [number, number, number]; // ms
}

export interface CPUProcess {
  pid: string;
  arrival: number; // ms
  burst: number; // ms
}

export interface GanttSeg {
  pid: string;
  start: number;
  end: number;
  level: Level;
}

export interface CPUMark {
  t: number;
  pid: string;
  kind: 'promote' | 'preempt';
}

export interface CPUProcMetrics {
  pid: string;
  waiting: number;
  turnaround: number;
  response: number;
  maxReadyWait: number;
}

export interface CPUSummary {
  policy: Policy;
  avgWaiting: number;
  avgTurnaround: number;
  avgResponse: number;
  maxReadyWait: number;
  switches: number;
}

export interface CPURun {
  summary: CPUSummary;
  segments: GanttSeg[];
  marks: CPUMark[];
  perProcess: CPUProcMetrics[];
}
