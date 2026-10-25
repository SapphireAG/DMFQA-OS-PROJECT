import type { Metadata } from 'next';
import { PageHeader } from '@/components/editorial/PageHeader';
import { LLMDemo } from '@/components/llm/LLMDemo';
import { SyntheticTag } from '@/components/ui/Tag';

export const metadata: Metadata = { title: 'LLM Serving Live' };

const RAIL = [
  {
    t: 'Demotion',
    d: 'Every request enters Q0 with a 16-token budget and spends one token per decoding step. A request that spends its budget drops a level, so long generations sink below new chats without anyone knowing their length.',
  },
  {
    t: 'Selective aging',
    d: 'A request that has waited 1.5 s in Q1, or 3 s in Q2, moves up one level and gets a fresh budget. Only stalled streams move, so no long answer freezes for long.',
  },
  {
    t: 'Adaptive quanta',
    d: 'Q1 and Q2 budgets (32 and 64 tokens at base) grow with the number of waiting requests, up to double. Longer turns under load mean fewer evictions, and each eviction is a KV-cache swap.',
  },
];

export default function LLMPage() {
  return (
    <>
      <PageHeader
        number="03"
        kicker="LLM Serving Live"
        title="Under FCFS, chats freeze behind long answers. Under DMFQ-A they keep streaming."
        dek="One GPU, an iteration-level batch of 16 KV-cache slots, and requests whose output length nobody knows in advance. Drag the load toward saturation and watch who waits, then see which long requests pay for it."
      >
        <div className="mt-6">
          <SyntheticTag>Synthetic workload · TS engine in your browser</SyntheticTag>
        </div>
      </PageHeader>
      <div className="page">
        <LLMDemo />
        <aside className="mt-20 border-t border-ink pt-8" aria-label="How DMFQ-A decides">
          <p className="kicker text-stone">How DMFQ-A decides</p>
          <ol className="mt-4 grid gap-8 md:grid-cols-3">
            {RAIL.map((r, i) => (
              <li key={r.t} className="rule-gold pt-3">
                <p className="num text-[13px] text-gold">0{i + 1}</p>
                <h3 className="mt-1 text-[22px]">{r.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{r.d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
            <p className="border border-hairline bg-paper-2 px-3 py-2 font-mono text-[14px] text-ink">
              q = min(2b, b + ⌊b·min(R, 8)/8⌋)
            </p>
            <p className="max-w-2xl text-[13px] text-stone">
              R = waiting requests excluding the receiver. Step time = 12 ms + 0.6 ms per sequence + prefill (0.02
              ms/token) + KV swap-in (0.004 ms/token).
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
