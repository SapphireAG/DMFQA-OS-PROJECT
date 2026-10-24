/**
 * Writes data/ts_llm_sweep.csv and data/ts_gpu_sweep.csv: the TypeScript engine (the code the
 * browser runs), mean of 5 seeds per load point, same seeds as the report. Run: pnpm sweep
 */
import fs from 'node:fs';
import { DEFAULT_LLM, genLLMWorkload, simulateLLM } from '../src/engine/llm';
import { DEFAULT_GPU, genGPUWorkload, simulateGPU } from '../src/engine/gpu';
import { POLICIES } from '../src/engine/types';

const SEEDS = [11, 23, 37, 41, 53];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r = (v: number, d = 4) => Number(v.toFixed(d));

const llmCols = ['shortP99TTFT', 'longP99Latency', 'longestStallLong', 'meanLatencyPerToken', 'swaps', 'throughput'] as const;
const llm = ['policy,rate,n,seeds,' + llmCols.join(',')];
for (const rate of [1.4, 1.6, 1.8, 2.0, 2.2]) {
  const works = SEEDS.map((seed) => genLLMWorkload(DEFAULT_LLM, { rate, n: 1500, seed }));
  for (const p of POLICIES) {
    const s = works.map((w) => simulateLLM(DEFAULT_LLM, p, w).summary);
    llm.push([p, rate, 1500, SEEDS.length, ...llmCols.map((k) => r(avg(s.map((x) => x[k]))))].join(','));
  }
  console.log('llm', rate);
}
fs.writeFileSync('data/ts_llm_sweep.csv', llm.join('\n') + '\n');

const gpuCols = ['shortMeanJCT', 'longP95JCT', 'longestWaitLong', 'preemptions', 'utilisation'] as const;
const gpu = ['policy,rate,n,seeds,' + gpuCols.join(',')];
for (const rate of [5, 6, 7]) {
  const works = SEEDS.map((seed) => genGPUWorkload(DEFAULT_GPU, { rate, n: 500, seed }));
  for (const p of POLICIES) {
    const s = works.map((w) => simulateGPU(DEFAULT_GPU, p, w).summary);
    gpu.push([p, rate, 500, SEEDS.length, ...gpuCols.map((k) => r(avg(s.map((x) => x[k]))))].join(','));
  }
  console.log('gpu', rate);
}
fs.writeFileSync('data/ts_gpu_sweep.csv', gpu.join('\n') + '\n');
