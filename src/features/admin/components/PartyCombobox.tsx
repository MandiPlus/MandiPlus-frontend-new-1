'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

export type PartyComboboxOption = {
  value: string;
  label: string;
  subtitle?: string;
  meta?: string;
  searchText?: string;
};

type PartyComboboxProps = {
  label: string;
  options: PartyComboboxOption[];
  value: string;
  onChange: (value: string, isCustom: boolean) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
};

export default function PartyCombobox({
  label,
  options,
  value,
  onChange,
  placeholder = 'Search or type party name...',
  searchPlaceholder = 'Search or type party name...',
  emptyMessage = 'No historical parties found',
  disabled = false,
  loading = false,
  className = '',
}: PartyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const displayLabel = useMemo(() => {
    if (!value) return '';
    const match = options.find((o) => o.value === value);
    return match?.label || value;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options.slice(0, 20);
    return options.filter((option) => {
      const haystack = String(option.searchText || `${option.label} ${option.subtitle || ''}`).toLowerCase();
      return haystack.includes(needle);
    });
  }, [options, query]);

  const showCreateOption = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return false;
    const exactMatch = options.some(
      (o) => o.label.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    return !exactMatch;
  }, [options, query]);

  const totalItems = filteredOptions.length + (showCreateOption ? 1 : 0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(-1);
      return;
    }
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timeoutId);
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

  const handleSelectOption = (option: PartyComboboxOption) => {
    onChange(option.value, false);
    setOpen(false);
  };

  const handleCreateCustom = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onChange(trimmed, true);
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
      setActiveIndex((prev) => (totalItems === 0 ? -1 : Math.min(prev + 1, totalItems - 1)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (totalItems === 0 ? -1 : Math.max(prev - 1, 0)));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
        handleSelectOption(filteredOptions[activeIndex]);
      } else if (activeIndex === filteredOptions.length && showCreateOption) {
        handleCreateCustom();
      } else if (showCreateOption) {
        handleCreateCustom();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

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
        <span className="truncate">{displayLabel || placeholder}</span>
        <span className="ml-3 text-slate-400" aria-hidden="true">&#9662;</span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-2">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label={`${label} search`}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition-colors focus:border-emerald-400"
            />
          </div>

          <div
            role="listbox"
            aria-label={label}
            className="max-h-72 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300"
          >
            {loading ? (
              <div className="px-3 py-4 text-sm text-slate-500">Loading parties...</div>
            ) : filteredOptions.length === 0 && !showCreateOption ? (
              <div className="px-3 py-4 text-sm text-slate-500">{emptyMessage}</div>
            ) : (
              <>
                {filteredOptions.length > 0 && (
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Historical parties
                  </div>
                )}
                {filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isActive = index === activeIndex;

                  return (
                    <button
                      key={`${option.value}-${index}`}
                      ref={(el) => { optionRefs.current[index] = el; }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectOption(option)}
                      className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-900'
                          : isSelected
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{option.label}</p>
                        {option.subtitle ? (
                          <p className="mt-0.5 truncate text-xs text-slate-500">{option.subtitle}</p>
                        ) : null}
                      </div>
                      {option.meta ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {option.meta}
                        </span>
                      ) : null}
                    </button>
                  );
                })}

                {showCreateOption ? (
                  <>
                    {filteredOptions.length > 0 && (
                      <div className="border-t border-slate-100" />
                    )}
                    <button
                      ref={(el) => { optionRefs.current[filteredOptions.length] = el; }}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseEnter={() => setActiveIndex(filteredOptions.length)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleCreateCustom}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                        activeIndex === filteredOptions.length
                          ? 'bg-amber-50 text-amber-900'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-xs font-bold text-amber-700">+</span>
                      <span>
                        Use <strong>&ldquo;{query.trim()}&rdquo;</strong> as party name
                      </span>
                    </button>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
