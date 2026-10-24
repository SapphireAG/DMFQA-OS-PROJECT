'use client';

/** Absolutely positioned tooltip for charts and grids; parent must be `relative`. */
export function Tooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap border border-ink bg-paper px-2 py-1 text-[13px] text-ink"
      style={{ left: x, top: y - 8 }}
    >
      {children}
    </div>
  );
}
