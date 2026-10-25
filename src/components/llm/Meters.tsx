'use client';
import { useEffect, useRef, useState } from 'react';
import type { LLMMeters } from '@/engine/llm';
import type { Policy } from '@/engine/types';
import { fmt } from '@/lib/format';
import { POLICY_STYLE } from '@/lib/policy';
import { MarkerSwatch } from '@/components/charts/Marker';

export interface MeterRow {
  policy: Policy;
  meters: LLMMeters;
  idx: number;
}

const read = (m: LLMMeters, i: number) =>
  i < 0
    ? { p99: NaN, stall: NaN, swaps: 0, tps: NaN }
    : { p99: m.p99[i], stall: m.stall[i], swaps: m.swaps[i], tps: m.tps[i] };

export function Meters({ rows, seed }: { rows: MeterRow[]; seed: number }) {
  // screen readers: at most one polite update per second
  const [spoken, setSpoken] = useState('');
  const latest = useRef(rows);
  latest.current = rows;
  useEffect(() => {
    const id = setInterval(() => {
      setSpoken(
        latest.current
          .map((r) => {
            const v = read(r.meters, r.idx);
            return `${r.policy}: p99 TTFT ${fmt(v.p99, 2)} seconds, longest stall ${fmt(v.stall, 1)} seconds, ${v.swaps} swaps`;
          })
          .join('. '),
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-ink text-left">
              <th scope="col" className="py-2 pr-3 font-semibold text-ink">
                Policy
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold text-ink">
                p99 TTFT, short
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold text-ink">
                Longest stall, long
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold text-ink">
                KV swaps
              </th>
              <th scope="col" className="py-2 text-right font-semibold text-ink">
                Throughput
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = read(r.meters, r.idx);
              const st = POLICY_STYLE[r.policy];
              const hero = r.policy === 'DMFQ-A';
              const c = hero ? 'text-accent-ink font-medium' : 'text-ink';
              return (
                <tr key={r.policy} className="border-b border-hairline">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <MarkerSwatch shape={st.marker} color={st.color} />
                      <span className={hero ? 'font-semibold text-ink' : 'text-ink'}>{r.policy}</span>
                    </span>
                  </th>
                  <td className={`num py-2 pr-3 text-right ${c}`}>{fmt(v.p99, 2)} s</td>
                  <td className={`num py-2 pr-3 text-right ${c}`}>{fmt(v.stall, 1)} s</td>
                  <td className={`num py-2 pr-3 text-right ${c}`}>{fmt(v.swaps, 0)} swaps</td>
                  <td className={`num py-2 text-right ${c}`}>{fmt(v.tps, 0)} tok/s</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] uppercase tracking-[0.08em] text-stone">
        Synthetic workload · TS engine · seed {seed} · meters update live and end equal to a non-animated run
      </p>
      <p className="sr-only" aria-live="polite">
        {spoken}
      </p>
    </div>
  );
}
