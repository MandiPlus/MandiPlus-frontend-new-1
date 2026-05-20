'use client';

import type { KeyboardEvent } from 'react';

export type LookupDropdownOption = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
};

type LookupDropdownProps = {
  label: string;
  query: string;
  onQueryChange: (value: string) => void;
  onQuerySubmit: () => void;
  options: LookupDropdownOption[];
  onSelect: (option: LookupDropdownOption) => void;
  loading?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyMessage?: string;
  submitLabel?: string;
  disabled?: boolean;
};

export default function LookupDropdown({
  label,
  query,
  onQueryChange,
  onQuerySubmit,
  options,
  onSelect,
  loading = false,
  errorMessage,
  onRetry,
  emptyMessage = 'No matches found',
  submitLabel = 'Use typed value',
  disabled = false,
}: LookupDropdownProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onQuerySubmit();
    }
  };

  return (
    <div className="mx-4 mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Search by name or mobile"
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-400 disabled:bg-slate-100"
          />
          <button
            type="button"
            onClick={onQuerySubmit}
            disabled={disabled}
            className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitLabel}
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300">
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Loading options...</div>
        ) : errorMessage ? (
          <div className="px-4 py-6">
            <p className="text-sm font-medium text-rose-600">{errorMessage}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : options.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">{emptyMessage}</div>
        ) : (
          options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option)}
              className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-emerald-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {option.title}
                </p>
                {option.subtitle ? (
                  <p className="mt-1 text-xs text-slate-500">{option.subtitle}</p>
                ) : null}
              </div>
              {option.meta ? (
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {option.meta}
                </span>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
