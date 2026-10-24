import type { Policy } from '@/engine/types';
import { fmt } from '@/lib/format';
import { POLICY_STYLE } from '@/lib/policy';
import { MarkerSwatch } from '../charts/Marker';

type Cell = { policy: Policy; value: number; second?: string };

/**
 * 2×2 ablation (dynamic quanta × aging). Shows the effect of adding adaptive quanta inside
 * each aging row, so the reader can see the interaction's sign.
 */
export function AblationMatrix({
  title,
  metric,
  unit,
  cells,
  caption,
}: {
  title: string;
  metric: string;
  unit: string;
  cells: Record<'MLFQ' | 'Dynamic MLFQ' | 'Aging MLFQ' | 'DMFQ-A', Cell>;
  caption?: React.ReactNode;
}) {
  const delta = (a: number, b: number) => b / a - 1;
  const rows: { label: string; left: Cell; right: Cell }[] = [
    { label: 'No aging', left: cells.MLFQ, right: cells['Dynamic MLFQ'] },
    { label: 'Selective aging', left: cells['Aging MLFQ'], right: cells['DMFQ-A'] },
  ];
  const sign = (d: number) => (d > 0 ? '+' : '−');
  return (
    <div>
      <p className="kicker text-stone">{title}</p>
      <div className="mt-3 grid grid-cols-[88px_1fr_56px_1fr] items-stretch text-[14px] md:grid-cols-[120px_1fr_72px_1fr]">
        <div />
        <div className="kicker pb-2 text-[11px] text-stone">Fixed quanta</div>
        <div />
        <div className="kicker pb-2 text-[11px] text-stone">Adaptive quanta</div>
        {rows.map((r) => {
          const d = delta(r.left.value, r.right.value);
          return (
            <div key={r.label} className="contents">
              <div className="kicker flex items-center border-t border-hairline pr-2 text-[11px] text-stone">{r.label}</div>
              <CellBox c={r.left} unit={unit} metric={metric} />
              <div className="flex flex-col items-center justify-center border-t border-hairline">
                <span aria-hidden className="text-stone">→</span>
                <span className={`num text-[13px] ${d > 0 ? 'font-semibold text-ink underline decoration-gold decoration-2' : 'text-ink'}`}>
                  {sign(d)}
                  {fmt(Math.abs(d) * 100, 0)}%
                </span>
              </div>
              <CellBox c={r.right} unit={unit} metric={metric} />
            </div>
          );
        })}
      </div>
      {caption && <p className="mt-3 text-[14px] text-stone">{caption}</p>}
    </div>
  );
}

function CellBox({ c, unit, metric }: { c: Cell; unit: string; metric: string }) {
  const st = POLICY_STYLE[c.policy];
  const hero = c.policy === 'DMFQ-A';
  return (
    <div className={`border-t border-hairline py-3 pr-2 ${hero ? 'bg-paper-2' : ''}`}>
      <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
        <MarkerSwatch shape={st.marker} color={st.color} />
        <span className={hero ? 'font-semibold text-ink' : ''}>{c.policy}</span>
      </p>
      <p className="mt-1 font-display text-[26px] font-semibold leading-none tabular-nums text-ink md:text-[30px]">
        {fmt(c.value, 0)}
        <span className="num ml-1 text-[12px] font-normal text-stone">{unit}</span>
      </p>
      <p className="mt-1 text-[12px] text-stone">
        {metric}
        {c.second ? ` · ${c.second}` : ''}
      </p>
    </div>
  );
}
