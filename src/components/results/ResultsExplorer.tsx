'use client';
import { useMemo, useState } from 'react';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { Scatter } from '@/components/charts/Scatter';
import { MarkerSwatch } from '@/components/charts/Marker';
import { Figure } from '@/components/editorial/Figure';
import { Kicker } from '@/components/editorial/Kicker';
import { Segmented } from '@/components/ui/Segmented';
import { Button } from '@/components/ui/Button';
import { SyntheticTag } from '@/components/ui/Tag';
import { DEFAULT_LLM } from '@/engine/llm';
import { POLICIES, type Policy } from '@/engine/types';
import { getEngine } from '@/lib/engine-client';
import { fmt, hours, secAuto } from '@/lib/format';
import { POLICY_STYLE } from '@/lib/policy';
import type { Row } from '@/lib/data';

type Source = 'report' | 'ts';
const SEEDS = [11, 23, 37, 41, 53];
const LLM_RATES = [1.4, 1.6, 1.8, 2.0, 2.2];
const GPU_RATES = [5, 6, 7];

/** Normalised rows so charts read one shape regardless of source. */
interface LLMRow {
  policy: Policy;
  rate: number;
  ttft: number;
  longP99: number;
  stall: number;
  swaps: number;
}
interface GPURow {
  policy: Policy;
  rate: number;
  shortJCT: number;
  wait: number;
  preempt: number;
}

const fromReportLLM = (r: Row): LLMRow => ({
  policy: r.policy,
  rate: r.rate as number,
  ttft: r.short_p99_ttft_s as number,
  longP99: r.long_p99_latency_s as number,
  stall: r.longest_stall_long_s as number,
  swaps: r.swaps as number,
});
const fromTsLLM = (r: Row): LLMRow => ({
  policy: r.policy,
  rate: r.rate as number,
  ttft: r.shortP99TTFT as number,
  longP99: r.longP99Latency as number,
  stall: r.longestStallLong as number,
  swaps: r.swaps as number,
});
const fromReportGPU = (r: Row): GPURow => ({
  policy: r.policy,
  rate: r.rate as number,
  shortJCT: r.short_mean_jct_h as number,
  wait: r.longest_wait_long_h as number,
  preempt: r.preemptions as number,
});
const fromTsGPU = (r: Row): GPURow => ({
  policy: r.policy,
  rate: r.rate as number,
  shortJCT: r.shortMeanJCT as number,
  wait: r.longestWaitLong as number,
  preempt: r.preemptions as number,
});

const get = <T extends { policy: Policy }>(rows: T[], p: Policy) => rows.find((r) => r.policy === p);

