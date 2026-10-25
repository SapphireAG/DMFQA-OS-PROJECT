'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LLMRunResult } from '@/engine/api';
import { DEFAULT_LLM } from '@/engine/llm';
import { POLICIES, POLICY_FLAGS, type LLMRequest, type Policy } from '@/engine/types';
import { getEngine } from '@/lib/engine-client';
import { clock, fmt } from '@/lib/format';
import { LEVEL_COLOR } from '@/lib/policy';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { ChatStrip, type ChatWatch } from './ChatStrip';
import { Meters } from './Meters';
import { frameAt, Replay, tokenTimes } from './replay';
import { Glyph, KVGrid, Lanes, StageHeader } from './Stage';
import { useLLM, type Mode } from './store';

const CUT = DEFAULT_LLM.longCutoff;

/** Neutral watch rule: the first two chats and first two long requests arriving at or after `from`. */
function pickWatch(reqs: LLMRequest[], from: number): number[] {
  const tail = reqs.filter((r) => r.arrival >= from);
  return [
    ...tail.filter((r) => r.output <= CUT).slice(0, 2),
    ...tail.filter((r) => r.output > CUT).slice(0, 2),
  ].map((r) => r.arrival);
}

const policiesFor = (mode: Mode): Policy[] =>
  mode === 'race' ? [...POLICIES] : mode === 'FCFS' ? ['FCFS'] : ['FCFS', mode];

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(max-width: 639px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

export function LLMDemo() {
  const s = useLLM();
  const set = s.set;
  const narrow = useNarrow();
  const mode: Mode = narrow && s.mode === 'race' ? 'DMFQ-A' : s.mode;
  const focus: Policy = mode === 'race' ? 'DMFQ-A' : mode;
  const runToken = useRef(0);

  // ── simulation ────────────────────────────────────────────────────────────
  const run = useCallback(
    async (opts: { keepTime?: boolean; play?: boolean; extra?: Omit<LLMRequest, 'id'>[]; resetWatch?: boolean } = {}) => {
      const st = useLLM.getState();
      const token = ++runToken.current;
      const extra = opts.extra ?? st.extra;
      const m: Mode = narrow && st.mode === 'race' ? 'DMFQ-A' : st.mode;
      set({ status: 'loading', extra });
      const res = await getEngine().runLLMMany(DEFAULT_LLM, policiesFor(m), {
        rate: st.rate,
        n: st.n,
        seed: st.seed,
        trace: true,
        extra,
      });
      if (token !== runToken.current) return;
      const runs: Partial<Record<Policy, LLMRunResult>> = {};
      res.forEach((r) => (runs[r.summary.policy] = r));
      const reqs = res[0].requests;
      const watch =
        opts.resetWatch || st.watch.length === 0
          ? pickWatch(reqs, reqs[Math.floor(reqs.length / 2)].arrival)
          : st.watch;
      const endT = Math.max(...res.map((r) => r.frames![r.frames!.length - 1].t));
      set({
        runs,
        watch,
        endT,
        simT: opts.keepTime ? st.simT : 0,
        status: opts.play === false ? 'paused' : 'playing',
      });
    },
    [narrow, set],
  );

  // playback loop: 1× = real time
  useEffect(() => {
    if (s.status !== 'playing') return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const st = useLLM.getState();
      const dt = Math.min(100, now - last);
      last = now;
      const t = st.simT + dt * st.speed;
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

  // re-run from the start when load changes after a first run (debounced while dragging)
  const firstRate = useRef(true);
  useEffect(() => {
    if (firstRate.current) {
      firstRate.current = false;
      return;
    }
    if (useLLM.getState().status === 'idle') return;
    const id = setTimeout(() => run({ extra: [], resetWatch: true }), 250);
    return () => clearTimeout(id);
  }, [s.rate, run]);

  // mode change re-runs the needed policies, keeping the playhead
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false;
      return;
    }
    const st = useLLM.getState();
    if (st.status === 'idle') return;
    run({ keepTime: true, play: st.status === 'playing' });
  }, [mode, run]);

  // ── derived per-policy state at the playhead ──────────────────────────────
  const shown = policiesFor(mode).filter((p) => s.runs[p]);
  const replays = useMemo(() => {
    const m = new Map<Policy, Replay>();
    for (const [p, r] of Object.entries(s.runs) as [Policy, LLMRunResult][])
      m.set(p, new Replay(r.frames!, r.requests.length));
    return m;
  }, [s.runs]);

  const watchIds = useMemo(() => {
    const m = new Map<Policy, number[]>();
    for (const [p, r] of Object.entries(s.runs) as [Policy, LLMRunResult][]) {
      m.set(
        p,
        s.watch.map((a) => r.requests.findIndex((q) => q.arrival === a)).filter((i) => i >= 0),
      );
    }
    return m;
  }, [s.runs, s.watch]);

  const times = useMemo(() => {
    const m = new Map<Policy, Map<number, number[]>>();
    for (const [p, r] of Object.entries(s.runs) as [Policy, LLMRunResult][])
      m.set(p, tokenTimes(r.frames!, watchIds.get(p) ?? []));
    return m;
  }, [s.runs, watchIds]);

  const view = shown.map((p) => {
    const r = s.runs[p]!;
    const idx = frameAt(r.frames!, s.simT);
    const rp = replays.get(p)!;
    rp.seek(idx);
    const slots = idx >= 0 ? r.frames![idx].slots : [];
    return { policy: p, run: r, idx, replay: rp, lanes: rp.lanes(slots) };
  });

  const chatRows = (mode === 'race' ? (['FCFS', 'DMFQ-A'] as Policy[]) : policiesFor(mode))
    .filter((p) => s.runs[p])
    .map((p) => {
      const r = s.runs[p]!;
      return {
        policy: p,
        watches: (watchIds.get(p) ?? []).map<ChatWatch>((id) => ({
          id,
          req: r.requests[id],
          times: times.get(p)?.get(id) ?? [],
        })),
      };
    });

  // ── controls ──────────────────────────────────────────────────────────────
  const playing = s.status === 'playing';
  const ready = s.status !== 'idle' && s.status !== 'loading' && shown.length > 0;

  const step = () => {
    const r = s.runs[focus] ?? s.runs[shown[0]];
    if (!r) return;
    const i = frameAt(r.frames!, s.simT);
    const next = r.frames![Math.min(r.frames!.length - 1, i + 1)];
    set({ simT: next.t, status: next.t >= s.endT ? 'done' : 'paused' });
  };
  const inject = (extra: Omit<LLMRequest, 'id'>[]) =>
    run({ keepTime: true, play: s.status !== 'paused', extra: [...s.extra, ...extra] });
  const injectLong = () =>
    inject([{ arrival: s.simT + 1, prompt: 1200, output: 900, kind: 'long' }]);
  const burst = () =>
    inject(
      Array.from({ length: 20 }, (_, k) => ({
        arrival: s.simT + 1 + k * 25,
        prompt: 250,
        output: 120,
        kind: 'chat' as const,
      })),
    );
  const watchNext = () => {
    const r = s.runs[shown[0]];
    if (r) set({ watch: pickWatch(r.requests, s.simT) });
  };

  const modeOptions: { value: Mode; label: string }[] = [
    ...POLICIES.map((p) => ({ value: p as Mode, label: p })),
    ...(narrow ? [] : [{ value: 'race' as Mode, label: 'Race all five' }]),
  ];

  return (
    <div>
      {/* Controls */}
      <section aria-label="Simulation controls" className="border border-hairline bg-paper-2 p-4 md:p-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Slider
              label="Arrival rate"
              value={s.rate}
              min={1.2}
              max={2.4}
              step={0.1}
              onChange={(v) => set({ rate: Number(v.toFixed(1)) })}
              format={(v) => `${v.toFixed(1)} req/s`}
              ticks={[
                { value: 1.4, label: 'calm' },
                { value: 1.8, label: 'busy' },
                { value: 2.2, label: 'saturated' },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3 lg:col-span-7">
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
            <Button onClick={() => run({ extra: [], resetWatch: true })} disabled={s.status === 'loading'}>
              {s.status === 'idle' ? 'Run' : 'Restart'}
            </Button>
            <Button
              variant="quiet"
              disabled={!ready || s.status === 'done'}
              onClick={() => set({ status: playing ? 'paused' : 'playing' })}
            >
              {playing ? 'Pause' : 'Resume'}
            </Button>
            <Button variant="quiet" disabled={!ready || s.status === 'done'} onClick={step}>
              Step
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
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-hairline pt-5">
          <div className="flex flex-col gap-1">
            <span className="kicker text-stone">Policy</span>
            <Segmented<Mode> label="Policy" value={mode} onChange={(v) => set({ mode: v })} options={modeOptions} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" disabled={!ready || s.status === 'done'} onClick={injectLong}>
              Inject long request
            </Button>
            <Button variant="quiet" disabled={!ready || s.status === 'done'} onClick={burst}>
              Burst of 20 chats
            </Button>
            <Button variant="quiet" disabled={!ready} onClick={watchNext}>
              Watch the next requests
            </Button>
          </div>
        </div>
      </section>

      {/* Clock + legend */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="flex items-center gap-3 text-[15px]">
          {playing && <span className="live-dot inline-block h-2 w-2 bg-accent" aria-hidden />}
          <span className="kicker text-stone">
            {s.status === 'idle'
              ? 'Press Run to start'
              : s.status === 'loading'
                ? 'Simulating…'
                : s.status === 'done'
                  ? 'Run complete'
                  : playing
                    ? 'Live'
                    : 'Paused'}
          </span>
          <span className="num text-ink">
            t = {clock(s.simT)} / {clock(s.endT)}
          </span>
          {s.extra.length > 0 && <span className="text-[13px] text-stone">+{s.extra.length} injected</span>}
        </p>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-stone" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <Glyph long={false} color="var(--ink-2)" size={11} /> chat
          </li>
          <li className="flex items-center gap-1.5">
            <Glyph long color="var(--ink-2)" size={11} /> long (&gt; {CUT} tokens; the scheduler cannot tell)
          </li>
          {(['Q0', 'Q1', 'Q2'] as const).map((q, i) => (
            <li key={q} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5" style={{ background: LEVEL_COLOR[i] }} /> {q}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 border-2 border-gold" /> KV swap-in
          </li>
        </ul>
      </div>

      {/* Stage */}
      {s.status === 'idle' ? (
        <div className="mt-6 flex min-h-[280px] flex-col items-center justify-center border border-dashed border-hairline p-8 text-center">
          <p className="max-w-xl text-ink-2">
            {fmt(s.n, 0)} synthetic requests (80% chats, 20% long generations) arrive at{' '}
            <span className="num">{s.rate.toFixed(1)} req/s</span> and share one GPU with 16 KV-cache slots. Press{' '}
            <strong className="text-ink">Run</strong> to watch FCFS and {focus === 'FCFS' ? 'it' : focus} serve the
            same requests.
          </p>
          <Button className="mt-6" onClick={() => run({ extra: [], resetWatch: true })}>
            Run
          </Button>
        </div>
      ) : (
        <div
          className={`mt-6 grid gap-4 ${
            mode === 'race' ? 'md:grid-cols-2 xl:grid-cols-5' : view.length > 1 ? 'lg:grid-cols-2' : ''
          }`}
        >
          {view.map((v) => {
            const multilevel = POLICY_FLAGS[v.policy].multilevel;
            const compact = mode === 'race';
            const waiting = v.lanes[0].length + v.lanes[1].length + v.lanes[2].length;
            return (
              <div key={v.policy} className="border border-hairline p-3 md:p-4">
                <StageHeader
                  policy={v.policy}
                  accent={v.policy === 'DMFQ-A'}
                  compact={compact}
                  t={`${waiting} waiting`}
                />
                <div className="mt-3">
                  <Lanes
                    lanes={v.lanes}
                    requests={v.run.requests}
                    longCutoff={CUT}
                    multilevel={multilevel}
                    compact={compact}
                  />
                </div>
                <p className="kicker mb-2 mt-4 text-[11px] text-stone">KV-cache slots · 16</p>
                <KVGrid
                  frames={v.run.frames!}
                  idx={v.idx}
                  replay={v.replay}
                  requests={v.run.requests}
                  longCutoff={CUT}
                  multilevel={multilevel}
                  compact={compact}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Chat strip */}
      {s.status !== 'idle' && chatRows.length > 0 && (
        <section className="mt-12" aria-labelledby="chat-h">
          <h2 id="chat-h" className="text-[26px] md:text-h3">
            The same four requests, served by each scheduler
          </h2>
          <p className="mb-5 mt-2 max-w-3xl text-[15px] text-ink-2">
            Two chats and two long generations, chosen by arrival order (the first of each after the playhead or the
            run’s midpoint), never by outcome.
          </p>
          <ChatStrip rows={chatRows} simT={s.simT} longCutoff={CUT} />
        </section>
      )}

      {/* Meters */}
      {s.status !== 'idle' && view.length > 0 && (
        <section className="mt-12" aria-labelledby="meters-h">
          <h2 id="meters-h" className="text-[26px] md:text-h3">
            Live meters
          </h2>
          <div className="mt-4">
            <Meters rows={view.map((v) => ({ policy: v.policy, meters: v.run.meters!, idx: v.idx }))} seed={s.seed} />
          </div>
        </section>
      )}
    </div>
  );
}
