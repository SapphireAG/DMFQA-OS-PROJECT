/**
 * Build-time data loading (server components only). Reads the CSVs in /data; these values
 * are rendered into the static export, never typed into components.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Policy } from '@/engine/types';

export type Row = Record<string, string | number> & { policy: Policy };

export function readCsv(rel: string): Row[] {
  const file = path.join(process.cwd(), rel);
  if (!fs.existsSync(file)) return [];
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    const row: Record<string, string | number> = {};
    cols.forEach((c, i) => {
      const v = cells[i];
      row[c] = v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v;
    });
    return row as Row;
  });
}

export const reportLLM = () => readCsv('data/report_llm_2p0.csv');
export const reportGPU = () => readCsv('data/report_gpu_6jph.csv');
export const tsLLMSweep = () => readCsv('data/ts_llm_sweep.csv');
export const tsGPUSweep = () => readCsv('data/ts_gpu_sweep.csv');

export const by = (rows: Row[], policy: Policy) => rows.find((r) => r.policy === policy)!;

/** Headline numbers for the Overview, computed from the report CSVs. */
export function headline() {
  const llm = reportLLM();
  const gpu = reportGPU();
  const fcfs = by(llm, 'FCFS');
  const dm = by(llm, 'DMFQ-A');
  const ml = by(llm, 'MLFQ');
  const gF = by(gpu, 'FCFS');
  const gD = by(gpu, 'DMFQ-A');
  return {
    ttftRatio: (fcfs.short_p99_ttft_s as number) / (dm.short_p99_ttft_s as number),
    ttftFrom: fcfs.short_p99_ttft_s as number,
    ttftTo: dm.short_p99_ttft_s as number,
    llmRate: fcfs.rate as number,
    waitFrom: gF.longest_wait_long_h as number,
    waitTo: gD.longest_wait_long_h as number,
    gpuRate: gF.rate as number,
    swapDelta: (dm.swaps as number) / (ml.swaps as number) - 1,
    swapsMLFQ: ml.swaps as number,
    swapsDMFQA: dm.swaps as number,
  };
}
