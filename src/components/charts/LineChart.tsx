'use client';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import { useState } from 'react';
import type { Policy } from '@/engine/types';
import { POLICY_STYLE } from '@/lib/policy';
import { ChartFrame } from './ChartFrame';
import { Marker } from './Marker';
import { Tooltip } from '../ui/Tooltip';
import { useWidth } from './useWidth';

export interface Series {
  policy: Policy;
  points: { x: number; y: number }[];
}

/** De-overlap end labels: push apart so consecutive labels are at least `gap` px. */
function spread(ys: number[], gap: number, lo: number, hi: number) {
  const idx = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < idx.length; k++) idx[k].y = Math.max(idx[k].y, idx[k - 1].y + gap);
  const over = idx.length ? idx[idx.length - 1].y - hi : 0;
  if (over > 0) for (const p of idx) p.y -= over;
  for (let k = idx.length - 2; k >= 0; k--) idx[k].y = Math.min(idx[k].y, idx[k + 1].y - gap);
  const out = new Array<number>(ys.length);
  for (const p of idx) out[p.i] = Math.max(lo, p.y);
  return out;
}

export function LineChart({
  title,
  series,
  xLabel,
  yLabel,
  formatX,
  formatY,
  csvName,
  subtitle,
  height = 300,
}: {
  title: string;
  series: Series[];
  xLabel: string;
  yLabel: string;
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  csvName: string;
  subtitle?: React.ReactNode;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ s: number; p: number } | null>(null);
  const m = { l: 56, r: 92, t: 12, b: 44 };
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const ys = series.flatMap((s) => s.points.map((p) => p.y));
  const x = scaleLinear()
    .domain([Math.min(...xs), Math.max(...xs)])
    .range([m.l, width - m.r]);
  const y = scaleLinear()
    .domain([0, Math.max(...ys, 0) || 1])
    .nice()
    .range([height - m.b, m.t]);
  const path = line<{ x: number; y: number }>()
    .x((p) => x(p.x))
    .y((p) => y(p.y));
  const ends = spread(
    series.map((s) => y(s.points[s.points.length - 1]?.y ?? 0)),
    16,
    m.t,
    height - m.b,
  );
  const xTicks = [...new Set(xs)].sort((a, b) => a - b);

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      csvName={csvName}
      table={{
        columns: ['Policy', xLabel, yLabel],
        rows: series.flatMap((s) => s.points.map((p) => [s.policy, formatX(p.x), formatY(p.y)])),
      }}
    >
      <div ref={ref} className="relative">
        <svg width={width} height={height} role="img" aria-label={title} className="block overflow-visible">
          {y.ticks(5).map((t) => (
            <g key={t}>
              <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--hairline)" />
              <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize={12} className="num" fill="var(--stone)">
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={height - m.b + 18} textAnchor="middle" fontSize={12} className="num" fill="var(--stone)">
              {t}
            </text>
          ))}
          <text x={(m.l + width - m.r) / 2} y={height - 4} textAnchor="middle" fontSize={12} fill="var(--stone)">
            {xLabel}
          </text>
          <text x={0} y={m.t - 2} fontSize={12} fill="var(--stone)" transform={`translate(0, 0)`}>
            {yLabel}
          </text>
          <line x1={m.l} x2={width - m.r} y1={height - m.b} y2={height - m.b} stroke="var(--ink)" />
          {series.map((s, si) => {
            const st = POLICY_STYLE[s.policy];
            const last = s.points[s.points.length - 1];
            return (
              <g key={s.policy}>
                <path d={path(s.points) ?? ''} fill="none" stroke={st.color} strokeWidth={2} style={{ transition: 'd 250ms ease-out' }} />
                {s.points.map((p, pi) => (
                  <g
                    key={pi}
                    tabIndex={0}
                    aria-label={`${s.policy}, ${formatX(p.x)}: ${formatY(p.y)}`}
                    onMouseEnter={() => setHover({ s: si, p: pi })}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ s: si, p: pi })}
                    onBlur={() => setHover(null)}
                  >
                    <circle cx={x(p.x)} cy={y(p.y)} r={10} fill="transparent" />
                    <Marker shape={st.marker} x={x(p.x)} y={y(p.y)} color={st.color} />
                  </g>
                ))}
                {last && (
                  <text x={width - m.r + 10} y={ends[si] + 4} fontSize={13} fill="var(--ink)" fontWeight={s.policy === 'DMFQ-A' ? 600 : 400}>
                    {st.short}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover && (
          <Tooltip x={x(series[hover.s].points[hover.p].x)} y={y(series[hover.s].points[hover.p].y)}>
            <span className="font-semibold">{series[hover.s].policy}</span> · {formatX(series[hover.s].points[hover.p].x)} ·{' '}
            <span className="num">{formatY(series[hover.s].points[hover.p].y)}</span>
          </Tooltip>
        )}
      </div>
    </ChartFrame>
  );
}
