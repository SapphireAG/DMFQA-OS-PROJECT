/**
 * Parity against the Python reference (CLAUDE.md §5.2). Feeds the exact workloads stored in
 * research/golden/*.json to the TS engines and compares every summary field (rel. tol 1e-6).
 *
 * Expected fixture shape (written by research/export_golden.py):
 *   { "kind": "llm" | "gpu" | "cpu", "policy": Policy, "config"?: Partial<Config>,
 *     "workload": LLMRequest[] | GPUJob[] | CPUProcess[], "summary": { field: number } }
 * Field names in "summary" must match LLMSummary / GPUSummary / CPUSummary.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM, simulateLLM } from '@/engine/llm';
import { DEFAULT_GPU, simulateGPU } from '@/engine/gpu';
import { DEFAULT_CPU, simulateCPU } from '@/engine/cpu';

const dir = path.resolve(__dirname, '../research/golden');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];

describe.skipIf(files.length === 0)('parity with research/golden', () => {
  for (const f of files) {
    it(f, () => {
      const g = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const summary: Record<string, unknown> =
        g.kind === 'llm'
          ? simulateLLM({ ...DEFAULT_LLM, ...g.config }, g.policy, g.workload).summary
          : g.kind === 'gpu'
            ? simulateGPU({ ...DEFAULT_GPU, ...g.config }, g.policy, g.workload).summary
            : simulateCPU({ ...DEFAULT_CPU, ...g.config }, g.policy, g.workload).summary;
      for (const [k, want] of Object.entries(g.summary as Record<string, number>)) {
        const got = summary[k] as number;
        expect(got, `${f}: ${k}`).toBeTypeOf('number');
        expect(Math.abs(got - want), `${f}: ${k} got ${got}, want ${want}`).toBeLessThanOrEqual(
          1e-6 * Math.max(1, Math.abs(want)),
        );
      }
    });
  }
});

it.runIf(files.length === 0)('golden fixtures are missing — parity not yet verified', () => {
  console.warn('research/golden/*.json not found: run `python research/export_golden.py`.');
});
