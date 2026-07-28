'use client';

import { useEffect, useState } from 'react';
import {
  getMarketObservations,
  getMarketSourcePlan,
  getMarketSourcePreviews,
  getMarketSourceRuns,
  getMarketSources,
  getMarketWriteStatus,
  runMarketSource,
  seedMarketSources,
} from '../api';
import {
  MarketObservationRow,
  MarketSourcePlan,
  MarketSourcePreviewRow,
  MarketSourceRow,
  MarketSourceRunRow,
  MarketWriteStatus,
} from '../types';
import { formatEnumLabel, formatMoney, formatNumber } from '../formatters';
import { SourceCommandPlan } from './SourceCommandPlan';

function formatDateTime(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(startedAt: string, finishedAt: string | null) {
  const start = new Date(startedAt).getTime();
  const finish = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(finish)) return '-';
  const seconds = Math.max(0, Math.round((finish - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

function sourceHealth(source: MarketSourceRow) {
  if (source.failureCount > 0) {
    return {
      label: 'Needs attention',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }
  if (!source.lastSuccessAt) {
    return {
      label: 'Not run',
      className: 'border-slate-200 bg-slate-50 text-slate-600',
    };
  }
  if (Number(source.signalYieldScore || 0) === 0) {
    return {
      label: 'Duplicate/quiet',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }
  return {
    label: 'Healthy',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
}

function statusClass(status: MarketSourceRunRow['status']) {
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-800';
  if (status === 'running') return 'border-sky-200 bg-sky-50 text-sky-800';
  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
}

function previewStatusClass(status: MarketSourcePreviewRow['status']) {
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-800';
  if (status === 'not_configured') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
}

function previewHealthClass(health: MarketSourcePreviewRow['health']) {
  if (health === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (health === 'quiet') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (health === 'needs_key') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (health === 'needs_browser_extraction') {
    return 'border-indigo-200 bg-indigo-50 text-indigo-800';
  }
  if (health === 'retry_later') return 'border-orange-200 bg-orange-50 text-orange-800';
  return 'border-red-200 bg-red-50 text-red-800';
}

export function SourceLabControls({
  defaultCommodity = '',
  defaultState = '',
}: {
  defaultCommodity?: string;
  defaultState?: string;
}) {
  const [sources, setSources] = useState<MarketSourceRow[]>([]);
  const [runs, setRuns] = useState<MarketSourceRunRow[]>([]);
  const [previews, setPreviews] = useState<MarketSourcePreviewRow[]>([]);
  const [plan, setPlan] = useState<MarketSourcePlan | null>(null);
  const [writeStatus, setWriteStatus] = useState<MarketWriteStatus | null>(null);
  const [observations, setObservations] = useState<MarketObservationRow[]>([]);
  const [sourceLimit, setSourceLimit] = useState(100);
  const [sourceOffset, setSourceOffset] = useState(0);
  const [sourceFilters, setSourceFilters] = useState({
    commodity: defaultCommodity,
    state: defaultState,
    district: '',
    market: '',
  });
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState('');

  async function loadSources() {
    try {
      setLoading(true);
      setError('');
      const response = await getMarketSources();
      if (!response.success) throw new Error(response.message || 'Failed to load sources');
      setSources(response.data || []);
      const runResponse = await getMarketSourceRuns();
      if (runResponse.success) {
        setRuns(runResponse.data || []);
      }
      const observationResponse = await getMarketObservations({ limit: 20 });
      if (observationResponse.success) {
        setObservations(observationResponse.data || []);
      }
      const writeStatusResponse = await getMarketWriteStatus();
      if (writeStatusResponse.success) {
        setWriteStatus(writeStatusResponse.data || null);
      }
      await loadSourcePlan();
    } catch (err: any) {
      setError(err.message || 'Source tables are not ready. Run backend migrations first.');
    } finally {
      setLoading(false);
    }
  }

  async function loadSourcePlan() {
    try {
      setPlanLoading(true);
      const response = await getMarketSourcePlan();
      if (response.success) {
        setPlan(response.data || null);
      }
    } finally {
      setPlanLoading(false);
    }
  }

  async function loadPreviews() {
    return loadPreviewsFor(sourceFilters);
  }

  async function loadPreviewsFor(filters: {
    commodity: string;
    state: string;
    district: string;
    market: string;
  }) {
    try {
      setPreviewLoading(true);
      setPreviewError('');
      const response = await getMarketSourcePreviews(Math.min(sourceLimit, 25), {
        offset: sourceOffset,
        filters: activeSourceFilters(filters),
      });
      if (!response.success) throw new Error(response.message || 'Failed to load live previews');
      setPreviews(response.data || []);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to load live source previews');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function seedDefaults() {
    try {
      setLoading(true);
      setError('');
      const response = await seedMarketSources();
      if (!response.success) throw new Error(response.message || 'Failed to seed sources');
      await loadSources();
    } catch (err: any) {
      setError(err.message || 'Failed to seed source defaults');
    } finally {
      setLoading(false);
    }
  }

  async function runSource(source: MarketSourceRow) {
    try {
      setRunningId(source.id);
      setError('');
      const response = await runMarketSource(source.id, {
        limit: sourceLimit,
        offset: sourceOffset,
        filters: source.key === 'data-gov-mandi-prices'
          ? activeSourceFilters(sourceFilters)
          : {},
      });
      if (!response.success) throw new Error(response.message || 'Failed to run source');
      await loadSources();
    } catch (err: any) {
      setError(err.message || 'Failed to run source');
    } finally {
      setRunningId(null);
    }
  }

  useEffect(() => {
    loadSources();
    loadPreviews();
  }, []);

  useEffect(() => {
    setSourceFilters((prev) => ({
      ...prev,
      commodity: defaultCommodity,
      state: defaultState,
    }));
    void loadPreviewsFor({
      commodity: defaultCommodity,
      state: defaultState,
      district: sourceFilters.district,
      market: sourceFilters.market,
    });
  }, [defaultCommodity, defaultState]);

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Official Source Runs</h2>
          <p className="text-sm text-slate-500">Persistent source registry and observation ingestion.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadPreviews}
            disabled={previewLoading}
            className="border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            Preview live
          </button>
          <button
            type="button"
            onClick={seedDefaults}
            disabled={loading || writeStatus?.enabled === false}
            className="border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            Seed defaults
          </button>
          <button
            type="button"
            onClick={loadSources}
            disabled={loading}
            className="bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Refresh
          </button>
        </div>
      </div>

      {writeStatus && !writeStatus.enabled && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {writeStatus.message} Set <span className="font-mono font-semibold">{writeStatus.requiredEnv}=true</span> only on a confirmed safe database.
        </div>
      )}

      {error && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {previewError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {previewError}
        </div>
      )}

      <div className="border-b border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-950">Live Official Feed Preview</div>
            <div className="text-xs text-slate-500">
              Read-only connector samples before persistence. Useful for validating extraction quality.
            </div>
          </div>
          {previewLoading && <div className="text-xs text-slate-500">Fetching official feeds...</div>}
        </div>

        <div className="mb-3 grid gap-2 lg:grid-cols-[80px_90px_repeat(4,minmax(120px,1fr))_auto]">
          <NumberInput label="Limit" value={sourceLimit} min={1} max={1000} onChange={setSourceLimit} />
          <NumberInput label="Offset" value={sourceOffset} min={0} max={100000} onChange={setSourceOffset} />
          <SourceFilterInput
            label="Commodity"
            value={sourceFilters.commodity}
            onChange={(value) => setSourceFilters((prev) => ({ ...prev, commodity: value }))}
          />
          <SourceFilterInput
            label="State"
            value={sourceFilters.state}
            onChange={(value) => setSourceFilters((prev) => ({ ...prev, state: value }))}
          />
          <SourceFilterInput
            label="District"
            value={sourceFilters.district}
            onChange={(value) => setSourceFilters((prev) => ({ ...prev, district: value }))}
          />
          <SourceFilterInput
            label="Market"
            value={sourceFilters.market}
            onChange={(value) => setSourceFilters((prev) => ({ ...prev, market: value }))}
          />
          <button
            type="button"
            onClick={() => {
              setSourceLimit(100);
              setSourceOffset(0);
              const resetFilters = {
                commodity: defaultCommodity,
                state: defaultState,
                district: '',
                market: '',
              };
              setSourceFilters(resetFilters);
              void loadPreviewsFor(resetFilters);
            }}
            className="border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Reset
          </button>
        </div>

        {previews.length === 0 ? (
          <div className="border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            No live previews loaded yet.
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-3">
            {previews.map((preview) => (
              <div key={preview.key} className="border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{preview.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatNumber(preview.observationsFound)} fetched · {preview.sampleObservations.length} usable samples
                    </div>
                    {preview.requiredEnv && (
                      <div className="mt-1 font-mono text-[11px] font-semibold text-slate-600">
                        needs {preview.requiredEnv}
                      </div>
                    )}
                  </div>
                  <span className={`border px-2 py-1 text-[11px] font-semibold uppercase ${previewStatusClass(preview.status)}`}>
                    {formatEnumLabel(preview.status)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <div className={`border px-2 py-2 ${previewHealthClass(preview.health)}`}>
                    <div className="font-semibold uppercase">Health</div>
                    <div>{formatEnumLabel(preview.health)}</div>
                  </div>
                  <div className="border border-slate-200 bg-white px-2 py-2 text-slate-700">
                    <div className="font-semibold uppercase text-slate-500">Mode</div>
                    <div>{formatEnumLabel(preview.extractionMode)}</div>
                  </div>
                  <div className="border border-slate-200 bg-white px-2 py-2 text-slate-700">
                    <div className="font-semibold uppercase text-slate-500">Reliability</div>
                    <div>{formatNumber(preview.reliabilityScore)}/100</div>
                  </div>
                </div>

                {(preview.message || preview.setupNote) && (
                  <div className="mt-3 border border-amber-200 bg-white px-2 py-2 text-xs text-amber-800">
                    {preview.setupNote || preview.message}
                  </div>
                )}

                <div className="mt-3 space-y-2 text-xs leading-5">
                  <div className="border border-slate-200 bg-white p-2 text-slate-700">
                    <span className="font-semibold text-slate-950">Use: </span>
                    {preview.operatorUse}
                  </div>
                  <div className="border border-slate-200 bg-white p-2 text-slate-700">
                    <span className="font-semibold text-slate-950">Impact: </span>
                    {preview.businessImpact}
                  </div>
                  <div className="border border-emerald-200 bg-emerald-50 p-2 text-emerald-900">
                    <span className="font-semibold">Next: </span>
                    {preview.nextAction}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {preview.sampleObservations.slice(0, 2).map((item, index) => (
                    <div key={`${preview.key}-${item.rawUrl || index}`} className="border border-slate-200 bg-white p-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold uppercase text-slate-500">
                          {formatEnumLabel(item.observationType)}
                        </span>
                        {item.commodity && <span className="text-slate-700">{item.commodity}</span>}
                        {item.state && <span className="text-slate-500">{item.state}</span>}
                        {item.priceModal !== null && (
                          <span className="font-semibold text-slate-900">{formatMoney(Number(item.priceModal))}</span>
                        )}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                        {item.rawText}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SourceCommandPlan plan={plan} loading={planLoading} />

      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          {sources.length === 0 ? (
            <div className="border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No sources registered yet. Seed defaults after running the migration.
            </div>
          ) : (
            sources.map((source) => {
              const health = sourceHealth(source);
              const recentRuns = runs.filter((run) => run.sourceId === source.id).slice(0, 3);
              return (
              <div key={source.id} className="border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-slate-950">{source.name}</div>
                      <span className={`border px-2 py-0.5 text-[11px] font-semibold uppercase ${health.className}`}>
                        {health.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {source.kind} · trust tier {source.trustTier} · failures {source.failureCount}
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <div className="border border-slate-100 bg-slate-50 px-2 py-1">
                        <div className="text-slate-400">Last success</div>
                        <div className="font-medium text-slate-800">{formatDateTime(source.lastSuccessAt)}</div>
                      </div>
                      <div className="border border-slate-100 bg-slate-50 px-2 py-1">
                        <div className="text-slate-400">Yield</div>
                        <div className="font-medium text-slate-800">{Number(source.signalYieldScore || 0).toFixed(0)}%</div>
                      </div>
                      <div className="border border-slate-100 bg-slate-50 px-2 py-1">
                        <div className="text-slate-400">Cadence</div>
                        <div className="font-medium text-slate-800">{source.refreshCadenceMinutes}m</div>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => runSource(source)}
                    disabled={runningId === source.id || writeStatus?.enabled === false}
                    className="bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {runningId === source.id ? 'Running' : 'Run'}
                  </button>
                </div>
                {recentRuns.length > 0 && (
                  <div className="mt-3 divide-y divide-slate-100 border border-slate-100">
                    {recentRuns.map((run) => (
                      <div key={run.id} className="grid gap-2 px-2 py-2 text-xs text-slate-600 sm:grid-cols-[110px_1fr_80px]">
                        <span className={`w-fit border px-2 py-0.5 font-semibold uppercase ${statusClass(run.status)}`}>
                          {run.status}
                        </span>
                        <span>
                          {run.observationsFound} found · {run.observationsSaved} saved
                          {run.errorMessage ? ` · ${run.errorMessage}` : ''}
                        </span>
                        <span className="text-right text-slate-400">
                          {formatDuration(run.startedAt, run.finishedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })
          )}
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold text-slate-950">Recent Observations</div>
          <div className="max-h-[360px] divide-y divide-slate-100 overflow-auto border border-slate-200">
            {observations.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No observations ingested yet.</div>
            ) : (
              observations.map((item) => (
                <div key={item.id} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-slate-950">
                      {item.commodity || 'Commodity'} · {item.market || 'Market'}
                    </div>
                    <div className="text-slate-500">{item.state || '-'}</div>
                  </div>
                  <div className="mt-1 text-slate-600">
                    Modal {item.priceModal !== null ? formatMoney(Number(item.priceModal)) : '-'}
                    {' · '}
                    Min {item.priceMin !== null ? formatMoney(Number(item.priceMin)) : '-'}
                    {' · '}
                    Max {item.priceMax !== null ? formatMoney(Number(item.priceMax)) : '-'}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {item.source?.name || 'Source'} · {new Date(item.observedAt).toLocaleDateString('en-IN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function activeSourceFilters(filters: {
  commodity: string;
  state: string;
  district: string;
  market: string;
}) {
  return Object.fromEntries(
    Object.entries(filters)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value),
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isFinite(next) ? Math.min(Math.max(next, min), max) : min);
        }}
        className="mt-1 w-full border border-slate-300 px-2 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600"
      />
    </label>
  );
}

function SourceFilterInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-slate-300 px-2 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600"
      />
    </label>
  );
}
