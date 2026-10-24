'use client';
import { scaleLinear } from 'd3-scale';
import { useState } from 'react';
import type { Policy } from '@/engine/types';
import { POLICY_STYLE } from '@/lib/policy';
import { ChartFrame } from './ChartFrame';
import { Marker } from './Marker';
import { Tooltip } from '../ui/Tooltip';
import { useWidth } from './useWidth';

export interface Point {
  policy: Policy;
  x: number;
  y: number;
}

/** Labelled scatter; lower-left is better for both axes. */
export function Scatter({
  title,
  points,
  xLabel,
  yLabel,
  formatX,
  formatY,
  csvName,
  subtitle,
  height = 320,
}: {
  title: string;
  points: Point[];
  xLabel: string;
  yLabel: string;
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  csvName: string;
  subtitle?: React.ReactNode;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { l: 56, r: 24, t: 16, b: 44 };
  const x = scaleLinear()
    .domain([0, Math.max(...points.map((p) => p.x)) * 1.1 || 1])
    .nice()
    .range([m.l, width - m.r]);
  const y = scaleLinear()
    .domain([0, Math.max(...points.map((p) => p.y)) * 1.1 || 1])
    .nice()
    .range([height - m.b, m.t]);

  // label placement: right of the point unless it would leave the plot or collide
  const placed: { x: number; y: number }[] = [];
  const labels = points.map((p) => {
    let lx = x(p.x) + 10;
    let ly = y(p.y) + 4;
    let anchor: 'start' | 'end' = 'start';
    if (lx + 90 > width - m.r) {
      lx = x(p.x) - 10;
      anchor = 'end';
    }
    for (const q of placed) if (Math.abs(q.y - ly) < 14 && Math.abs(q.x - lx) < 80) ly = q.y + 15;
    placed.push({ x: lx, y: ly });
    return { lx, ly, anchor };
  });

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      csvName={csvName}
      table={{ columns: ['Policy', xLabel, yLabel], rows: points.map((p) => [p.policy, formatX(p.x), formatY(p.y)]) }}
    >
      <div ref={ref} className="relative">
        <svg width={width} height={height} role="img" aria-label={title} className="block overflow-visible">
          {y.ticks(5).map((t) => (
            <g key={`y${t}`}>
              <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--hairline)" />
              <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize={12} className="num" fill="var(--stone)">
                {t}
              </text>
            </g>
          ))}
          {x.ticks(5).map((t) => (
            <text key={`x${t}`} x={x(t)} y={height - m.b + 18} textAnchor="middle" fontSize={12} className="num" fill="var(--stone)">
              {t.toLocaleString('en-GB')}
            </text>
          ))}
          <line x1={m.l} x2={width - m.r} y1={height - m.b} y2={height - m.b} stroke="var(--ink)" />
          <line x1={m.l} x2={m.l} y1={m.t} y2={height - m.b} stroke="var(--ink)" />
          <text x={(m.l + width - m.r) / 2} y={height - 4} textAnchor="middle" fontSize={12} fill="var(--stone)">
            {xLabel}
          </text>
          <text x={m.l + 6} y={m.t + 4} fontSize={12} fill="var(--stone)">
            {yLabel}
          </text>
          <text x={m.l + 8} y={height - m.b - 8} fontSize={12} fill="var(--stone)" fontStyle="italic">
            ← better
          </text>
          {points.map((p, i) => {
            const st = POLICY_STYLE[p.policy];
            return (
              <g
                key={p.policy}
                tabIndex={0}
                aria-label={`${p.policy}: ${formatX(p.x)}, ${formatY(p.y)}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              >
                <circle cx={x(p.x)} cy={y(p.y)} r={12} fill="transparent" />
                <Marker shape={st.marker} x={x(p.x)} y={y(p.y)} color={st.color} size={10} />
                <text
                  x={labels[i].lx}
                  y={labels[i].ly}
                  textAnchor={labels[i].anchor}
                  fontSize={13}
                  fill="var(--ink)"
                  fontWeight={p.policy === 'DMFQ-A' ? 600 : 400}
                >
                  {st.short}
                </text>
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <Tooltip x={x(points[hover].x)} y={y(points[hover].y)}>
            <span className="font-semibold">{points[hover].policy}</span> · <span className="num">{formatX(points[hover].x)}</span> ·{' '}
            <span className="num">{formatY(points[hover].y)}</span>
          </Tooltip>
        )}
      </div>
    </ChartFrame>
  );
}
