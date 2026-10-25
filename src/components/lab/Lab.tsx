'use client';
import { useEffect, useState } from 'react';
import { CPU_PRESETS, DEFAULT_CPU } from '@/engine/cpu';
import { CPU_POLICIES, type CPUConfig, type CPURun, type Policy } from '@/engine/types';
import { getEngine } from '@/lib/engine-client';
import { fmt } from '@/lib/format';
import { LEVEL_COLOR, POLICY_STYLE } from '@/lib/policy';
import { Gantt } from '@/components/charts/Gantt';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { MarkerSwatch } from '@/components/charts/Marker';
import { useWidth } from '@/components/charts/useWidth';
import { Figure } from '@/components/editorial/Figure';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { useLab } from './store';

type Col = { key: keyof CPURun['summary']; label: string; unit: string };
const COLS: Col[] = [
  { key: 'avgWaiting', label: 'Avg waiting', unit: 'ms' },
  { key: 'avgTurnaround', label: 'Avg turnaround', unit: 'ms' },
  { key: 'avgResponse', label: 'Avg first response', unit: 'ms' },
  { key: 'maxReadyWait', label: 'Max continuous READY wait', unit: 'ms' },
  { key: 'switches', label: 'Context switches', unit: 'switches' },
];

function NumField({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-stone">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.floor(Number(e.target.value) || 0)))}
        className="num w-full border border-hairline bg-paper px-2 py-1 text-[14px] text-ink"
      />
    </label>
  );
}

