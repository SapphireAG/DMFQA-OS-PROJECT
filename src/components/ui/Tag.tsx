export function Tag({ children, tone = 'stone' }: { children: React.ReactNode; tone?: 'stone' | 'gold' | 'ink' }) {
  const c = tone === 'gold' ? 'border-gold text-ink' : tone === 'ink' ? 'border-ink text-ink' : 'border-hairline text-stone';
  return <span className={`kicker inline-block border px-2 py-0.5 text-[11px] ${c}`}>{children}</span>;
}

export function SyntheticTag({ children = 'Synthetic workload' }: { children?: React.ReactNode }) {
  return <Tag tone="gold">{children}</Tag>;
}
