import Link from 'next/link';
import { Kicker } from '@/components/editorial/Kicker';
import { Byline } from '@/components/editorial/Byline';
import { Figure } from '@/components/editorial/Figure';
import { PullQuote } from '@/components/editorial/PullQuote';
import { ButtonLink } from '@/components/ui/Button';
import { Stat } from '@/components/ui/Stat';
import { SyntheticTag } from '@/components/ui/Tag';
import { QueueDiagram } from '@/components/novelty/QueueDiagram';
import { QuantumWidget } from '@/components/novelty/QuantumWidget';
import { AblationMatrix } from '@/components/novelty/AblationMatrix';
import { by, headline, reportGPU, reportLLM } from '@/lib/data';
import { fmt } from '@/lib/format';

const MAPPING = [
  ['Unit of work', 'Process', 'Request: prompt, then output tokens', 'Training job on 1–16 GPUs'],
  ['Unknown in advance', 'CPU burst length', 'Number of tokens it will generate', 'Time to converge'],
  ['Quantum', 'Time slice (ms)', 'Token budget per level', 'Attained GPU-minutes per level'],
  ['Context switch', 'Save registers and cache state', 'Swap the KV cache to host memory', 'Checkpoint, then restore'],
  ['Starvation looks like', 'Process never dispatched', 'Long answer freezes mid-stream', 'Large job queued for hours'],
];

