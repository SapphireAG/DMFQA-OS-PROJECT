import type { Metadata } from 'next';
import { PageHeader } from '@/components/editorial/PageHeader';
import { ResultsExplorer } from '@/components/results/ResultsExplorer';
import { reportGPU, reportLLM, tsGPUSweep, tsLLMSweep } from '@/lib/data';

export const metadata: Metadata = { title: 'Results Explorer' };

export default function ResultsPage() {
  return (
    <>
      <PageHeader
        number="05"
        kicker="Results Explorer"
        title="Feedback queues remove head-of-line blocking; aging decides who pays"
        dek="Every chart states its finding in the title. Filter by policy and load; colours and markers never change. Each chart has a table view and a CSV of exactly what is plotted."
      />
      <ResultsExplorer
        reportLLM={reportLLM()}
        reportGPU={reportGPU()}
        sweepLLM={tsLLMSweep()}
        sweepGPU={tsGPUSweep()}
      />
    </>
  );
}
