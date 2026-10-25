import type { Metadata } from 'next';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { PageHeader } from '@/components/editorial/PageHeader';
import { Kicker } from '@/components/editorial/Kicker';

export const metadata: Metadata = { title: 'Method & References' };

const formula = katex.renderToString(
  'q = \\min\\left(2b,\; b + \\left\\lfloor \\frac{b \\cdot \\min(R, \\mathit{ref})}{\\mathit{ref}} \\right\\rfloor\\right), \\qquad \\mathit{ref} = 8',
  { displayMode: true, output: 'html', throwOnError: true },
);

const RULES = [
  'A new job enters Q0.',
  'The scheduler always serves the highest non-empty queue; within a queue, jobs run round-robin, ordered by when they entered the level.',
  'A job that uses its whole quantum is demoted one level (Q2 re-enqueues at the back of Q2).',
  'A higher-priority arrival preempts the running job. The preempted job keeps its remaining quantum; the preemption counts as a context switch.',
  'Adaptive quanta (Dynamic MLFQ, DMFQ-A): Q1 and Q2 quanta grow with R, the number of other waiting jobs, up to twice the base b. Q0 stays fixed.',
  'Selective aging (Aging MLFQ, DMFQ-A): a job that has waited continuously past its level’s threshold moves up one level and receives a fresh quantum. Running jobs reset their aging clock.',
];

const PARAMS: [string, string, string, string][] = [
  ['Unit of work', 'Process', 'Request (prompt + output tokens)', 'Training job on 1–16 GPUs'],
  ['Q0 / Q1 base / Q2 base', '4 / 8 / 16 ms', '16 / 32 / 64 tokens', '60 / 240 / 960 GPU-minutes'],
  ['Aging Q1→Q0 / Q2→Q1', '24 ms / 48 ms', '1.5 s / 3 s', '1 h / 2 h'],
  ['ref', '8', '8', '8'],
  ['Capacity', '1 CPU', '16 KV-cache slots', '64 GPUs, gang placement'],
  ['Step / clock', '1 ms', '12 ms + 0.6 ms per sequence', '1 minute'],
  ['Switch cost', '0 (counted only)', 'Prefill 0.02 ms/prompt token; swap-in 0.004 ms/cached token', '2-minute restore after preemption'],
  ['Workload', 'Editable table / presets', 'Poisson 1.2–2.4 req/s; 80% chat (median 120 output tokens), 20% long (median 900); prompts median 250 / 1,200', 'Poisson 5–7 jobs/h; 1/2/4/8/16 GPUs at 35/20/20/15/10%; duration lognormal, median 60 min, capped at 3 days'],
  ['"Long" cut-off', '—', '> 512 output tokens', '> 960 GPU-minutes'],
];

