import type { Marker as M } from '@/lib/policy';

/** 8 px policy marker centred on (x, y). Shapes keep series identifiable without colour. */
export function Marker({ shape, x, y, color, size = 8 }: { shape: M; x: number; y: number; color: string; size?: number }) {
  const r = size / 2;
  const common = { fill: color, stroke: 'var(--paper)', strokeWidth: 1 };
  switch (shape) {
    case 'square':
      return <rect x={x - r} y={y - r} width={size} height={size} {...common} />;
    case 'circle':
      return <circle cx={x} cy={y} r={r} {...common} />;
    case 'triangle':
      return <path d={`M${x},${y - r * 1.2} L${x + r * 1.15},${y + r * 0.9} L${x - r * 1.15},${y + r * 0.9}Z`} {...common} />;
    case 'diamond':
      return <path d={`M${x},${y - r * 1.3} L${x + r * 1.1},${y} L${x},${y + r * 1.3} L${x - r * 1.1},${y}Z`} {...common} />;
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r * 1.5 : r * 0.65;
        pts.push(`${x + rr * Math.cos(a)},${y + rr * Math.sin(a)}`);
      }
      return <polygon points={pts.join(' ')} {...common} />;
    }
  }
}

export function MarkerSwatch({ shape, color }: { shape: M; color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="inline-block align-[-2px]">
      <Marker shape={shape} x={7} y={7} color={color} size={9} />
    </svg>
  );
}
