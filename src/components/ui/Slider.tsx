'use client';
import { useId } from 'react';

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  ticks,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  ticks?: { value: number; label: string }[];
}) {
  const id = useId();
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="kicker text-stone">
          {label}
        </label>
        <output htmlFor={id} className="num text-[15px] text-ink">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={format(value)}
        className="ed-range mt-2 w-full"
      />
      {ticks && (
        <div className="relative mt-1 h-5" aria-hidden>
          {ticks.map((t) => (
            <span
              key={t.label}
              className="absolute -translate-x-1/2 whitespace-nowrap text-[12px] uppercase tracking-[0.08em] text-stone"
              style={{ left: `${pos(t.value)}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
