'use client';
import { scaleLinear } from 'd3-scale';
import { useState } from 'react';
import type { CPUMark, GanttSeg } from '@/engine/types';
import { LEVEL_COLOR, LEVEL_NAME } from '@/lib/policy';
import { Tooltip } from '../ui/Tooltip';

/**
 * One policy's CPU timeline: a row per process, bars coloured by queue level.
 * Promotions are gold carets above the bar; preemptions are hairline ticks.
 */
export function Gantt({
  title,
  pids,
  segments,
  marks,
  tMax,
  width,
}: {
  title: string;
  pids: string[];
  segments: GanttSeg[];
  marks: CPUMark[];
  tMax: number;
  width: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const m = { l: 44, r: 12, t: 8, b: 24 };
  const rowH = 18;
  const h = m.t + pids.length * rowH + m.b;
  const x = scaleLinear().domain([0, tMax]).range([m.l, width - m.r]);
  const y = (pid: string) => m.t + pids.indexOf(pid) * rowH;
  const ticks = x.ticks(Math.max(4, Math.floor(width / 90)));

  return (
    <div className="relative">
      <svg width={width} height={h} role="img" aria-label={title} className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={m.t} y2={h - m.b} stroke="var(--hairline)" />
            <text x={x(t)} y={h - 6} textAnchor="middle" fontSize={12} className="num" fill="var(--stone)">
              {t}
            </text>
          </g>
        ))}
        {pids.map((p) => (
          <text key={p} x={m.l - 8} y={y(p) + rowH / 2 + 4} textAnchor="end" fontSize={12} className="num" fill="var(--ink-2)">
            {p}
          </text>
        ))}
        {segments.map((s, i) => (
          <rect
            key={i}
            x={x(s.start)}
            y={y(s.pid) + 3}
            width={Math.max(1, x(s.end) - x(s.start) - 1)}
            height={rowH - 6}
            fill={LEVEL_COLOR[s.level]}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        {marks.map((mk, i) =>
          mk.kind === 'promote' ? (
            <path
              key={`m${i}`}
              d={`M${x(mk.t) - 4},${y(mk.pid) + 2} L${x(mk.t)},${y(mk.pid) - 3} L${x(mk.t) + 4},${y(mk.pid) + 2}`}
              fill="none"
              stroke="var(--gold)"
              strokeWidth={1.5}
            >
              <title>{`${mk.pid} promoted at ${mk.t} ms`}</title>
            </path>
          ) : (
            <line key={`m${i}`} x1={x(mk.t)} x2={x(mk.t)} y1={y(mk.pid)} y2={y(mk.pid) + rowH} stroke="var(--ink)" strokeWidth={1}>
              <title>{`${mk.pid} preempted at ${mk.t} ms`}</title>
            </line>
          ),
        )}
      </svg>
      {hover !== null && (
        <Tooltip x={(x(segments[hover].start) + x(segments[hover].end)) / 2} y={y(segments[hover].pid)}>
          <span className="font-semibold">{segments[hover].pid}</span> · {LEVEL_NAME[segments[hover].level]} ·{' '}
          <span className="num">
            {segments[hover].start}–{segments[hover].end} ms
          </span>
        </Tooltip>
      )}
    </div>
  );
}
