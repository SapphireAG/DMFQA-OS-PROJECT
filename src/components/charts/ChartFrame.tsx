'use client';
import { useState } from 'react';

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

function toCsv(t: TableData) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [t.columns, ...t.rows].map((r) => r.map(esc).join(',')).join('\n');
}

export function ChartFrame({
  title,
  table,
  csvName,
  children,
  subtitle,
}: {
  title: string;
  table: TableData;
  csvName: string;
  children: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const download = () => {
    const blob = new Blob([toCsv(table)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = csvName;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <h3 className="max-w-2xl font-display text-[22px] leading-snug md:text-h3">{title}</h3>
        <div className="flex shrink-0 gap-3 pt-1 text-[13px]">
          <button type="button" className="link text-stone hover:text-ink" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? 'View as chart' : 'View as table'}
          </button>
          <button type="button" className="link text-stone hover:text-ink" onClick={download}>
            Download CSV
          </button>
        </div>
      </div>
      {subtitle && <p className="mt-1 text-[14px] text-stone">{subtitle}</p>}
      <div className="mt-4">
        {asTable ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr>
                  {table.columns.map((c) => (
                    <th key={c} scope="col" className="border-b border-ink py-2 pr-4 text-left font-semibold text-ink">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-hairline">
                    {r.map((c, j) => (
                      <td key={j} className={`py-1.5 pr-4 ${typeof c === 'number' ? 'num' : ''}`}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
