'use client';

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap border border-hairline">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled || o.disabled}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 text-[14px] transition-colors disabled:opacity-40 ${
              on ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper-2'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
