export function Card({
  children,
  className = '',
  as: As = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return <As className={`border border-hairline bg-paper-2 ${className}`}>{children}</As>;
}
