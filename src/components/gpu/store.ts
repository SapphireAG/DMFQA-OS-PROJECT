'use client';
import { create } from 'zustand';
import type { GPURunResult } from '@/engine/api';
import type { Policy } from '@/engine/types';

export type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'done';

interface GPUState {
  rate: number;
  seed: number;
  n: number;
  policy: Policy;
  speed: 1 | 4 | 16;
  runs: Partial<Record<Policy, GPURunResult>>;
  status: Status;
  simT: number; // minutes
  endT: number;
  set: (p: Partial<GPUState>) => void;
}

export const useGPU = create<GPUState>((set) => ({
  rate: 6,
  seed: 11,
  n: 200,
  policy: 'DMFQ-A',
  speed: 4,
  runs: {},
  status: 'idle',
  simT: 0,
  endT: 0,
  set: (p) => set(p),
}));