export default function Overview() {
  const h = headline();
  const llm = reportLLM();
  const gpu = reportGPU();
  const cell = (rows: typeof llm, p: 'MLFQ' | 'Dynamic MLFQ' | 'Aging MLFQ' | 'DMFQ-A', k: string, second?: (r: (typeof llm)[number]) => string) => {
    const r = by(rows, p);
    return { policy: p, value: r[k] as number, second: second?.(r) };
  };
  const stall = (r: (typeof llm)[number]) => `${fmt(r.longest_stall_long_s as number, 1)} s longest stall`;
  const wait = (r: (typeof gpu)[number]) => `${fmt(r.longest_wait_long_h as number, 1)} h longest wait`;

  return (
    <>
      {/* Hero */}
      <section className="page pb-16 pt-14 md:pb-24 md:pt-24">
        <Kicker>Operating Systems · Final Review</Kicker>
        <h1 className="mt-6 max-w-5xl text-[48px] font-semibold leading-[0.98] md:text-[88px]">
          Short jobs stay fast. Long jobs are never forgotten.
        </h1>
        <p className="mt-8 max-w-3xl text-[20px] leading-relaxed text-ink-2 md:text-[22px]">
          DMFQ-A is a multilevel feedback queue with two additions: time quanta that grow with queue pressure, and
          aging that lifts a waiting job one level at a time. We test each mechanism separately on a CPU scheduler,
          then carry the same rules into LLM inference serving and GPU training clusters, where job lengths are just as
          unknown.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <ButtonLink href="/llm/" variant="cta">
            Watch it live →
          </ButtonLink>
          <Byline />
        </div>
      </section>

      {/* Headline stats */}
      <section className="border-y border-hairline bg-paper-2" aria-labelledby="stats-h">
        <div className="page py-14">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="stats-h" className="kicker font-sans text-stone">
              What the simulator found
            </h2>
            <SyntheticTag>Synthetic workload · Python reference, 5 seeds</SyntheticTag>
          </div>
          <div className="mt-10 grid gap-12 md:grid-cols-3">
            <Link href="/results/#llm-ttft" className="group block">
              <Stat
                value={`~${fmt(h.ttftRatio, 0)}×`}
                caption={
                  <>
                    lower p99 time to first token for short chats at {fmt(h.llmRate, 1)} req/s:{' '}
                    <span className="num">
                      {fmt(h.ttftFrom, 2)} s → {fmt(h.ttftTo, 2)} s
                    </span>
                    . <span className="link group-hover:decoration-ink">See chart</span>
                  </>
                }
              />
            </Link>
            <Link href="/results/#gpu-wait" className="group block">
              <Stat
                value={
                  <>
                    {fmt(h.waitFrom, 1)}
                    <span className="num mx-1 text-[16px] text-stone">h →</span>
                    {fmt(h.waitTo, 1)}
                  </>
                }
                unit="h"
                caption={
                  <>
                    longest wait for big GPU training jobs, FCFS vs DMFQ-A at {fmt(h.gpuRate, 0)} jobs/h.{' '}
                    <span className="link group-hover:decoration-ink">See chart</span>
                  </>
                }
              />
            </Link>
            <Link href="/results/#llm-swaps" className="group block">
              <Stat
                value={`−${fmt(Math.abs(h.swapDelta) * 100, 0)}%`}
                caption={
                  <>
                    KV-cache swaps vs MLFQ:{' '}
                    <span className="num">
                      {fmt(h.swapsMLFQ, 0)} → {fmt(h.swapsDMFQA, 0)} swaps
                    </span>
                    , while keeping long-request stalls bounded.{' '}
                    <span className="link group-hover:decoration-ink">See chart</span>
                  </>
                }
              />
            </Link>
          </div>
        </div>
      </section>

      {/* The idea */}
      <section className="page py-24 md:py-32" aria-labelledby="idea-h">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Kicker tone="stone">The idea</Kicker>
            <h2 id="idea-h" className="mt-3 text-[32px] md:text-h2">
              Two small changes to a sixty-year-old scheduler
            </h2>
            <div className="prose-ed mt-6 text-ink-2">
              <p>
                <strong className="text-ink">Demotion</strong> is classic MLFQ: work that spends its whole quantum
                drops a level, so long jobs sink below new, short ones without the scheduler ever knowing their length.
              </p>
              <p>
                <strong className="text-ink">Adaptive quanta</strong> make the lower levels’ quanta grow with the
                number of waiting jobs, up to double. Under load the scheduler switches less often.
              </p>
              <p>
                <strong className="text-ink">Selective aging</strong> lifts a job that has waited past its level’s
                threshold by one level, instead of boosting everyone at once. Only jobs that actually waited move.
              </p>
            </div>
          </div>
          <div className="lg:col-span-7">
            <Figure n={1} caption="DMFQ-A in one diagram: demotion pushes long work down; aging lifts starved work back, one level at a time." source="Schematic · illustrative queue contents">
              <QueueDiagram />
            </Figure>
          </div>
        </div>
        <div className="mt-20 grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Kicker tone="stone">Try it</Kicker>
            <h3 className="mt-3 text-h3">Adaptive quanta respond to the queue, not to a clock</h3>
            <p className="mt-4 text-ink-2">
              Drag the slider to add waiting requests. Q0 stays short so new chats answer quickly; Q1 and Q2 budgets
              grow until they reach twice their base at eight waiting requests.
            </p>
          </div>
          <div className="lg:col-span-7">
            <QuantumWidget />
          </div>
        </div>
      </section>

      {/* Same problem, three resources */}
      <section className="border-t border-hairline" aria-labelledby="map-h">
        <div className="page py-24">
          <Kicker tone="stone">Same problem, three resources</Kicker>
          <h2 id="map-h" className="mt-3 max-w-3xl text-[32px] md:text-h2">
            Only the unit of the quantum changes
          </h2>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-ink text-left">
                  <th scope="col" className="w-[18%] py-3 pr-4" />
                  <th scope="col" className="py-3 pr-4 font-display text-xl font-semibold text-ink">CPU</th>
                  <th scope="col" className="py-3 pr-4 font-display text-xl font-semibold text-ink">LLM serving</th>
                  <th scope="col" className="py-3 pr-4 font-display text-xl font-semibold text-ink">GPU cluster</th>
                </tr>
              </thead>
              <tbody>
                {MAPPING.map(([k, ...v]) => (
                  <tr key={k} className="border-b border-hairline align-top">
                    <th scope="row" className="kicker py-3 pr-4 text-left text-[12px] text-stone">
                      {k}
                    </th>
                    {v.map((c) => (
                      <td key={c} className="py-3 pr-4 text-ink-2">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <ButtonLink href="/lab/">CPU: Scheduler Lab</ButtonLink>
            <ButtonLink href="/llm/">LLM serving, live</ButtonLink>
            <ButtonLink href="/gpu/">GPU cluster</ButtonLink>
          </div>
        </div>
      </section>

      {/* What is new */}
      <section className="border-t border-hairline bg-paper-2" aria-labelledby="new-h">
        <div className="page py-24">
          <Kicker tone="stone">What is new</Kicker>
          <h2 id="new-h" className="mt-3 max-w-4xl text-[32px] md:text-h2">
            The interaction between adaptive quanta and aging changes sign between workloads
          </h2>
          <p className="mt-6 max-w-3xl text-ink-2">
            Dynamic quanta plus aging has been proposed before, so the combination alone is not the contribution. What
            we add is a controlled ablation that switches each mechanism on and off, run on the same seeded workloads in
            two AI settings. Adding adaptive quanta on top of aging <em>removes</em> KV-cache swaps in LLM serving but{' '}
            <em>adds</em> preemptions in a GPU cluster.
          </p>
          <div className="mt-12 grid gap-16 lg:grid-cols-2">
            <AblationMatrix
              title={`LLM serving · ${fmt(by(llm, 'MLFQ').rate as number, 1)} req/s`}
              metric="KV swaps"
              unit="swaps"
              cells={{
                MLFQ: cell(llm, 'MLFQ', 'swaps', stall),
                'Dynamic MLFQ': cell(llm, 'Dynamic MLFQ', 'swaps', stall),
                'Aging MLFQ': cell(llm, 'Aging MLFQ', 'swaps', stall),
                'DMFQ-A': cell(llm, 'DMFQ-A', 'swaps', stall),
              }}
              caption="Token-level work: bigger budgets mean fewer evictions, with or without aging."
            />
            <AblationMatrix
              title={`GPU cluster · ${fmt(by(gpu, 'MLFQ').rate as number, 0)} jobs/h`}
              metric="Preemptions"
              unit="preemptions"
              cells={{
                MLFQ: cell(gpu, 'MLFQ', 'preemptions', wait),
                'Dynamic MLFQ': cell(gpu, 'Dynamic MLFQ', 'preemptions', wait),
                'Aging MLFQ': cell(gpu, 'Aging MLFQ', 'preemptions', wait),
                'DMFQ-A': cell(gpu, 'DMFQ-A', 'preemptions', wait),
              }}
              caption="Coarse-grained gang jobs: promoted jobs hold GPUs longer, so with aging on, adaptive quanta add preemptions (underlined)."
            />
          </div>
          <p className="mt-8 text-[13px] uppercase tracking-[0.08em] text-stone">
            Source: Final Review Report §8.1 and §8.4 · Python reference simulator · mean of 5 seeds · synthetic workloads
          </p>
        </div>
      </section>

      <section className="page py-24">
        <PullQuote cite="Final Review Report, §9">
          DMFQ-A is best pitched as a tunable scheduling layer for AI infrastructure, not as a new CPU algorithm.
        </PullQuote>
        <div className="mt-16 grid gap-10 md:grid-cols-3">
          {[
            ['LLM inference engines', 'Replace the FCFS waiting queue with DMFQ-A levels at each decoding step. Chat stays responsive; long answers keep streaming.'],
            ['GPU cluster managers', 'Use DMFQ-A as the job-queue policy: short experiments start quickly and aging bounds how long a big run can wait.'],
            ['Campus and lab clusters', 'A few GPUs shared by many student jobs: exactly where one large run can block everyone else.'],
          ].map(([t, d], i) => (
            <div key={t} className="rule-gold pt-4">
              <p className="num text-[13px] text-gold">0{i + 1}</p>
              <h3 className="mt-2 text-h3">{t}</h3>
              <p className="mt-3 text-[16px] text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