const REFS: { text: string; href?: string }[] = [
  { text: 'R. H. Arpaci-Dusseau and A. C. Arpaci-Dusseau, Operating Systems: Three Easy Pieces, ch. 8, “Scheduling: The Multi-Level Feedback Queue.” Arpaci-Dusseau Books, 2018.', href: 'https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf' },
  { text: 'F. J. Corbató, M. Merwin-Daggett and R. C. Daley, “An experimental time-sharing system,” in Proc. AFIPS Spring Joint Computer Conf., 1962.', href: 'https://doi.org/10.1145/1460833.1460871' },
  { text: 'Behera et al., dynamic time quantum for multilevel feedback queues, 2012. [Full citation as given in the Review 1 report.]' },
  { text: '“Developed Dynamic Multilevel Feedback Queue with Aging Criteria,” preprint, 2020. [Full citation as given in the Review 1 report.]' },
  { text: 'L. W. C. Meing and D. R. Tandingan Jr., “Exploring multilevel feedback queue combinations and regression-based time quanta in scheduling algorithms,” J. Inf. Syst. Eng. Manag., vol. 10, no. 6s, 2025.', href: 'https://doi.org/10.52783/jisem.v10i6s.699' },
  { text: 'B. Wu, Y. Zhong, Z. Zhang, S. Liu, F. Liu, Y. Sun, G. Huang, X. Liu and X. Jin, “FastServe: Iteration-level preemptive scheduling for large language model inference,” in Proc. USENIX NSDI, 2026, pp. 57–74. Preprint: arXiv:2305.05920.', href: 'https://arxiv.org/abs/2305.05920' },
  { text: 'J. Gu, M. Chowdhury, K. G. Shin, Y. Zhu, M. Jeon, J. Qian, H. Liu and C. Guo, “Tiresias: A GPU cluster manager for distributed deep learning,” in Proc. USENIX NSDI, 2019, pp. 485–500.', href: 'https://www.usenix.org/conference/nsdi19/presentation/gu' },
  { text: 'G.-I. Yu, J. S. Jeong, G.-W. Kim, S. Kim and B.-G. Chun, “Orca: A distributed serving system for transformer-based generative models,” in Proc. USENIX OSDI, 2022.', href: 'https://www.usenix.org/conference/osdi22/presentation/yu' },
  { text: 'W. Kwon, Z. Li, S. Zhuang, Y. Sheng, L. Zheng, C. H. Yu, J. E. Gonzalez, H. Zhang and I. Stoica, “Efficient memory management for large language model serving with PagedAttention,” in Proc. ACM SOSP, 2023.', href: 'https://doi.org/10.1145/3600006.3613165' },
  { text: 'Y. Sheng, S. Cao, D. Li, B. Zhu, Z. Li, D. Zhuo, J. E. Gonzalez and I. Stoica, “Fairness in serving large language models,” in Proc. USENIX OSDI, 2024.', href: 'https://www.usenix.org/conference/osdi24/presentation/sheng' },
  { text: 'Y. Fu, S. Zhu, R. Su, A. Qiao, I. Stoica and H. Zhang, “Efficient LLM scheduling by learning to rank,” in Proc. NeurIPS, 2024, pp. 59006–59029.', href: 'https://arxiv.org/abs/2408.15792' },
  { text: 'W. Bai, L. Chen, K. Chen, D. Han, C. Tian and H. Wang, “Information-agnostic flow scheduling for commodity data centers,” in Proc. USENIX NSDI, 2015.', href: 'https://www.usenix.org/conference/nsdi15/technical-sessions/presentation/bai' },
  { text: 'M. Jeon, S. Venkataraman, A. Phanishayee, J. Qian, W. Xiao and F. Yang, “Analysis of large-scale multi-tenant GPU clusters for DNN training workloads,” in Proc. USENIX ATC, 2019.', href: 'https://www.usenix.org/conference/atc19/presentation/jeon' },
];

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="grid gap-6 border-t border-hairline py-16 lg:grid-cols-12" aria-labelledby={`${id}-h`}>
      <div className="lg:col-span-4">
        <Kicker tone="stone">{kicker}</Kicker>
        <h2 id={`${id}-h`} className="mt-2 text-[28px] md:text-[32px]">
          {title}
        </h2>
      </div>
      <div className="min-w-0 lg:col-span-8">{children}</div>
    </section>
  );
}

const list = 'space-y-2 text-ink-2 [&>li]:pl-1';

