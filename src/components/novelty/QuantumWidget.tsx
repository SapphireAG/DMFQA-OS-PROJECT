'use client';
import { useState } from 'react';
import { dynQuantum } from '@/engine/quantum';
import { Slider } from '../ui/Slider';

/** Interactive: how Q1/Q2 token budgets respond to queue pressure R (LLM units). */
export function QuantumWidget() {
  const [R, setR] = useState(3);
  const ref = 8;
  const rows = [
    { name: 'Q0', base: 16, q: 16, color: 'var(--q0)', note: 'fixed' },
    { name: 'Q1', base: 32, q: dynQuantum(32, R, ref), color: 'var(--q1)', note: 'b = 32' },
    { name: 'Q2', base: 64, q: dynQuantum(64, R, ref), color: 'var(--q2)', note: 'b = 64' },
  ];
  const maxQ = 128;
  return (
    <div>
      <Slider
        label="Waiting requests R"
        value={R}
        min={0}
        max={12}
        step={1}
        onChange={setR}
        format={(v) => `${v} waiting`}
      />
      <div className="mt-6 space-y-3" aria-live="polite">
        {rows.map((r) => (
          <div key={r.name} className="grid grid-cols-[40px_1fr_96px] items-center gap-3">
            <span className="font-display text-lg font-semibold text-ink">{r.name}</span>
            <div className="relative h-5 bg-idle">
              <div className="absolute inset-y-0 left-0 border-r border-dashed border-stone" style={{ width: `${(r.base / maxQ) * 100}%` }} />
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-200 ease-out"
                style={{ width: `${(r.q / maxQ) * 100}%`, background: r.color, opacity: 0.9 }}
              />
            </div>
            <span className="num text-right text-[14px] text-ink">{r.q} tokens</span>
          </div>
        ))}
      </div>
      <p className="mt-4 font-mono text-[14px] text-ink-2">
        q = min(2b, b + ⌊b · min(R, {ref}) / {ref}⌋)
      </p>
      <p className="mt-2 text-[14px] text-stone">
        Dashed line = base budget b. Under load, long requests get longer turns, so the batch is reshuffled less often:
        fewer KV-cache swaps.
      </p>
    </div>
  );
}
