import { DEFAULT_LLM, genLLMWorkload, simulateLLM } from '../src/engine/llm';
import { DEFAULT_GPU, genGPUWorkload, simulateGPU } from '../src/engine/gpu';
import { POLICIES } from '../src/engine/types';
const seeds = [11, 23, 37, 41, 53];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
for (const rate of [1.4, 2.0, 2.2]) {
  console.log(`LLM rate ${rate}`);
  for (const p of POLICIES) {
    const s = seeds.map((seed) => simulateLLM(DEFAULT_LLM, p, genLLMWorkload(DEFAULT_LLM, { rate, n: 1500, seed })).summary);
    console.log(p.padEnd(13), ['shortP99TTFT', 'longP99Latency', 'longestStallLong', 'meanLatencyPerToken', 'swaps', 'throughput'].map((k) => `${k}=${avg(s.map((x: any) => x[k])).toFixed(2)}`).join(' '));
  }
}
for (const rate of [6]) {
  console.log(`GPU rate ${rate}`);
  for (const p of POLICIES) {
    const s = seeds.map((seed) => simulateGPU(DEFAULT_GPU, p, genGPUWorkload(DEFAULT_GPU, { rate, n: 500, seed })).summary);
    console.log(p.padEnd(13), ['shortMeanJCT', 'longP95JCT', 'longestWaitLong', 'preemptions', 'utilisation'].map((k) => `${k}=${avg(s.map((x: any) => x[k])).toFixed(2)}`).join(' '));
  }
}