export default function MethodPage() {
  return (
    <>
      <PageHeader
        number="06"
        kicker="Method & References"
        title="Three levels, two mechanisms, one rule set for three resources"
        dek="The rules every simulation on this site follows, the parameters for each setting, the assumptions behind them, and what we would do next."
      />
      <div className="page">
        <Section id="rules" kicker="Algorithm" title="Base rules, shared by every feedback-queue policy">
          <ol className={`${list} list-decimal pl-5`}>
            {RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <div className="mt-8 overflow-x-auto border border-hairline bg-paper-2 px-4 py-2 text-ink" dangerouslySetInnerHTML={{ __html: formula }} />
          <p className="mt-3 text-[15px] text-ink-2">
            b is the level’s base quantum and R the number of waiting jobs excluding the one receiving the quantum. Under
            light load quanta stay short and responsive; under heavy load the scheduler switches less often.
          </p>
          <table className="mt-8 w-full border-collapse text-[15px]">
            <caption className="mb-2 text-left text-[13px] text-stone">The ablation: each mechanism switches off independently.</caption>
            <thead>
              <tr className="border-b border-ink text-left">
                {['Policy', 'Multilevel', 'Adaptive quanta', 'Aging'].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-3 font-semibold text-ink">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['FCFS (AI baseline only)', '✗', '✗', '✗'],
                ['MLFQ', '✓', '✗', '✗'],
                ['Dynamic MLFQ', '✓', '✓', '✗'],
                ['Aging MLFQ', '✓', '✗', '✓'],
                ['DMFQ-A', '✓', '✓', '✓'],
              ].map((r) => (
                <tr key={r[0]} className="border-b border-hairline">
                  {r.map((c, i) => (i === 0 ? <th key={i} scope="row" className="py-2 pr-3 text-left font-normal text-ink">{c}</th> : <td key={i} className="py-2 pr-3 text-ink-2">{c}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section id="params" kicker="Parameters" title="CPU, LLM serving and GPU cluster">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-ink text-left">
                  {['', 'CPU', 'LLM serving', 'GPU cluster'].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-3 font-semibold text-ink">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PARAMS.map(([k, ...v]) => (
                  <tr key={k} className="border-b border-hairline align-top">
                    <th scope="row" className="py-2 pr-3 text-left text-[13px] font-semibold text-stone">{k}</th>
                    {v.map((c, i) => (
                      <td key={i} className="py-2 pr-3 text-ink-2">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[14px] text-stone">
            The report’s experiments use 1,500 requests and 500 jobs per run, five seeds per load point (11, 23, 37, 41,
            53). The live pages use 400 requests and 200 jobs so a run finishes in a fraction of a second.
          </p>
        </Section>

        <Section id="assumptions" kicker="Model" title="Assumptions">
          <ul className={`${list} list-disc pl-5`}>
            <li>CPU: a single CPU, no I/O, context switches counted, zero switch time.</li>
            <li>LLM: one serving node; each batched request gains one token per decoding step; linear costs for decode, prefill and KV swap-in.</li>
            <li>GPU: one-minute steps; gang (all-or-nothing) placement; FCFS is strict FIFO; multilevel policies fill greedily in priority order with backfill.</li>
            <li>All workloads are synthetic distributions chosen to resemble chat and training mixes, not replays of production traces.</li>
          </ul>
          <div className="mt-8 border border-hairline bg-paper-2 p-5 text-[15px]">
            <p className="kicker text-stone">Notes on the in-browser port</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-2">
              <li>The live pages run a TypeScript port of the Python reference rules. It uses its own seeded RNG (mulberry32), so absolute numbers differ from the report; the orderings are what to compare.</li>
              <li>The report gives medians only. The port assumes lognormal σ = 0.7 (chat output), 0.5 (long output and prompts) and 1.15 (GPU duration). These are flagged in the source and should be replaced by the reference values.</li>
              <li>GPU restore minutes occupy GPUs but do not count towards attained service. CPU context switches count CPU hand-overs between different processes.</li>
              <li>Parity tests against the Python reference run automatically once its golden fixtures are added to the repository.</li>
            </ul>
          </div>
        </Section>

        <Section id="limits" kicker="Honesty" title="Limitations">
          <ul className={`${list} list-disc pl-5`}>
            <li>Workloads are synthetic distributions, not production traces.</li>
            <li>The cost model for decoding, prefill and swaps is linear.</li>
            <li>The LLM study models one serving node, without prefix caching or chunked prefill.</li>
            <li>GPU placement ignores network topology.</li>
            <li>The AI case studies use a Python prototype rather than the C11 engine.</li>
          </ul>
        </Section>

        <Section id="future" kicker="Next" title="Future work">
          <ol className={`${list} list-decimal pl-5`}>
            <li><strong className="text-ink">Load-aware aging.</strong> Scale the aging threshold with READY pressure, as the quanta already are, to remove thrashing near saturation.</li>
            <li><strong className="text-ink">SLO-aware thresholds.</strong> Derive aging limits from a time-to-first-token target, following FastServe’s SLO-tuned α [6].</li>
            <li><strong className="text-ink">Real traces.</strong> Replay public chat-length data and the Philly GPU-cluster trace [13].</li>
            <li><strong className="text-ink">Engine prototype.</strong> Implement the policy inside an open-source serving engine and measure real swap costs.</li>
          </ol>
        </Section>

        <Section id="refs" kicker="Sources" title="References">
          <ol className="space-y-3 text-[15px] text-ink-2">
            {REFS.map((r, i) => (
              <li key={i} className="grid grid-cols-[36px_1fr]">
                <span className="num text-stone">[{i + 1}]</span>
                <span>
                  {r.text}{' '}
                  {r.href && (
                    <a className="link break-all text-ink" href={r.href} rel="noopener">
                      Link
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </>
  );
}
