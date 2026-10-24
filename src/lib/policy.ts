import type { Policy } from '@/engine/types';

export type Marker = 'square' | 'circle' | 'triangle' | 'diamond' | 'star';

export const POLICY_STYLE: Record<Policy, { color: string; marker: Marker; short: string; key: string }> = {
  FCFS: { color: 'var(--s-fcfs)', marker: 'square', short: 'FCFS', key: 'fcfs' },
  MLFQ: { color: 'var(--s-mlfq)', marker: 'circle', short: 'MLFQ', key: 'mlfq' },
  'Dynamic MLFQ': { color: 'var(--s-dynamic)', marker: 'triangle', short: 'Dynamic', key: 'dynamic' },
  'Aging MLFQ': { color: 'var(--s-aging)', marker: 'diamond', short: 'Aging', key: 'aging' },
  'DMFQ-A': { color: 'var(--s-dmfqa)', marker: 'star', short: 'DMFQ-A', key: 'dmfqa' },
};

export const LEVEL_COLOR = ['var(--q0)', 'var(--q1)', 'var(--q2)'] as const;
export const LEVEL_NAME = ['Q0', 'Q1', 'Q2'] as const;
