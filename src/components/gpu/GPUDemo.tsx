'use client';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GPURunResult } from '@/engine/api';
import { DEFAULT_GPU } from '@/engine/gpu';
import { POLICIES, POLICY_FLAGS, type GPUFrame, type Policy } from '@/engine/types';
import { getEngine } from '@/lib/engine-client';
import { fmt, hm, pct } from '@/lib/format';
import { LEVEL_COLOR, LEVEL_NAME, POLICY_STYLE } from '@/lib/policy';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { MarkerSwatch } from '@/components/charts/Marker';
import { Replay } from '@/components/llm/replay';
import { GpuGrid } from './GpuGrid';
import { useGPU } from './store';

/** Simulated minutes per real second at 1×. */
const MIN_PER_SEC = 10;

function frameAt(frames: GPUFrame[], t: number) {
  let lo = 0;
  let hi = frames.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (frames[m].t <= t) {
      ans = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return ans;
}

export function GPUDemo() {
  const s = useGPU();
  const set = s.set;
  const token = useRef(0);
  const shownPolicies: Policy[] = s.policy === 'FCFS' ? ['FCFS'] : ['FCFS', s.policy];

  const run = useCallback(
    async (keepTime = false) => {
      const st = useGPU.getState();
      const my = ++token.current;
      set({ status: 'loading' });
      const pols: Policy[] = st.policy === 'FCFS' ? ['FCFS'] : ['FCFS', st.policy];
      const res = await getEngine().runGPUMany(DEFAULT_GPU, pols, {
        rate: st.rate,
        n: st.n,
        seed: st.seed,
        trace: true,
      });
      if (my !== token.current) return;
      const runs: Partial<Record<Policy, GPURunResult>> = {};
      res.forEach((r) => (runs[r.summary.policy] = r));
      set({
        runs,
        endT: Math.max(...res.map((r) => r.frames![r.frames!.length - 1].t)),
        simT: keepTime ? st.simT : 0,
        status: 'playing',
      });
    },
    [set],
  );

  useEffect(() => {
    if (s.status !== 'playing') return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const st = useGPU.getState();
      const dt = Math.min(100, now - last) / 1000;
      last = now;
      const t = st.simT + dt * MIN_PER_SEC * st.speed;
      if (t >= st.endT) {
        set({ simT: st.endT, status: 'done' });
        return;
      }
      set({ simT: t });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [s.status, set]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (useGPU.getState().status === 'idle') return;
    const id = setTimeout(() => run(), 250);
    return () => clearTimeout(id);
  }, [s.rate, s.policy, run]);

  const replays = useMemo(() => {
    const m = new Map<Policy, Replay>();
    for (const [p, r] of Object.entries(s.runs) as [Policy, GPURunResult][])
      m.set(p, new Replay(r.frames!, r.jobs.length));
    return m;
  }, [s.runs]);

  const view = shownPolicies
    .filter((p) => s.runs[p])
    .map((p) => {
      const r = s.runs[p]!;
      const idx = frameAt(r.frames!, s.simT);
      const rp = replays.get(p)!;
      rp.seek(idx);
      const grid = idx >= 0 ? r.frames![idx].grid : [];
      const lanes = rp.lanes(grid);
      return { policy: p, run: r, idx, replay: rp, queue: [...lanes[0], ...lanes[1], ...lanes[2]], grid };
    });

  const playing = s.status === 'playing';
  const ready = s.status !== 'idle' && s.status !== 'loading' && view.length > 0;
  const step = () => {
    set({ simT: Math.min(s.endT, Math.floor(s.simT) + 1), status: 'paused' });
  };

  return (
    <div>
      <section aria-label="Simulation controls" className="border border-hairline bg-paper-2 p-4 md:p-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Slider
              label="Job arrivals"
              value={s.rate}
              min={5}
              max={7}
              step={0.5}
              onChange={(v) => set({ rate: v })}
              format={(v) => `${v.toFixed(1)} jobs/h`}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3 lg:col-span-8">
            <label className="flex flex-col gap-1">
              <span className="kicker text-stone">Seed</span>
              <input
                type="number"
                min={1}
                value={s.seed}
                onChange={(e) => set({ seed: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                className="num w-24 border border-hairline bg-paper px-2 py-[7px] text-[15px] text-ink"
              />
            </label>
            <Button onClick={() => run()} disabled={s.status === 'loading'}>
              {s.status === 'idle' ? 'Run' : 'Restart'}
            </Button>
            <Button variant="quiet" disabled={!ready || s.status === 'done'} onClick={() => set({ status: playing ? 'paused' : 'playing' })}>
              {playing ? 'Pause' : 'Resume'}
            </Button>
            <Button variant="quiet" disabled={!ready || s.status === 'done'} onClick={step}>
              Step 1 min
            </Button>
            <div className="flex flex-col gap-1">
              <span className="kicker text-stone">Speed</span>
              <Segmented<1 | 4 | 16>
                label="Playback speed"
                value={s.speed}
                onChange={(v) => set({ speed: v })}
                options={[
                  { value: 1, label: '1×' },
                  { value: 4, label: '4×' },
                  { value: 16, label: '16×' },
                ]}
              />
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-1 border-t border-hairline pt-5">
          <span className="kicker text-stone">Compare FCFS with</span>
          <Segmented<Policy> label="Policy" value={s.policy} onChange={(v) => set({ policy: v })} options={POLICIES.map((p) => ({ value: p, label: p }))} />
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="flex items-center gap-3 text-[15px]">
          {playing && <span className="live-dot inline-block h-2 w-2 bg-accent" aria-hidden />}
          <span className="kicker text-stone">
            {s.status === 'idle' ? 'Press Run to start' : s.status === 'loading' ? 'Simulating…' : s.status === 'done' ? 'Run complete' : playing ? 'Live' : 'Paused'}
          </span>
          <span className="num text-ink">
            cluster clock {hm(s.simT)}
          </span>
          <span className="text-[13px] text-stone">1× = {MIN_PER_SEC} simulated minutes per second</span>
        </p>
        <ul className="flex flex-wrap items-center gap-x-4 text-[13px] text-stone" aria-label="Legend">
          {LEVEL_NAME.map((q, i) => (
            <li key={q} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5" style={{ background: LEVEL_COLOR[i] }} /> {q} job
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5" style={{ background: 'var(--s-fcfs)' }} /> FCFS job
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 border border-hairline" style={{ background: 'var(--idle)' }} /> idle
          </li>
        </ul>
      </div>

      {s.status === 'idle' ? (
        <div className="mt-6 flex min-h-[280px] flex-col items-center justify-center border border-dashed border-hairline p-8 text-center">
          <p className="max-w-xl text-ink-2">
            {s.n} synthetic training jobs (1–16 GPUs each, durations from minutes to days) arrive at{' '}
            <span className="num">{s.rate.toFixed(1)} jobs/h</span> on a 64-GPU cluster. Jobs are gang-placed: all of
            their GPUs at once, or none.
          </p>
          <Button className="mt-6" onClick={() => run()}>
            Run
          </Button>
        </div>
      ) : (
        <div className={`mt-6 grid gap-6 ${view.length > 1 ? 'lg:grid-cols-2' : ''}`}>
          {view.map((v) => {
            const multilevel = POLICY_FLAGS[v.policy].multilevel;
            const idle = v.grid.filter((g) => g < 0).length;
            const head = v.queue[0];
            const blocked = !multilevel && head !== undefined && v.run.jobs[head].gpus > idle && idle > 0;
            const m = v.run.meters!;
            const i = v.idx;
            const hero = v.policy === 'DMFQ-A';
            return (
              <div key={v.policy} className="border border-hairline p-4">
                <div className="flex items-baseline justify-between">
                  <p className={`font-display text-[22px] font-semibold ${hero ? 'text-accent-ink' : 'text-ink'}`}>{v.policy}</p>
                  <p className="num text-[13px] text-stone">
                    {64 - idle}/64 GPUs busy · {v.queue.length} queued
                  </p>
                </div>
                <p className={`mt-2 min-h-[44px] border-l-2 pl-3 text-[14px] ${blocked ? 'border-gold text-ink' : 'border-transparent text-stone'}`} aria-live="polite">
                  {blocked ? (
                    <>
                      <strong>Head-of-line blocking:</strong> job J{head} needs {v.run.jobs[head].gpus} GPUs, so{' '}
                      {idle} idle GPUs wait behind it with {v.queue.length - 1} jobs queued.
                    </>
                  ) : multilevel ? (
                    'Higher levels are placed first; smaller jobs backfill any gaps.'
                  ) : (
                    'Strict FIFO: the head job must fit before anyone behind it starts.'
                  )}
                </p>
                <div className="mt-3 grid gap-5 md:grid-cols-[1fr_200px]">
                  <GpuGrid frames={v.run.frames!} idx={v.idx} jobs={v.run.jobs} level={v.replay.level} multilevel={multilevel} />
                  <div>
                    <p className="kicker text-[11px] text-stone">Queue (service order)</p>
                    <ol className="mt-2 space-y-1 text-[13px]">
                      {v.queue.slice(0, 9).map((j, k) => (
                        <li key={j} className="flex items-center gap-2">
                          <span
                            className="num inline-block w-7 text-center text-[11px] text-paper"
                            style={{ background: multilevel ? LEVEL_COLOR[v.replay.level[j]] : 'var(--s-fcfs)' }}
                          >
                            {multilevel ? LEVEL_NAME[v.replay.level[j]] : k + 1}
                          </span>
                          <span className="num text-ink">J{j}</span>
                          <span className="num text-stone">{v.run.jobs[j].gpus} GPU</span>
                        </li>
                      ))}
                      {v.queue.length > 9 && <li className="text-stone">+{v.queue.length - 9} more</li>}
                      {v.queue.length === 0 && <li className="text-stone">empty</li>}
                    </ol>
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-hairline pt-4 sm:grid-cols-4">
                  {[
                    ['Mean JCT, short jobs', i >= 0 && !Number.isNaN(m.shortJCT[i]) ? `${fmt(m.shortJCT[i], 1)} h` : '—'],
                    ['Longest wait, long jobs', i >= 0 ? `${fmt(m.longWait[i], 1)} h` : '—'],
                    ['Preemptions', i >= 0 ? `${fmt(m.preemptions[i], 0)} preemptions` : '—'],
                    ['Utilisation', i >= 0 ? pct(m.util[i]) : '—'],
                  ].map(([k, val]) => (
                    <div key={k}>
                      <dt className="text-[12px] text-stone">{k}</dt>
                      <dd className={`num mt-1 text-[17px] ${hero ? 'text-accent-ink' : 'text-ink'}`}>{val}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      )}

      {s.status === 'done' && view.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3 text-[14px] text-ink-2">
          {view.map((v) => {
            const st = POLICY_STYLE[v.policy];
            return (
              <span key={v.policy} className="flex items-center gap-1.5">
                <MarkerSwatch shape={st.marker} color={st.color} /> {v.policy}: longest wait{' '}
                <span className="num">{fmt(v.run.summary.longestWaitLong, 1)} h</span>, short-job JCT{' '}
                <span className="num">{fmt(v.run.summary.shortMeanJCT, 1)} h</span>
              </span>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-[12px] uppercase tracking-[0.08em] text-stone">
        Synthetic workload · TS engine · seed {s.seed} · {s.n} jobs · meters end equal to a non-animated run
      </p>
    </div>
  );
}
