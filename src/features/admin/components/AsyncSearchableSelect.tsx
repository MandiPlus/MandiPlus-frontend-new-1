'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

export type AsyncSearchableSelectOption = {
  value: string;
  label: string;
};

type AsyncSearchableSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => Promise<AsyncSearchableSelectOption[]>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  debounceMs?: number;
};

export default function AsyncSearchableSelect({
  label,
  value,
  onChange,
  onSearch,
  placeholder = 'Select option',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found',
  disabled = false,
  className = '',
  debounceMs = 300,
}: AsyncSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<AsyncSearchableSelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedLabel, setSelectedLabel] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchOptions = useCallback(
    async (searchQuery: string) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const results = await onSearch(searchQuery);
        if (!controller.signal.aborted) {
          setOptions(results);
          setActiveIndex(results.length > 0 ? 0 : -1);
        }
      } catch {
        if (!controller.signal.aborted) {
          setOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [onSearch],
  );

  useEffect(() => {
    if (!open) return;
    fetchOptions('');
  }, [open, fetchOptions]);

  useEffect(() => {
    if (!open) return;
    if (!query) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchOptions(query);
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, debounceMs, fetchOptions]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(-1);
      return;
    }
    const timeoutId = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const handleSelect = (nextValue: string) => {
    const opt = options.find((o) => o.value === nextValue);
    if (opt) setSelectedLabel(opt.label);
    onChange(nextValue);
    setOpen(false);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) =>
        options.length === 0 ? -1 : Math.min(prev + 1, options.length - 1),
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (options.length === 0 ? -1 : Math.max(prev - 1, 0)));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && options[activeIndex]) {
        handleSelect(options[activeIndex].value);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  const displayLabel = value
    ? selectedLabel || options.find((o) => o.value === value)?.label || placeholder
    : placeholder;

  return (
    <div ref={containerRef} className={`relative text-sm text-slate-600 ${className}`}>
      <label className="block">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-1 flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <span className="truncate">{displayLabel}</span>
        <span className="ml-3 text-slate-400" aria-hidden="true">v</span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-2">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label={`${label} search`}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition-colors focus:border-sky-400"
            />
          </div>

          <div
            role="listbox"
            aria-label={label}
            className="max-h-72 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300"
          >
            {loading ? (
              <div className="px-3 py-3 text-sm text-slate-500">Searching...</div>
            ) : options.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500">{emptyMessage}</div>
            ) : (
              options.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={option.value}
                    ref={(el) => { optionRefs.current[index] = el; }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(option.value)}
                    className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-sky-50 text-sky-900'
                        : isSelected
                          ? 'bg-sky-100 text-sky-900'
                          : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
