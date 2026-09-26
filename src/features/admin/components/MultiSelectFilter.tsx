'use client';

import { useEffect, useRef, useState } from 'react';

export type MultiSelectFilterOption = {
  value: string;
  label?: string;
  count?: number;
};

type MultiSelectFilterProps = {
  /** Label shown when nothing is selected, e.g. "All Reasons". */
  allLabel: string;
  options: MultiSelectFilterOption[];
  /** Empty set means "all". */
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  className?: string;
};

/**
 * Checkbox dropdown for filtering a list by many values at once.
 * An empty selection means "all", so callers can skip the query param entirely.
 */
export function MultiSelectFilter({
  allLabel,
  options,
  selected,
  onChange,
  className = '',
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const allSelected = selected.size === 0 || selected.size === options.length;

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next.size === options.length ? new Set() : next);
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-[150px] items-center justify-between gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-slate-700 outline-none transition hover:bg-slate-50 focus:border-[#4309ac]"
      >
        <span className="truncate">
          {allSelected ? allLabel : `${selected.size} selected`}
        </span>
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-slate-900 shadow-lg">
          <label className="flex cursor-pointer items-center border-b border-slate-100 px-3 py-1.5 text-xs font-bold hover:bg-slate-50">
            <input
              type="checkbox"
              className="mr-2"
              checked={allSelected}
              onChange={() => onChange(new Set())}
            />
            {allLabel}
          </label>
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="mr-2"
                checked={selected.has(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span className="flex-1 truncate">{option.label || option.value}</span>
              {option.count !== undefined && (
                <span className="ml-2 text-[11px] font-bold text-slate-400">{option.count}</span>
              )}
            </label>
          ))}
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs font-semibold text-slate-400">No options</div>
          )}
        </div>
      )}
    </div>
  );
}
