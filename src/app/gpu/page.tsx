import type { Metadata } from 'next';
import { PageHeader } from '@/components/editorial/PageHeader';
import { GPUDemo } from '@/components/gpu/GPUDemo';
import { SyntheticTag } from '@/components/ui/Tag';

export const metadata: Metadata = { title: 'GPU Cluster' };

const RULES = [
  ['Quantum', 'Attained GPU-minutes: Q0 60; Q1 and Q2 bases of 240 and 960, growing to 480 and 1,920 under load. A 16-GPU job uses up Q0 in 4 minutes; a 1-GPU job gets an hour.'],
  ['Preemption', 'A checkpoint, then 2 minutes to restore when the job resumes. The cluster’s context switch is expensive, so it is counted.'],
  ['Aging', 'Q1 → Q0 after 1 h of waiting, Q2 → Q1 after 2 h. Similar to Tiresias’ PromoteKnob, but one level at a time.'],
  ['Placement', 'Gang (all-or-nothing) on 64 GPUs. Higher levels are placed first, and smaller jobs backfill the gaps.'],
];

export default function GPUPage() {
  return (
    <>
      <PageHeader
        number="04"
        kicker="GPU Cluster"
        title="One big job at the head of the line can idle a cluster"
        dek="Training jobs on 1 to 16 GPUs share 64 GPUs, and nobody knows how long a job will run until it converges. Under strict FIFO, a 16-GPU job at the head waits for space while smaller jobs sit behind it. Feedback queues let them backfill, and aging stops big jobs waiting for a day."
      >
        <div className="mt-6">
          <SyntheticTag>Synthetic workload · TS engine in your browser</SyntheticTag>
        </div>
      </PageHeader>
      <div className="page">
        <GPUDemo />
        <section className="mt-20 border-t border-ink pt-8" aria-labelledby="gpu-rules">
          <h2 id="gpu-rules" className="kicker font-sans text-stone">
            Same rules, coarser clock
          </h2>
          <dl className="mt-4 grid gap-8 md:grid-cols-4">
            {RULES.map(([k, v]) => (
              <div key={k} className="rule-gold pt-3">
                <dt className="font-display text-[22px] font-semibold text-ink">{k}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
