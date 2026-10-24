import { Kicker } from './Kicker';

export function PageHeader({
  number,
  kicker,
  title,
  dek,
  children,
}: {
  number: string;
  kicker: string;
  title: React.ReactNode;
  dek?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="page pb-12 pt-12 md:pb-16 md:pt-20">
      <Kicker tone="stone">
        <span className="num mr-2 text-gold">{number}</span>
        {kicker}
      </Kicker>
      <h1 className="mt-4 max-w-4xl text-[44px] leading-[1.05] md:text-h1">{title}</h1>
      {dek && <p className="mt-6 max-w-3xl text-body text-ink-2 md:text-[20px]">{dek}</p>}
      {children}
    </header>
  );
}
