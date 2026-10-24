import Link from 'next/link';

type Variant = 'primary' | 'cta' | 'quiet';

const base =
  'inline-flex items-center justify-center gap-2 border px-4 py-2 text-[15px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40';
const variants: Record<Variant, string> = {
  primary: 'border-ink text-ink hover:bg-ink hover:text-paper',
  cta: 'border-accent bg-accent text-paper hover:bg-paper hover:text-accent-ink',
  quiet: 'border-hairline text-ink-2 hover:border-ink hover:text-ink',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  href,
  variant = 'primary',
  className = '',
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
