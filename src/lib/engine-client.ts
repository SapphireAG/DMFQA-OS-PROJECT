'use client';
import { wrap, type Remote } from 'comlink';
import type { EngineAPI } from '@/engine/api';

let engine: Remote<EngineAPI> | null = null;

/** Lazily starts the simulation Web Worker (one per tab). */
export function getEngine(): Remote<EngineAPI> {
  if (!engine) {
    const w = new Worker(new URL('../engine/worker.ts', import.meta.url), { type: 'module' });
    engine = wrap<EngineAPI>(w);
  }
  return engine;
}
