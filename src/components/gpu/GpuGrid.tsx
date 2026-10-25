'use client';
import { useState } from 'react';
import type { GPUFrame, GPUJob } from '@/engine/types';
import { hm } from '@/lib/format';
import { LEVEL_COLOR, LEVEL_NAME } from '@/lib/policy';

/** 8×8 GPUs; each running gang is a block coloured by its level. */
export function GpuGrid({
  frames,
  idx,
  jobs,
  level,
  multilevel,
}: {
  frames: GPUFrame[];
  idx: number;
  jobs: GPUJob[];
  level: Int8Array;
  multilevel: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const grid = idx >= 0 ? frames[idx].grid : new Array(64).fill(-1);
  const t = idx >= 0 ? frames[idx].t : 0;

  // GPU-minutes held and minutes waited so far, for the hovered job only
  let info: { held: number; waited: number } | null = null;
  if (hover !== null && hover >= 0) {
    let mins = 0;
    for (let f = 0; f <= idx; f++) if (frames[f].grid.includes(hover)) mins++;
    info = { held: mins * jobs[hover].gpus, waited: Math.max(0, t - jobs[hover].arrival - mins) };
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-8 gap-[3px]" role="list" aria-label="64 GPUs">
        {grid.map((j, g) => {
          const busy = j >= 0;
          const head = busy && grid.indexOf(j) === g;
          const color = busy ? (multilevel ? LEVEL_COLOR[level[j]] : 'var(--s-fcfs)') : 'var(--idle)';
          return (
            <div
              key={g}
              role="listitem"
              tabIndex={busy ? 0 : -1}
              onMouseEnter={() => setHover(j)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(j)}
              onBlur={() => setHover(null)}
              className={`relative aspect-square ${hover !== null && hover === j ? 'outline outline-2 outline-gold' : ''}`}
              style={{ background: color, opacity: busy ? 0.92 : 1 }}
              aria-label={busy ? `GPU ${g + 1}: job ${j}` : `GPU ${g + 1}: idle`}
            >
              {head && (
                <span className="num absolute left-0.5 top-0 text-[10px] leading-tight text-paper mix-blend-normal">
                  J{j}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {hover !== null && hover >= 0 && info && (
        <div className="absolute inset-x-0 -bottom-2 translate-y-full border border-ink bg-paper px-3 py-2 text-[13px] text-ink" role="tooltip">
          <span className="font-semibold">Job {hover}</span> · {jobs[hover].gpus} GPUs ·{' '}
          {multilevel ? LEVEL_NAME[level[hover]] : 'FIFO'} ·{' '}
          <span className="num">{info.held.toLocaleString('en-GB')} GPU-min held</span> ·{' '}
          <span className="num">waited {hm(info.waited)}</span>
        </div>
      )}
    </div>
  );
}
