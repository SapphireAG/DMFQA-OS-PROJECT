export function Kicker({ children, tone = 'accent' }: { children: React.ReactNode; tone?: 'accent' | 'stone' }) {
  return <p className={`kicker ${tone === 'accent' ? 'text-accent-ink' : 'text-stone'}`}>{children}</p>;
}
