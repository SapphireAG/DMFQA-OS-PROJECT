'use client';
import { useEffect, useRef } from 'react';
import type { LLMRequest, Policy } from '@/engine/types';
import { fmt } from '@/lib/format';
import { simulatedText } from './corpus';

export interface ChatWatch {
  id: number;
  req: LLMRequest;
  times: number[]; // token emission times (ms)
}

const STALL_MS = 400;

function upper(arr: number[], t: number) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] <= t) lo = m + 1;
    else hi = m;
  }
  return lo;
}

function ChatWindow({ w, simT, longCutoff }: { w: ChatWatch; simT: number; longCutoff: number }) {
  const body = useRef<HTMLDivElement>(null);
  const long = w.req.output > longCutoff;
  const arrived = simT >= w.req.arrival;
  const n = upper(w.times, simT);
  const done = n >= w.req.output;
  const last = n > 0 ? w.times[n - 1] : w.req.arrival;
  const stalled = arrived && !done && simT - last > STALL_MS;
  const ttft = w.times.length ? w.times[0] - w.req.arrival : NaN;

  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [n]);

  return (
    <div className="flex min-w-0 flex-col border border-hairline bg-paper">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-1.5 text-[12px]">
        <span className="kicker truncate text-[11px] text-stone">
          {long ? '◆ Long' : '● Chat'} <span className="num normal-case tracking-normal">#{w.id}</span>
        </span>
        <span className="num shrink-0 text-stone">
          {Math.min(n, w.req.output)}/{w.req.output} tok
        </span>
      </div>
      <div ref={body} className="h-24 overflow-hidden px-3 py-2 text-[13px] leading-snug text-ink-2 md:h-28">
        {!arrived ? (
          <span className="text-stone">Not yet sent.</span>
        ) : n === 0 ? (
          <span className="text-stone">Prompt received ({fmt(w.req.prompt, 0)} tokens)…</span>
        ) : (
          simulatedText(w.id, n, long ? 60 : 40)
        )}
      </div>
      <div className="flex h-7 items-center border-t border-hairline px-3 text-[12px]" aria-hidden>
        {stalled ? (
          <span className="flex items-center gap-1.5 text-ink">
            <span className="live-dot inline-block h-1.5 w-1.5 bg-gold" />
            waiting for GPU… <span className="num">{fmt((simT - last) / 1000, 1)} s</span>
          </span>
        ) : done ? (
          <span className="text-stone">
            done · TTFT <span className="num">{fmt(ttft / 1000, 2)} s</span>
          </span>
        ) : n > 0 ? (
          <span className="text-stone">
            streaming · TTFT <span className="num">{fmt(ttft / 1000, 2)} s</span>
          </span>
        ) : (
          <span className="text-stone">{arrived ? 'queued' : ''}</span>
        )}
      </div>
    </div>
  );
}

export function ChatStrip({
  rows,
  simT,
  longCutoff,
}: {
  rows: { policy: Policy; watches: ChatWatch[] }[];
  simT: number;
  longCutoff: number;
}) {
  return (
    <div className="space-y-5">
      {rows.map((r) => (
        <div key={r.policy}>
          <p className={`kicker mb-2 ${r.policy === 'DMFQ-A' ? 'text-accent-ink' : 'text-stone'}`}>
            {r.policy === 'FCFS' ? 'FCFS · the order Orca and vLLM serve requests in' : r.policy}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {r.watches.map((w) => (
              <ChatWindow key={w.id} w={w} simT={simT} longCutoff={longCutoff} />
            ))}
          </div>
        </div>
      ))}
      <p className="text-[12px] uppercase tracking-[0.08em] text-stone">
        Simulated output · placeholder text revealed at the times the engine emits each token
      </p>
    </div>
  );
}
