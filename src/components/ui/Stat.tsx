export function Stat({
  value,
  unit,
  caption,
  accent = false,
  size = 'lg',
}: {
  value: React.ReactNode;
  unit?: React.ReactNode;
  caption: React.ReactNode;
  accent?: boolean;
  size?: 'lg' | 'md' | 'sm';
}) {
  const sz = size === 'lg' ? 'text-[56px] md:text-[72px]' : size === 'md' ? 'text-[40px]' : 'text-[30px]';
  return (
    <div>
      <p className={`font-display font-semibold leading-none tabular-nums ${sz} ${accent ? 'text-accent-ink' : 'text-ink'}`}>
        {value}
        {unit && <span className="num ml-2 align-baseline text-[16px] font-normal text-stone">{unit}</span>}
      </p>
      <p className="mt-3 text-[15px] leading-snug text-ink-2">{caption}</p>
    </div>
  );
}
