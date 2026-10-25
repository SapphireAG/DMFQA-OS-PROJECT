'use client';
import { create } from 'zustand';
import { CPU_PRESETS, DEFAULT_CPU } from '@/engine/cpu';
import type { CPUConfig, CPUProcess } from '@/engine/types';

interface LabState {
  preset: string;
  procs: CPUProcess[];
  cfg: CPUConfig;
  set: (p: Partial<LabState>) => void;
}

export const useLab = create<LabState>((set) => ({
  preset: 'Textbook',
  procs: CPU_PRESETS.Textbook,
  cfg: DEFAULT_CPU,
  set: (p) => set(p),
}));
