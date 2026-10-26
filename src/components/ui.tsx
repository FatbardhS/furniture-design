import { useEffect, useId, useState, type ReactNode } from 'react';
import { fromUnit, toUnit } from '../domain/units';
import type { Unit } from '../domain/types';

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-stone-200 px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">{title}</h3>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-xs font-medium text-stone-600">
        {label}
        {hint && <span className="font-normal text-stone-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm tabular-nums text-stone-800 shadow-xs outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-100';

/**
 * Numeric input that keeps a local draft while typing (so "1" on the way to "1800" doesn't
 * snap to the minimum) and commits clamped values.
 */
export function NumberInput({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  suffix,
  className = '',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(String(+value.toFixed(2)));
  }, [value, focused]);

  const commit = (raw: string) => {
    const n = parseFloat(raw.replace(',', '.'));
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="number"
        inputMode="decimal"
        className={`${inputCls} ${suffix ? 'pr-10' : ''}`}
        value={draft}
        step={step}
        min={Number.isFinite(min) ? min : undefined}
        max={Number.isFinite(max) ? max : undefined}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={(e) => {
          setFocused(false);
          commit(e.target.value);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-stone-400">{suffix}</span>
      )}
    </div>
  );
}

/** Length input: stores millimetres, shows the user's chosen unit. */
export function LengthInput({
  mm,
  unit,
  onChange,
  min = 0,
  max = 10000,
}: {
  mm: number;
  unit: Unit;
  onChange: (mm: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <NumberInput
      value={toUnit(mm, unit)}
      min={toUnit(min, unit)}
      max={toUnit(max, unit)}
      step={unit === 'cm' ? 0.5 : 5}
      suffix={unit}
      onChange={(v) => onChange(Math.round(fromUnit(v, unit)))}
    />
  );
}

export function Slider({ value, min, max, step = 1, onChange }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range"
      className="w-full accent-accent-500"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(+e.target.value)}
    />
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-stone-100 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            o.value === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label, icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; icon?: ReactNode }) {
  const id = useId();
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
        checked ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-stone-200 bg-white/90 text-stone-600 hover:border-stone-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  title,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles = {
    primary: 'bg-stone-900 text-white hover:bg-stone-700 shadow-sm',
    secondary: 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 shadow-xs',
    ghost: 'text-stone-500 hover:bg-stone-100 hover:text-stone-800',
    danger: 'text-stone-400 hover:bg-red-50 hover:text-red-600',
  }[variant];
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: string; badge?: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex border-b border-stone-200 px-2" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={`relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
            t.value === value ? 'border-accent-500 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-stone-900">{value}</div>
      {sub && <div className="text-[11px] text-stone-500">{sub}</div>}
    </div>
  );
}
