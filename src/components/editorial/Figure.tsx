export function Figure({
  n,
  caption,
  source,
  children,
  className = '',
}: {
  n: number | string;
  caption: React.ReactNode;
  source: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={className}>
      {children}
      <figcaption className="mt-3 border-t border-hairline pt-2 text-[13px] leading-snug text-stone">
        <span className="font-semibold text-ink-2">Fig. {n} — </span>
        {caption}
        <span className="mt-1 block uppercase tracking-[0.08em]">{source}</span>
      </figcaption>
    </figure>
  );
}
