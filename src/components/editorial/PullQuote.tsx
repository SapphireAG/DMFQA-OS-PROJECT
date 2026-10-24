export function PullQuote({ children, cite }: { children: React.ReactNode; cite?: string }) {
  return (
    <blockquote className="rule-gold border-b border-b-gold py-8">
      <p className="font-display text-[28px] italic leading-snug text-ink md:text-[36px]">{children}</p>
      {cite && <footer className="kicker mt-4 text-stone">{cite}</footer>}
    </blockquote>
  );
}
