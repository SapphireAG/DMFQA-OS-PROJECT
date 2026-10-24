/**
 * "The idea in one diagram": three levels, demotion on quantum expiry (ink),
 * selective aging one level at a time (gold), adaptive quanta on Q1/Q2.
 */
export function QueueDiagram() {
  const lanes = [
    { y: 40, name: 'Q0', q: 'fixed quantum', color: 'var(--q0)' },
    { y: 130, name: 'Q1', q: 'quantum b → 2b as queue grows', color: 'var(--q1)' },
    { y: 220, name: 'Q2', q: 'quantum b → 2b as queue grows', color: 'var(--q2)' },
  ];
  return (
    <svg
      viewBox="0 0 640 290"
      className="h-auto w-full"
      role="img"
      aria-label="Three queue levels. New work enters Q0. Work that spends its quantum is demoted one level. Work that waits past a threshold is promoted one level. Q1 and Q2 quanta grow with the number of waiting items."
    >
      <defs>
        <marker id="qd-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--ink)" />
        </marker>
        <marker id="qd-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--gold)" />
        </marker>
      </defs>
      {/* arrivals */}
      <text x="0" y="24" fontSize="12" fill="var(--stone)" letterSpacing="0.08em">NEW WORK</text>
      <line x1="40" y1="30" x2="96" y2="52" stroke="var(--ink)" strokeWidth="1.5" markerEnd="url(#qd-ink)" />
      {lanes.map((l, i) => (
        <g key={l.name}>
          <rect x="100" y={l.y} width="380" height="40" fill="var(--paper-2)" stroke="var(--hairline)" />
          <rect x="100" y={l.y} width="6" height="40" fill={l.color} />
          <text x="118" y={l.y + 26} fontSize="18" fontFamily="var(--font-display)" fontWeight="600" fill="var(--ink)">
            {l.name}
          </text>
          <text x="160" y={l.y + 25} fontSize="13" fill="var(--stone)">
            {l.q}
          </text>
          {/* waiting items, illustrative */}
          {Array.from({ length: [3, 4, 5][i] }).map((_, k) => (
            <rect key={k} x={470 - 22 * (k + 1)} y={l.y + 12} width="16" height="16" fill="none" stroke={l.color} strokeWidth="1.5" />
          ))}
        </g>
      ))}
      {/* demotion arrows */}
      <path d="M495,62 C540,70 540,135 486,148" fill="none" stroke="var(--ink)" strokeWidth="1.5" markerEnd="url(#qd-ink)" />
      <path d="M495,152 C540,160 540,225 486,238" fill="none" stroke="var(--ink)" strokeWidth="1.5" markerEnd="url(#qd-ink)" />
      <text x="548" y="105" fontSize="13" fill="var(--ink)">demote</text>
      <text x="548" y="195" fontSize="13" fill="var(--ink)">demote</text>
      <text x="548" y="120" fontSize="11" fill="var(--stone)">quantum spent</text>
      <text x="548" y="210" fontSize="11" fill="var(--stone)">quantum spent</text>
      {/* aging arrows */}
      <path d="M90,236 C50,226 50,166 94,156" fill="none" stroke="var(--gold)" strokeWidth="1.5" markerEnd="url(#qd-gold)" />
      <path d="M90,146 C50,136 50,76 94,66" fill="none" stroke="var(--gold)" strokeWidth="1.5" markerEnd="url(#qd-gold)" />
      <text x="0" y="112" fontSize="13" fill="var(--ink)">age ↑</text>
      <text x="0" y="202" fontSize="13" fill="var(--ink)">age ↑</text>
      <text x="0" y="280" fontSize="11" fill="var(--stone)">
        Waited past threshold → up one level (not a global boost)
      </text>
    </svg>
  );
}