export function Lab() {
  const { preset, procs, cfg, set } = useLab();
  const [runs, setRuns] = useState<CPURun[]>([]);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>(900);

  useEffect(() => {
    let live = true;
    const valid = procs.filter((p) => p.burst > 0);
    if (!valid.length) return;
    const t0 = performance.now();
    Promise.all(CPU_POLICIES.map((p) => getEngine().runCPU(cfg, p, valid))).then((r) => {
      if (!live) return;
      setRuns(r);
      setElapsed(performance.now() - t0);
    });
    return () => {
      live = false;
    };
  }, [procs, cfg]);

  const setProc = (i: number, k: 'arrival' | 'burst', v: number) =>
    set({ procs: procs.map((p, j) => (j === i ? { ...p, [k]: v } : p)), preset: 'Custom' });
  const addProc = () => {
    const used = new Set(procs.map((p) => p.pid));
    let k = procs.length + 1;
    while (used.has(`P${k}`)) k++;
    set({ procs: [...procs, { pid: `P${k}`, arrival: 0, burst: 5 }], preset: 'Custom' });
  };
  const setCfg = (patch: Partial<CPUConfig>) => set({ cfg: { ...cfg, ...patch } });

  const tMax = Math.max(1, ...runs.flatMap((r) => r.segments.map((s) => s.end)));
  const pids = [...procs].filter((p) => p.burst > 0).sort((a, b) => a.arrival - b.arrival).map((p) => p.pid);
  const best = (k: Col['key']) => Math.min(...runs.map((r) => r.summary[k] as number));

  return (
    <div className="grid gap-12 xl:grid-cols-12">
      {/* Inputs */}
      <div className="xl:col-span-4">
        <p className="kicker text-stone">Workload</p>
        <div className="mt-3">
          <Segmented<string>
            label="Preset"
            value={preset}
            onChange={(v) => set({ preset: v, procs: CPU_PRESETS[v] })}
            options={Object.keys(CPU_PRESETS).map((k) => ({ value: k, label: k }))}
          />
        </div>
        <table className="mt-5 w-full border-collapse text-[14px]">
          <caption className="sr-only">Process table</caption>
          <thead>
            <tr className="border-b border-ink text-left">
              <th scope="col" className="py-1.5 pr-2 font-semibold text-ink">Process</th>
              <th scope="col" className="py-1.5 pr-2 font-semibold text-ink">Arrival (ms)</th>
              <th scope="col" className="py-1.5 pr-2 font-semibold text-ink">Burst (ms)</th>
              <th scope="col" className="w-8" />
            </tr>
          </thead>
          <tbody>
            {procs.map((p, i) => (
              <tr key={p.pid} className="border-b border-hairline">
                <th scope="row" className="num py-1 pr-2 text-left font-normal text-ink">{p.pid}</th>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`${p.pid} arrival in ms`}
                    type="number"
                    min={0}
                    value={p.arrival}
                    onChange={(e) => setProc(i, 'arrival', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    className="num w-full border border-hairline bg-paper px-2 py-1 text-ink"
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`${p.pid} burst in ms`}
                    type="number"
                    min={1}
                    value={p.burst}
                    onChange={(e) => setProc(i, 'burst', Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    className="num w-full border border-hairline bg-paper px-2 py-1 text-ink"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    aria-label={`Remove ${p.pid}`}
                    disabled={procs.length <= 1}
                    onClick={() => set({ procs: procs.filter((_, j) => j !== i), preset: 'Custom' })}
                    className="px-2 text-stone hover:text-ink disabled:opacity-30"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button variant="quiet" className="mt-3" onClick={addProc} disabled={procs.length >= 16}>
          Add process
        </Button>

        <details className="mt-8 border border-hairline bg-paper-2 p-4">
          <summary className="kicker cursor-pointer text-stone">Parameters</summary>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <NumField label="Q0 quantum (ms)" min={1} value={cfg.quanta[0]} onChange={(v) => setCfg({ quanta: [v, cfg.quanta[1], cfg.quanta[2]] })} />
            <NumField label="Q1 base b (ms)" min={1} value={cfg.quanta[1]} onChange={(v) => setCfg({ quanta: [cfg.quanta[0], v, cfg.quanta[2]] })} />
            <NumField label="Q2 base b (ms)" min={1} value={cfg.quanta[2]} onChange={(v) => setCfg({ quanta: [cfg.quanta[0], cfg.quanta[1], v] })} />
            <NumField label="ref (jobs)" min={1} value={cfg.ref} onChange={(v) => setCfg({ ref: v })} />
            <NumField label="Age Q1→Q0 (ms)" min={1} value={cfg.aging[1]} onChange={(v) => setCfg({ aging: [0, v, cfg.aging[2]] })} />
            <NumField label="Age Q2→Q1 (ms)" min={1} value={cfg.aging[2]} onChange={(v) => setCfg({ aging: [0, cfg.aging[1], v] })} />
          </div>
          <Button variant="quiet" className="mt-4" onClick={() => set({ cfg: DEFAULT_CPU })}>
            Reset to Review 1 values
          </Button>
        </details>
      </div>

      {/* Output */}
      <div className="min-w-0 xl:col-span-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-stone" aria-label="Legend">
          {['Q0', 'Q1', 'Q2'].map((q, i) => (
            <span key={q} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4" style={{ background: LEVEL_COLOR[i] }} /> running in {q}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <svg width="12" height="8" aria-hidden>
              <path d="M2,7 L6,2 L10,7" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
            </svg>
            promotion (aging)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-px bg-ink" /> preemption
          </span>
          {elapsed !== null && (
            <span className="num ml-auto">
              4 policies re-ran in {fmt(elapsed, 1)} ms
            </span>
          )}
        </div>
        <div ref={ref} className="mt-6">
          <Figure
            n={1}
            caption="The same workload under the four ablation policies, on a shared time axis (ms)."
            source="Deterministic · single CPU, no I/O, zero switch time · TS port of the Review 1 C11 rules"
          >
            <ChartFrame
              title={
                runs.length
                  ? (() => {
                      const d = runs[3].summary.maxReadyWait;
                      const m = runs[0].summary.maxReadyWait;
                      const lead = d < m ? 'Aging shortens the longest READY wait' : d > m ? 'Here DMFQ-A lengthens the longest READY wait' : 'The longest READY wait is unchanged';
                      return `${lead}: ${fmt(d, 0)} ms under DMFQ-A vs ${fmt(m, 0)} ms under MLFQ`;
                    })()
                  : 'Four policies, one workload'
              }
              csvName="dmfqa-lab-gantt.csv"
              table={{
                columns: ['Policy', 'Process', 'Start (ms)', 'End (ms)', 'Level'],
                rows: runs.flatMap((r) => r.segments.map((s) => [r.summary.policy, s.pid, s.start, s.end, `Q${s.level}`])),
              }}
            >
              <div className="space-y-6">
                {runs.map((r) => {
                  const st = POLICY_STYLE[r.summary.policy as Policy];
                  return (
                    <div key={r.summary.policy}>
                      <p className="mb-1 flex items-center gap-2 text-[14px]">
                        <MarkerSwatch shape={st.marker} color={st.color} />
                        <span className={`font-semibold ${r.summary.policy === 'DMFQ-A' ? 'text-accent-ink' : 'text-ink'}`}>
                          {r.summary.policy}
                        </span>
                        <span className="num text-[12px] text-stone">
                          {r.summary.switches} switches · {r.marks.filter((m) => m.kind === 'promote').length} promotions
                        </span>
                      </p>
                      <Gantt
                        title={`${r.summary.policy} schedule`}
                        pids={pids}
                        segments={r.segments}
                        marks={r.marks}
                        tMax={tMax}
                        width={width}
                      />
                    </div>
                  );
                })}
              </div>
            </ChartFrame>
          </Figure>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[14px]">
            <caption className="mb-2 text-left text-[13px] text-stone">
              Best value in each column in bold. Lower is better for every column.
            </caption>
            <thead>
              <tr className="border-b border-ink text-left">
                <th scope="col" className="py-2 pr-3 font-semibold text-ink">Policy</th>
                {COLS.map((c) => (
                  <th key={c.key} scope="col" className="py-2 pr-3 text-right font-semibold text-ink">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const st = POLICY_STYLE[r.summary.policy as Policy];
                return (
                  <tr key={r.summary.policy} className="border-b border-hairline">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
                      <span className="flex items-center gap-2">
                        <MarkerSwatch shape={st.marker} color={st.color} />
                        {r.summary.policy}
                      </span>
                    </th>
                    {COLS.map((c) => {
                      const v = r.summary[c.key] as number;
                      const isBest = v === best(c.key);
                      return (
                        <td key={c.key} className={`num py-2 pr-3 text-right text-ink ${isBest ? 'font-bold' : 'font-normal'}`}>
                          {fmt(v, c.key === 'switches' || c.key === 'maxReadyWait' ? 0 : 2)} {c.unit}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] text-stone">
            Context switches count each hand-over of the CPU from one process to another without idling (assumption
            pending the C11 trace).
          </p>
        </div>
      </div>
    </div>
  );
}
