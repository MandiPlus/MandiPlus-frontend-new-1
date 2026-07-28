import { useMemo, useState } from 'react';
import { MarketSignal } from '../types';
import { formatEnumLabel, formatNumber, severityClass } from '../formatters';
import { downloadCsv } from '../exporters';

export function SignalFeed({ signals }: { signals: MarketSignal[] }) {
  const [severityFilter, setSeverityFilter] = useState<MarketSignal['severity'] | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');

  const types = useMemo(
    () => Array.from(new Set(signals.map((signal) => signal.type))).sort(),
    [signals],
  );
  const scopes = useMemo(
    () =>
      Array.from(
        new Set(
          signals
            .flatMap((signal) => [signal.commodity, signal.state])
            .filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [signals],
  );
  const filteredSignals = useMemo(
    () =>
      signals.filter((signal) => {
        if (severityFilter !== 'all' && signal.severity !== severityFilter) return false;
        if (typeFilter && signal.type !== typeFilter) return false;
        if (
          scopeFilter &&
          signal.commodity !== scopeFilter &&
          signal.state !== scopeFilter
        ) {
          return false;
        }
        return true;
      }),
    [scopeFilter, severityFilter, signals, typeFilter],
  );
  const summary = useMemo(
    () => ({
      total: filteredSignals.length,
      high: filteredSignals.filter((signal) => signal.severity === 'high').length,
      medium: filteredSignals.filter((signal) => signal.severity === 'medium').length,
      avgScore:
        filteredSignals.length === 0
          ? 0
          : Math.round(
              filteredSignals.reduce((sum, signal) => sum + signal.score, 0) /
                filteredSignals.length,
            ),
    }),
    [filteredSignals],
  );

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Signal Inbox</h2>
            <p className="text-sm text-slate-500">Ranked movements from internal ground data.</p>
          </div>
          <button
            type="button"
            onClick={() => exportSignals(filteredSignals)}
            disabled={filteredSignals.length === 0}
            className="w-fit border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
          >
            Export signals
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Metric label="Signals" value={formatNumber(summary.total)} />
          <Metric label="High" value={formatNumber(summary.high)} />
          <Metric label="Medium" value={formatNumber(summary.medium)} />
          <Metric label="Avg score" value={formatNumber(summary.avgScore)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <FilterButton label="All" active={severityFilter === 'all'} onClick={() => setSeverityFilter('all')} />
          <FilterButton label="High" active={severityFilter === 'high'} onClick={() => setSeverityFilter('high')} />
          <FilterButton label="Medium" active={severityFilter === 'medium'} onClick={() => setSeverityFilter('medium')} />
          <FilterButton label="Low" active={severityFilter === 'low'} onClick={() => setSeverityFilter('low')} />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="border border-slate-300 bg-white px-2 py-1 text-slate-700"
          >
            <option value="">All signal types</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {formatEnumLabel(type)}
              </option>
            ))}
          </select>
          <select
            value={scopeFilter}
            onChange={(event) => setScopeFilter(event.target.value)}
            className="border border-slate-300 bg-white px-2 py-1 text-slate-700"
          >
            <option value="">All commodities/states</option>
            {scopes.map((scope) => (
              <option key={scope} value={scope}>
                {scope}
              </option>
            ))}
          </select>
          {(severityFilter !== 'all' || typeFilter || scopeFilter) && (
            <button
              type="button"
              onClick={() => {
                setSeverityFilter('all');
                setTypeFilter('');
                setScopeFilter('');
              }}
              className="border border-slate-300 bg-white px-2 py-1 text-slate-600"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {signals.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">No strong signals for this period yet.</div>
        ) : filteredSignals.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">No signals match the selected filters.</div>
        ) : (
          filteredSignals.map((signal) => (
            <article key={signal.id} className="px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{signal.title}</div>
                  <div className="mt-1 text-sm text-slate-600">{signal.summary}</div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-semibold uppercase">
                    <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                      {formatEnumLabel(signal.type)}
                    </span>
                    <span className="border border-slate-200 bg-white px-2 py-0.5 text-slate-500">
                      {signal.confidence} confidence
                    </span>
                    {signal.commodity && (
                      <span className="border border-lime-200 bg-lime-50 px-2 py-0.5 text-lime-800">
                        {signal.commodity}
                      </span>
                    )}
                    {signal.state && (
                      <span className="border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-800">
                        {signal.state}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`border px-2 py-1 text-xs font-semibold ${severityClass(signal.severity)}`}>
                  {signal.severity.toUpperCase()} · {signal.score}
                </span>
              </div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div className="border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Why it matters</div>
                  <div className="mt-1 text-slate-700">{signal.whyItMatters}</div>
                </div>
                <div className="border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Action</div>
                  <div className="mt-1 text-slate-700">{signal.recommendedAction}</div>
                </div>
              </div>
              {signal.evidence.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {signal.evidence.slice(0, 4).map((item) => (
                    <span
                      key={`${signal.id}-${item.label}-${item.value}`}
                      className="border border-slate-200 bg-white px-2 py-1 text-slate-600"
                    >
                      <span className="font-semibold text-slate-800">{item.label}:</span>{' '}
                      {item.value}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2 py-1 ${
        active
          ? 'border-slate-950 bg-slate-950 text-white'
          : 'border-slate-300 bg-white text-slate-600'
      }`}
    >
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function exportSignals(signals: MarketSignal[]) {
  downloadCsv(
    'mandiplus-market-signals',
    [
      'title',
      'type',
      'severity',
      'confidence',
      'score',
      'commodity',
      'state',
      'summary',
      'why_it_matters',
      'recommended_action',
      'evidence',
    ],
    signals.map((signal) => [
      signal.title,
      signal.type,
      signal.severity,
      signal.confidence,
      signal.score,
      signal.commodity,
      signal.state,
      signal.summary,
      signal.whyItMatters,
      signal.recommendedAction,
      signal.evidence.map((item) => `${item.label}: ${item.value}`).join(' | '),
    ]),
  );
}
