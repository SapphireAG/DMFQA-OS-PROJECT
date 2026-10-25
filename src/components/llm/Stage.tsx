'use client';
import { memo, useEffect, useRef, useState } from 'react';
import { EV, type Frame, type LLMRequest, type Policy } from '@/engine/types';
import { LEVEL_COLOR, LEVEL_NAME } from '@/lib/policy';
import { useWidth } from '@/components/charts/useWidth';
import type { Replay } from './replay';

const CHIP = 14;
const GAP = 4;

export function Glyph({ long, color, size = CHIP }: { long: boolean; color: string; size?: number }) {
  return long ? (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
      <path d="M7,0.5 L13.5,7 L7,13.5 L0.5,7Z" fill={color} />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
      <circle cx="7" cy="7" r="5.5" fill={color} />
    </svg>
  );
}

/** Queue lanes: waiting requests as chips that slide between levels on demote/promote. */
export const Lanes = memo(function Lanes({
  lanes,
  requests,
  longCutoff,
  multilevel,
  compact = false,
}: {
  lanes: number[][];
  requests: LLMRequest[];
  longCutoff: number;
  multilevel: boolean;
  compact?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(480);
  const laneH = compact ? 30 : 44;
  const labelW = multilevel ? (compact ? 34 : 56) : compact ? 48 : 76;
  const step = CHIP + GAP;
  const cap = Math.max(1, Math.floor((width - labelW - 52) / step));
  const rows = multilevel ? [0, 1, 2] : [0];
  const all = multilevel ? lanes : [[...lanes[0], ...lanes[1], ...lanes[2]]];

  return (
    <div ref={ref} className="relative" style={{ height: rows.length * laneH }}>
      {rows.map((l) => (
        <div
          key={l}
          className="absolute inset-x-0 flex items-center border-b border-hairline"
          style={{ top: l * laneH, height: laneH }}
        >
          <span
            className="absolute inset-y-1 left-0 w-1"
            style={{ background: multilevel ? LEVEL_COLOR[l] : 'var(--s-fcfs)' }}
            aria-hidden
          />
          <span className={`pl-3 font-display font-semibold text-ink ${compact ? 'text-[13px]' : 'text-[17px]'}`}>
            {multilevel ? LEVEL_NAME[l] : 'FIFO'}
          </span>
          <span className="num absolute right-0 text-[12px] text-stone">
            {all[l].length > cap ? `+${all[l].length - cap}` : ''}
          </span>
        </div>
      ))}
      {rows.flatMap((l) =>
        all[l].slice(0, cap).map((id, k) => {
          const long = requests[id].output > longCutoff;
          return (
            <div
              key={id}
              className="chip absolute left-0 top-0"
              style={{
                transform: `translate(${labelW + k * step}px, ${l * laneH + (laneH - CHIP) / 2}px)`,
              }}
              title={`#${id} · ${long ? 'long' : 'chat'} · waiting`}
            >
              <Glyph long={long} color={multilevel ? LEVEL_COLOR[l] : 'var(--ink-2)'} />
            </div>
          );
        }),
      )}
    </div>
  );
});

/** 4×4 KV-cache slots; a slot lights up while its request generates, and flashes gold on swap-in. */
export function KVGrid({
  frames,
  idx,
  replay,
  requests,
  longCutoff,
  multilevel,
  compact = false,
}: {
  frames: Frame[];
  idx: number;
  replay: Replay;
  requests: LLMRequest[];
  longCutoff: number;
  multilevel: boolean;
  compact?: boolean;
}) {
  const slots = idx >= 0 ? frames[idx].slots : new Array(16).fill(-1);
  const lastIdx = useRef(idx);
  const [flash, setFlash] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    const from = lastIdx.current;
    lastIdx.current = idx;
    if (idx <= from || idx < 0) return;
    const resumed = new Set<number>();
    for (let f = Math.max(0, from + 1, idx - 60); f <= idx; f++) {
      const ev = frames[f].ev;
      for (let k = 0; k < ev.length; k += 3) if (ev[k] === EV.resume) resumed.add(ev[k + 1]);
    }
    if (!resumed.size) return;
    setFlash((m) => {
      const n = new Map(m);
      slots.forEach((id, s) => {
        if (resumed.has(id)) n.set(s, (n.get(s) ?? 0) + 1);
      });
      return n;
    });
  }, [idx, frames, slots]);

  const size = compact ? 'h-7' : 'h-12 md:h-14';
  return (
    <div className="grid grid-cols-4 gap-1" role="list" aria-label="KV-cache slots">
      {slots.map((id, s) => {
        const busy = id >= 0;
        const lvl = busy ? replay.level[id] : 0;
        return (
          <div
            role="listitem"
            key={`${s}-${flash.get(s) ?? 0}`}
            className={`relative flex items-center justify-center border ${size} ${
              busy ? 'border-ink bg-ink text-paper' : 'border-hairline bg-idle text-stone'
            } ${flash.get(s) ? 'flash-gold' : ''}`}
            title={busy ? `Slot ${s + 1}: #${id}, ${multilevel ? LEVEL_NAME[lvl] : 'FIFO'}` : `Slot ${s + 1}: free`}
          >
            {busy && (
              <>
                <span
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: multilevel ? LEVEL_COLOR[lvl] : 'var(--s-fcfs)' }}
                  aria-hidden
                />
                {!compact && (
                  <span className="flex items-center gap-1">
                    <Glyph long={requests[id].output > longCutoff} color="var(--paper)" size={10} />
                    <span className="num text-[11px]">#{id}</span>
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StageHeader({
  policy,
  t,
  accent,
  compact,
}: {
  policy: Policy;
  t: string;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <p
        className={`truncate font-display font-semibold ${compact ? 'text-[17px]' : 'text-[20px]'} ${accent ? 'text-accent-ink' : 'text-ink'}`}
      >
        {policy}
      </p>
      <p className="num shrink-0 text-[12px] text-stone">{t}</p>
    </div>
  );
}
