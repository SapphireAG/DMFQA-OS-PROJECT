import type { Metadata } from 'next';
import { PageHeader } from '@/components/editorial/PageHeader';
import { Lab } from '@/components/lab/Lab';

export const metadata: Metadata = { title: 'Scheduler Lab' };

export default function LabPage() {
  return (
    <>
      <PageHeader
        number="02"
        kicker="Scheduler Lab · CPU core study"
        title="Switch each mechanism on and off, and watch the schedule change"
        dek="The four-policy ablation from Review 1: MLFQ, Dynamic MLFQ (adaptive quanta only), Aging MLFQ (aging only) and DMFQ-A (both). Edit the processes or the parameters; all four policies re-run instantly on the same input."
      />
      <div className="page">
        <Lab />
      </div>
    </>
  );
}
