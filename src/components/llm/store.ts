'use client';
import { create } from 'zustand';
import type { LLMRunResult } from '@/engine/api';
import type { LLMRequest, Policy } from '@/engine/types';

export type Mode = Policy | 'race';
export type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'done';

interface LLMState {
  rate: number;
  seed: number;
  n: number;
  mode: Mode;
  speed: 1 | 4 | 16;
  extra: Omit<LLMRequest, 'id'>[];
  runs: Partial<Record<Policy, LLMRunResult>>;
  /** arrivals (ms) of the four watched requests, stable across injections */
  watch: number[];
  status: Status;
  simT: number; // ms
  endT: number; // ms
  set: (p: Partial<LLMState>) => void;
}

export const useLLM = create<LLMState>((set) => ({
  rate: 2.2,
  seed: 11,
  n: 400,
  mode: 'DMFQ-A',
  speed: 4,
  extra: [],
  runs: {},
  watch: [],
  status: 'idle',
  simT: 0,
  endT: 0,
  set: (p) => set(p),
}));
