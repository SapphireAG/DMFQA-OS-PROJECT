'use client';
import { scaleLinear } from 'd3-scale';
import { useState } from 'react';
import type { Policy } from '@/engine/types';
import { POLICY_STYLE } from '@/lib/policy';
import { ChartFrame } from './ChartFrame';
import { Marker } from './Marker';
import { Tooltip } from '../ui/Tooltip';
import { useWidth } from './useWidth';

export interface Bar {
  policy: Policy;
  value: number;
}

/** Horizontal bars, one per policy, starting at zero; value labelled at the bar end. */
export function BarChart({
  title,
  data,
  format,
  unitLabel,
  csvName,
  subtitle,
}: {
  title: string;
  data: Bar[];
  format: (v: number) => string;
  unitLabel: string;
  csvName: string;
  subtitle?: React.ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const labelW = 112;
  const valueW = 84;
  const rowH = 34;
  const barH = 20;
  const h = data.length * rowH + 28;
  const maxV = Math.max(...data.map((d) => d.value), 0) || 1;
  const x = scaleLinear().domain([0, maxV]).nice().range([labelW, Math.max(labelW + 40, width - valueW)]);
  const ticks = x.ticks(4);

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      csvName={csvName}
      table={{ columns: ['Policy', unitLabel], rows: data.map((d) => [d.policy, format(d.value)]) }}
    >
      <div ref={ref} className="relative">
        <svg width={width} height={h} role="img" aria-label={title} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={h - 22} stroke="var(--hairline)" />
              <text x={x(t)} y={h - 6} textAnchor="middle" className="num" fontSize={12} fill="var(--stone)">
                {t}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const st = POLICY_STYLE[d.policy];
            const y = i * rowH + (rowH - barH) / 2;
            const w = Math.max(0, x(d.value) - labelW);
            return (
              <g
                key={d.policy}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                tabIndex={0}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.policy}: ${format(d.value)}`}
              >
                <rect x={0} y={i * rowH} width={width} height={rowH} fill="transparent" />
                <Marker shape={st.marker} x={8} y={y + barH / 2} color={st.color} />
                <text x={20} y={y + barH / 2 + 5} fontSize={14} fill="var(--ink)" fontWeight={d.policy === 'DMFQ-A' ? 600 : 400}>
                  {st.short}
                </text>
                <rect
                  x={labelW}
                  y={y}
                  height={barH}
                  fill={st.color}
                  style={{ width: w, transition: 'width 250ms ease-out' }}
                />
                <text x={labelW + w + 6} y={y + barH / 2 + 5} fontSize={13} className="num" fill="var(--ink)">
                  {format(d.value)}
                </text>
              </g>
            );
          })}
          <line x1={labelW} x2={labelW} y1={0} y2={h - 22} stroke="var(--ink)" />
        </svg>
        {hover !== null && (
          <Tooltip x={Math.min(width - 80, x(data[hover].value))} y={hover * rowH + 6}>
            <span className="font-semibold">{data[hover].policy}</span> · <span className="num">{format(data[hover].value)}</span>
          </Tooltip>
        )}
      </div>
    </ChartFrame>
  );
}