export function ResultsExplorer({
  reportLLM,
  reportGPU,
  sweepLLM,
  sweepGPU,
}: {
  reportLLM: Row[];
  reportGPU: Row[];
  sweepLLM: Row[];
  sweepGPU: Row[];
}) {
  const [source, setSource] = useState<Source>('report');
  const [llmRate, setLlmRate] = useState(2.0);
  const [gpuRate, setGpuRate] = useState(6);
  const [shown, setShown] = useState<Set<Policy>>(new Set(POLICIES));
  const [live, setLive] = useState<LLMRow[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const tsLLM = useMemo(() => live ?? sweepLLM.map(fromTsLLM), [live, sweepLLM]);
  const llmAll = source === 'report' ? reportLLM.map(fromReportLLM) : tsLLM;
  const gpuAll = source === 'report' ? reportGPU.map(fromReportGPU) : sweepGPU.map(fromTsGPU);
  const rateL = source === 'report' ? 2.0 : llmRate;
  const rateG = source === 'report' ? 6 : gpuRate;
  const llmAt = llmAll.filter((r) => r.rate === rateL);
  const gpuAt = gpuAll.filter((r) => r.rate === rateG);
  const vis = <T extends { policy: Policy }>(rows: T[]) => POLICIES.filter((p) => shown.has(p)).map((p) => get(rows, p)).filter(Boolean) as T[];

  const srcLine =
    source === 'report'
      ? 'Synthetic workload · Python reference simulator (Final Review Report) · mean of 5 seeds'
      : `Synthetic workload · TypeScript engine (in-browser port) · mean of 5 seeds (${SEEDS.join(', ')})`;
  const csv = (name: string) => `dmfqa-${name}-${source}.csv`;

  // Finding titles are computed from all policies at the selected load (not the filtered view).
  const L = (p: Policy) => get(llmAt, p)!;
  const G = (p: Policy) => get(gpuAt, p)!;
  const ttftRatio = L('FCFS').ttft / L('DMFQ-A').ttft;
  const swapCut = 1 - L('DMFQ-A').swaps / L('MLFQ').swaps;
  const satRows = tsLLM.filter((r) => r.rate === 2.2);
  const sat = (p: Policy) => get(satRows, p)!;

  const toggle = (p: Policy) =>
    setShown((s) => {
      const n = new Set(s);
      if (n.has(p) && n.size > 1) n.delete(p);
      else n.add(p);
      return n;
    });

  const rerun = async () => {
    setProgress('Starting…');
    const rows = await getEngine().sweepLLM(
      DEFAULT_LLM,
      LLM_RATES,
      SEEDS,
      [...POLICIES],
      1500,
      // comlink proxies functions passed through postMessage
      (await import('comlink')).proxy((d: number, t: number) => setProgress(`${d} / ${t} workloads`)),
    );
    const out: LLMRow[] = [];
    for (const rate of LLM_RATES)
      for (const p of POLICIES) {
        const s = rows.filter((r) => r.rate === rate && r.policy === p);
        const m = (k: 'shortP99TTFT' | 'longP99Latency' | 'longestStallLong' | 'swaps') => s.reduce((a, r) => a + r[k], 0) / s.length;
        out.push({ policy: p, rate, ttft: m('shortP99TTFT'), longP99: m('longP99Latency'), stall: m('longestStallLong'), swaps: m('swaps') });
      }
    setLive(out);
    setSource('ts');
    setProgress(null);
  };

  return (
    <div className="page">
      {/* Controls */}
      <div className="sticky top-[44px] z-30 -mx-4 border-y border-hairline bg-paper px-4 py-4 sm:-mx-6 sm:px-6 md:top-[45px]">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-3">
            <span className="kicker text-stone">Source</span>
            <Segmented<Source>
              label="Data source"
              value={source}
              onChange={setSource}
              options={[
                { value: 'report', label: 'Python reference' },
                { value: 'ts', label: 'TS engine' },
              ]}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="kicker text-stone">LLM load</span>
            <Segmented<number>
              label="LLM arrival rate"
              value={rateL}
              onChange={setLlmRate}
              disabled={source === 'report'}
              options={LLM_RATES.map((r) => ({ value: r, label: `${r.toFixed(1)} req/s` }))}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="kicker text-stone">GPU load</span>
            <Segmented<number>
              label="GPU arrival rate"
              value={rateG}
              onChange={setGpuRate}
              disabled={source === 'report'}
              options={GPU_RATES.map((r) => ({ value: r, label: `${r} jobs/h` }))}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Policies shown">
          {POLICIES.map((p) => {
            const st = POLICY_STYLE[p];
            const on = shown.has(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p)}
                className={`flex items-center gap-1.5 border px-2.5 py-1 text-[13px] ${on ? 'border-ink text-ink' : 'border-hairline text-stone line-through'}`}
              >
                <MarkerSwatch shape={st.marker} color={st.color} />
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-start justify-between gap-4 border border-hairline bg-paper-2 p-5 text-[15px]">
        <div className="max-w-3xl">
          <p className="kicker text-stone">Data source</p>
          <p className="mt-1 text-ink-2">
            <strong className="text-ink">Python reference:</strong> the tables in the Final Review Report (§8.1 at 2.0
            req/s, §8.4 at 6 jobs/h): Python reference simulator, 5 seeds per point, synthetic workloads; source scripts
            in <code className="num text-[14px]">research/</code>.{' '}
            <strong className="text-ink">TS engine:</strong> the same rules as ported to TypeScript and run in your
            browser on the live pages, swept over every load point. The two use different random streams, so absolute
            values differ; compare the orderings.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2">
          <SyntheticTag />
          <Button variant="quiet" onClick={rerun} disabled={progress !== null}>
            {progress ? `Re-running… ${progress}` : 'Re-run the LLM sweep in this browser'}
          </Button>
          {live && <p className="text-[13px] text-stone">Showing the sweep just computed in this tab.</p>}
        </div>
      </div>

      {/* LLM */}
      <section className="mt-20" aria-labelledby="llm-h">
        <Kicker tone="stone">LLM inference serving · 16 KV slots</Kicker>
        <h2 id="llm-h" className="mt-2 text-[30px] md:text-h2">
          At {rateL.toFixed(1)} req/s
        </h2>
        <div className="mt-10 grid gap-16 lg:grid-cols-2">
          <div id="llm-ttft" className="scroll-mt-48">
            <Figure n={1} caption="Short requests (≤ 512 output tokens), p99 time to first token. Lower is better." source={srcLine}>
              <BarChart
                title={`Feedback queues cut short-chat p99 TTFT ${fmt(ttftRatio, 0)}×: ${secAuto(L('FCFS').ttft)} → ${secAuto(L('DMFQ-A').ttft)}`}
                data={vis(llmAt).map((r) => ({ policy: r.policy, value: r.ttft }))}
                format={secAuto}
                unitLabel="p99 TTFT (s)"
                csvName={csv(`llm-ttft-${rateL}`)}
              />
            </Figure>
          </div>
          <Figure n={2} caption="Long requests (> 512 output tokens), p99 end-to-end latency. The price of serving chats first." source={srcLine}>
            <BarChart
              title={`The cost: long requests finish later, p99 ${secAuto(L('FCFS').longP99)} under FCFS vs ${secAuto(L('DMFQ-A').longP99)} under DMFQ-A`}
              data={vis(llmAt).map((r) => ({ policy: r.policy, value: r.longP99 }))}
              format={secAuto}
              unitLabel="p99 latency (s)"
              csvName={csv(`llm-long-p99-${rateL}`)}
            />
          </Figure>
          <div id="llm-swaps" className="scroll-mt-48 lg:col-span-2">
            <Figure n={3} caption="Each point is one policy: KV-cache swaps (x) against the longest stall of any long request (y). Lower-left is better." source={srcLine}>
              <Scatter
                title={`DMFQ-A sits between: ${fmt(swapCut * 100, 0)}% fewer swaps than MLFQ with a ${secAuto(L('DMFQ-A').stall)} longest stall (Dynamic: ${secAuto(L('Dynamic MLFQ').stall)})`}
                points={vis(llmAt).map((r) => ({ policy: r.policy, x: r.swaps, y: r.stall }))}
                xLabel="KV swaps"
                yLabel="Longest stall (s)"
                formatX={(v) => `${fmt(v, 0)} swaps`}
                formatY={secAuto}
                csvName={csv(`llm-swap-stall-${rateL}`)}
              />
            </Figure>
          </div>
          <Figure
            n={4}
            caption="Longest stall of a long request against arrival rate. At low load no request waits long enough to age, so each aging policy matches its twin."
            source="Synthetic workload · TypeScript engine · mean of 5 seeds per point"
          >
            <LineChart
              title={`Aging bounds the stall: ${secAuto(sat('DMFQ-A').stall)} for DMFQ-A vs ${secAuto(sat('Dynamic MLFQ').stall)} for Dynamic MLFQ at 2.2 req/s`}
              series={vis(tsLLM.filter((r) => r.rate === 2.2)).map((r) => ({
                policy: r.policy,
                points: tsLLM.filter((x) => x.policy === r.policy).map((x) => ({ x: x.rate, y: x.stall })),
              }))}
              xLabel="Arrival rate (req/s)"
              yLabel="Longest stall (s)"
              formatX={(v) => `${v.toFixed(1)} req/s`}
              formatY={secAuto}
              csvName="dmfqa-llm-stall-vs-load-ts.csv"
            />
          </Figure>
          <Figure
            n={5}
            caption="KV-cache swaps against arrival rate. Near saturation, promoted requests evict others that are promoted in turn."
            source="Synthetic workload · TypeScript engine · mean of 5 seeds per point"
          >
            <LineChart
              title={`Fixed aging thresholds thrash near saturation: DMFQ-A swaps ${fmt(sat('DMFQ-A').swaps / sat('Dynamic MLFQ').swaps, 1)}× Dynamic MLFQ at 2.2 req/s`}
              series={vis(tsLLM.filter((r) => r.rate === 2.2)).map((r) => ({
                policy: r.policy,
                points: tsLLM.filter((x) => x.policy === r.policy).map((x) => ({ x: x.rate, y: x.swaps })),
              }))}
              xLabel="Arrival rate (req/s)"
              yLabel="KV swaps"
              formatX={(v) => `${v.toFixed(1)} req/s`}
              formatY={(v) => `${fmt(v, 0)} swaps`}
              csvName="dmfqa-llm-swaps-vs-load-ts.csv"
            />
          </Figure>
        </div>
      </section>

      {/* GPU */}
      <section className="mt-28" aria-labelledby="gpu-h">
        <Kicker tone="stone">GPU training cluster · 64 GPUs, gang placement</Kicker>
        <h2 id="gpu-h" className="mt-2 text-[30px] md:text-h2">
          At {rateG} jobs/h
        </h2>
        <div className="mt-10 grid gap-16 lg:grid-cols-3">
          <Figure n={6} caption="Mean job completion time of short jobs (≤ 960 GPU-minutes)." source={srcLine}>
            <BarChart
              title={`Strict FIFO lets one gang job block the rest: short-job JCT ${hours(G('FCFS').shortJCT)} vs ${hours(G('DMFQ-A').shortJCT)}`}
              data={vis(gpuAt).map((r) => ({ policy: r.policy, value: r.shortJCT }))}
              format={(v) => hours(v)}
              unitLabel="Mean JCT (h)"
              csvName={csv(`gpu-short-jct-${rateG}`)}
            />
          </Figure>
          <div id="gpu-wait" className="scroll-mt-48">
            <Figure n={7} caption="Longest continuous wait of any long job (> 960 GPU-minutes)." source={srcLine}>
              <BarChart
                title={`Aging bounds the wait for big jobs: ${hours(G('FCFS').wait)} under FCFS, ${hours(G('DMFQ-A').wait)} under DMFQ-A`}
                data={vis(gpuAt).map((r) => ({ policy: r.policy, value: r.wait }))}
                format={(v) => hours(v)}
                unitLabel="Longest wait (h)"
                csvName={csv(`gpu-longest-wait-${rateG}`)}
              />
            </Figure>
          </div>
          <Figure n={8} caption="Checkpoint-and-restore preemptions over the run." source={srcLine}>
            <BarChart
              title={`Here, adding adaptive quanta to aging changes preemptions by ${G('DMFQ-A').preempt >= G('Aging MLFQ').preempt ? '+' : '−'}${fmt(Math.abs(G('DMFQ-A').preempt / G('Aging MLFQ').preempt - 1) * 100, 0)}% (${fmt(G('Aging MLFQ').preempt, 0)} → ${fmt(G('DMFQ-A').preempt, 0)})`}
              data={vis(gpuAt).map((r) => ({ policy: r.policy, value: r.preempt }))}
              format={(v) => `${fmt(v, 0)} preemptions`}
              unitLabel="Preemptions"
              csvName={csv(`gpu-preemptions-${rateG}`)}
            />
          </Figure>
        </div>
      </section>

      {/* Findings */}
      <section className="mt-28 border-t border-ink pt-10" aria-labelledby="kf-h">
        <h2 id="kf-h" className="text-[30px] md:text-h2">
          Key findings
        </h2>
        <ol className="mt-8 grid gap-10 md:grid-cols-2">
          {[
            ['Feedback queues are the big win', 'The large, reliable win comes from preemptive feedback queues themselves, in both domains.'],
            ['Aging bounds starvation', 'Aging is what bounds starvation; adaptive quanta alone make it worse.'],
            ['The interaction depends on the workload', 'The quantum-resizing × aging interaction changes sign between workloads: fewer swaps for token-level LLM serving, more preemptions for coarse-grained GPU jobs.'],
            ['Fixed thresholds break near saturation', 'Fixed aging thresholds break near saturation. The next design step is load-aware aging, not a further combination of mechanisms.'],
          ].map(([t, d], i) => (
            <li key={t} className="rule-gold pt-4">
              <p className="num text-[13px] text-gold">0{i + 1}</p>
              <h3 className="mt-1 text-h3">{t}</h3>
              <p className="mt-2 text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-[13px] uppercase tracking-[0.08em] text-stone">Wording: Final Review Report, §8.5</p>
      </section>
    </div>
  );
}
