'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/lab/', label: 'Scheduler Lab' },
  { href: '/llm/', label: 'LLM Serving' },
  { href: '/gpu/', label: 'GPU Cluster' },
  { href: '/results/', label: 'Results' },
  { href: '/method/', label: 'Method' },
];

export function Masthead() {
  const path = usePathname();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const on = () => setCompact(window.scrollY > 48);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const norm = (p: string) => (p.endsWith('/') ? p : `${p}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-paper">
      <div className="page relative">
        <div
          className={`flex items-center justify-center overflow-hidden transition-all duration-300 ${
            compact ? 'h-0 opacity-0' : 'h-16 opacity-100 md:h-20'
          }`}
        >
          <Link
            href="/"
            className="font-display text-[34px] font-semibold tracking-tight text-ink md:text-[44px]"
            aria-label="DMFQ-A home"
          >
            DMFQ-A
          </Link>
        </div>
        <div className={`rule ${compact ? 'border-transparent' : ''}`} />
        <nav aria-label="Main" className="flex items-center gap-4">
          {compact && (
            <Link href="/" className="hidden shrink-0 font-display text-xl font-semibold text-ink md:block">
              DMFQ-A
            </Link>
          )}
          <ul className="no-scrollbar -mx-1 flex flex-1 items-center justify-start gap-1 overflow-x-auto py-2 md:justify-center md:gap-3">
            {NAV.map((n, i) => {
              const active = norm(path) === n.href;
              return (
                <li key={n.href} className="flex shrink-0 items-center">
                  {i > 0 && <span aria-hidden className="mr-1 text-hairline md:mr-3">·</span>}
                  <Link
                    href={n.href}
                    aria-current={active ? 'page' : undefined}
                    className={`kicker whitespace-nowrap px-1 py-1 text-[12px] transition-colors md:text-[13px] ${
                      active ? 'text-ink underline decoration-gold decoration-1 underline-offset-[6px]' : 'text-stone hover:text-ink'
                    }`}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
