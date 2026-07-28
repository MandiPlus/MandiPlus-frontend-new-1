'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAdmin } from '@/features/admin/context/AdminContext';
import { generateMarketNarrative, getMarketPulse } from './api';
import {
  CommodityGeography,
  MarketNarrative,
  MarketPeriod,
  MarketPulseData,
  MarketPulseResponseMeta,
} from './types';
import { PulseKpis } from './components/PulseKpis';
import { IndiaActivityMap } from './components/IndiaActivityMap';
import { SignalFeed } from './components/SignalFeed';
import { CommodityTable } from './components/CommodityTable';
import { RouteTable } from './components/RouteTable';
import { PeopleToCall } from './components/PeopleToCall';
import { SourceCoverage } from './components/SourceCoverage';
import { SourceLabControls } from './components/SourceLabControls';
import { ExternalPricePanel } from './components/ExternalPricePanel';
import { ExternalContextPanel } from './components/ExternalContextPanel';
import { PriceGapPanel } from './components/PriceGapPanel';
import { AiMarketBrief } from './components/AiMarketBrief';
import { MarketPlaybook } from './components/MarketPlaybook';
import { AnomalyRadar } from './components/AnomalyRadar';
import { QualityCommandPanel } from './components/QualityCommandPanel';
import { OpportunityDesk } from './components/OpportunityDesk';
import { CallMissionBoard } from './components/CallMissionBoard';
import { CommodityStateMatrix } from './components/CommodityStateMatrix';
import { ExecutiveReadout } from './components/ExecutiveReadout';
import { EvidenceScorecards } from './components/EvidenceScorecards';
import { LaneCommandBoard } from './components/LaneCommandBoard';
import { DailyActionQueue } from './components/DailyActionQueue';
import { FieldFeedbackCapture } from './components/FieldFeedbackCapture';
import { exportCommandPack } from './commandPackExport';
import { StateCommandBoard } from './components/StateCommandBoard';
import { DealDesk } from './components/DealDesk';
import { CommandCenterStrip } from './components/CommandCenterStrip';
import { OriginCommandBoard } from './components/OriginCommandBoard';
import { DestinationDemandBoard } from './components/DestinationDemandBoard';
import { MarketTimeline } from './components/MarketTimeline';
import { RiskWatchBoard } from './components/RiskWatchBoard';
import { GadiFlowDesk } from './components/GadiFlowDesk';
import { LiveSignalRadar } from './components/LiveSignalRadar';
import { MorningOperatingBrief } from './components/MorningOperatingBrief';

const PERIODS: Array<{ value: MarketPeriod; label: string }> = [
  { value: 'quarter', label: 'Quarter' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

type DatePreset = {
  label: string;
  startDate: string;
  endDate: string;
  kind: 'quarter' | 'month';
};

export function MarketIntelligenceDashboard() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, canAccessSection } = useAdmin();
  const canViewMarketPulse = canAccessSection('market-intelligence');
  const [period, setPeriod] = useState<MarketPeriod>(() => initialPeriod());
  const [commodity, setCommodity] = useState(() => initialParam('commodity'));
  const [state, setState] = useState(() => initialParam('state'));
  const [startDate, setStartDate] = useState(() => initialParam('startDate'));
  const [endDate, setEndDate] = useState(() => initialParam('endDate'));
  const [data, setData] = useState<MarketPulseData | null>(null);
  const [meta, setMeta] = useState<MarketPulseResponseMeta | null>(null);
  const [narrative, setNarrative] = useState<MarketNarrative | null>(null);
  const [loading, setLoading] = useState(true);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [scopeCopied, setScopeCopied] = useState(false);
  const [error, setError] = useState('');

  const selectedState = useMemo(
    () => state || data?.regionActivity[0]?.state || '',
    [data?.regionActivity, state],
  );
  const hasActiveScope = Boolean(commodity.trim() || state.trim());

  async function loadPulse(overrides?: Partial<{ commodity: string; state: string }>) {
    const nextCommodity = overrides?.commodity ?? commodity;
    const nextState = overrides?.state ?? state;
    try {
      setLoading(true);
      setError('');
      const response = await getMarketPulse({
        period,
        commodity: nextCommodity.trim() || undefined,
        state: nextState.trim() || undefined,
        startDate: period === 'custom' ? startDate || undefined : undefined,
        endDate: period === 'custom' ? endDate || undefined : undefined,
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to load market pulse');
      }
      setData(response.data);
      setMeta(response.meta || null);
      setNarrative(null);
      syncScopeUrl({
        period,
        commodity: nextCommodity,
        state: nextState,
        startDate: period === 'custom' ? startDate : '',
        endDate: period === 'custom' ? endDate : '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load market pulse');
    } finally {
      setLoading(false);
    }
  }

  function selectCommodityFromMap(nextCommodity: string) {
    setCommodity(nextCommodity);
    void loadPulse({ commodity: nextCommodity, state });
  }

  function selectStateFromMap(nextState: string) {
    setState(nextState);
    void loadPulse({ commodity, state: nextState });
  }

  function focusCommodityState(row: CommodityGeography) {
    setCommodity(row.commodity);
    setState(row.state);
    void loadPulse({ commodity: row.commodity, state: row.state });
  }

  function clearCommodityScope() {
    setCommodity('');
    void loadPulse({ commodity: '', state });
  }

  function clearStateScope() {
    setState('');
    void loadPulse({ commodity, state: '' });
  }

  function clearAllScope() {
    setCommodity('');
    setState('');
    void loadPulse({ commodity: '', state: '' });
  }

  function applyDatePreset(preset: DatePreset) {
    setPeriod('custom');
    setStartDate(preset.startDate);
    setEndDate(preset.endDate);
    void loadPulseForScope({
      period: 'custom',
      commodity,
      state,
      startDate: preset.startDate,
      endDate: preset.endDate,
    });
  }

  async function loadPulseForScope(scope: {
    period: MarketPeriod;
    commodity: string;
    state: string;
    startDate: string;
    endDate: string;
  }) {
    try {
      setLoading(true);
      setError('');
      const response = await getMarketPulse({
        period: scope.period,
        commodity: scope.commodity.trim() || undefined,
        state: scope.state.trim() || undefined,
        startDate: scope.period === 'custom' ? scope.startDate || undefined : undefined,
        endDate: scope.period === 'custom' ? scope.endDate || undefined : undefined,
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to load market pulse');
      }
      setData(response.data);
      setMeta(response.meta || null);
      setNarrative(null);
      syncScopeUrl(scope);
    } catch (err: any) {
      setError(err.message || 'Failed to load market pulse');
    } finally {
      setLoading(false);
    }
  }

  async function loadNarrative() {
    try {
      setNarrativeLoading(true);
      setError('');
      const response = await generateMarketNarrative({
        period,
        commodity: commodity.trim() || undefined,
        state: state.trim() || undefined,
        startDate: period === 'custom' ? startDate || undefined : undefined,
        endDate: period === 'custom' ? endDate || undefined : undefined,
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to generate AI brief');
      }
      setNarrative(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate AI brief');
    } finally {
      setNarrativeLoading(false);
    }
  }

  async function copyScopeLink() {
    const url = buildScopeUrl({
      period,
      commodity,
      state,
      startDate: period === 'custom' ? startDate : '',
      endDate: period === 'custom' ? endDate : '',
    });
    try {
      await navigator.clipboard.writeText(url);
      setScopeCopied(true);
      window.setTimeout(() => setScopeCopied(false), 1800);
    } catch {
      setError('Unable to copy scope link');
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }
    if (!canViewMarketPulse) return;
    loadPulse();
  }, [authLoading, isAuthenticated, canViewMarketPulse, router]);

  if (!authLoading && (!isAuthenticated || !canViewMarketPulse)) {
    return (
      <div className="p-8">
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Market intelligence access required.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="flex flex-col gap-4 border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              MandiPlus Market Pulse
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">
              Signals, mandi movement, and gadi flow
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Read-only intelligence from invoices, field notes, WhatsApp coverage, Traqo trips,
              official market feeds, weather, policy, and source context.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[130px_150px_150px_130px_110px]">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as MarketPeriod)}
              className="border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600"
            >
              {PERIODS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <input
              value={commodity}
              onChange={(event) => setCommodity(event.target.value)}
              placeholder="Commodity"
              className="border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
            <input
              value={state}
              onChange={(event) => setState(event.target.value)}
              placeholder="State"
              className="border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
            <button
              type="button"
              onClick={() => loadPulse()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={copyScopeLink}
              className="border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            >
              {scopeCopied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </header>

        {period === 'custom' && (
          <div className="flex flex-wrap gap-2 border border-slate-200 bg-white p-3">
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        <DatePresetStrip
          currentStartDate={period === 'custom' ? startDate : ''}
          currentEndDate={period === 'custom' ? endDate : ''}
          onSelect={applyDatePreset}
        />

        {hasActiveScope && (
          <div className="flex flex-col gap-3 border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Active scope
              </span>
              {commodity.trim() && (
                <ScopeChip label="Commodity" value={commodity} onClear={clearCommodityScope} />
              )}
              {state.trim() && (
                <ScopeChip label="State" value={state} onClear={clearStateScope} />
              )}
            </div>
            <button
              type="button"
              onClick={clearAllScope}
              disabled={loading}
              className="w-fit border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
            >
              Clear scope
            </button>
          </div>
        )}

        {error && (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex h-64 items-center justify-center border border-slate-200 bg-white text-sm text-slate-500">
            Loading market pulse...
          </div>
        ) : data ? (
          <>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{data.range.label}: {data.range.startDate} to {data.range.endDate}</span>
              <span className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => exportCommandPack(data)}
                  className="border border-slate-300 bg-white px-2 py-0.5 font-semibold uppercase text-slate-700"
                >
                  Export command pack
                </button>
                <span>Generated {new Date(data.generatedAt).toLocaleString('en-IN')}</span>
                {meta && (
                  <span className="border border-slate-200 bg-white px-2 py-0.5 font-semibold uppercase text-slate-600">
                    {meta.cache} · {formatMs(meta.computeMs)} compute · {formatMs(meta.ageMs)} age
                  </span>
                )}
              </span>
            </div>

            <MorningOperatingBrief data={data} />

            <CommandCenterStrip data={data} />

            <PulseKpis data={data} />

            <MarketTimeline rows={data.timeline || []} />

            <GadiFlowDesk routes={data.routeActivity || []} />

            {data.executiveSummary && (
              <ExecutiveReadout summary={data.executiveSummary} />
            )}

            <DailyActionQueue actions={data.dailyActions || []} />

            <LiveSignalRadar
              query={{
                period,
                commodity: commodity.trim() || undefined,
                state: state.trim() || undefined,
                startDate: period === 'custom' ? startDate || undefined : undefined,
                endDate: period === 'custom' ? endDate || undefined : undefined,
              }}
            />

            <FieldFeedbackCapture
              defaultCommodity={commodity}
              defaultState={state || selectedState}
              onCaptured={() => loadPulse()}
            />

            <EvidenceScorecards scorecards={data.evidenceScorecards || []} />

            {data.quality && <QualityCommandPanel quality={data.quality} />}

            <RiskWatchBoard
              anomalies={data.anomalies || []}
              priceGaps={data.priceGaps || []}
              externalContext={data.externalContext || []}
              quality={data.quality || null}
            />

            <AiMarketBrief
              narrative={narrative}
              loading={narrativeLoading}
              onGenerate={loadNarrative}
            />

            <DealDesk
              opportunities={data.opportunities || []}
              lanes={data.laneScorecards || []}
              people={data.peopleToCall || []}
            />

            <OpportunityDesk opportunities={data.opportunities || []} />

            <CallMissionBoard missions={data.callMissions || []} />

            <AnomalyRadar anomalies={data.anomalies} />

            <MarketPlaybook plays={data.marketPlays} />

            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <IndiaActivityMap
                regions={data.regionActivity}
                commodityGeography={data.commodityGeography}
                routes={data.routeActivity}
                selectedState={selectedState}
                onSelectState={selectStateFromMap}
                onSelectCommodity={selectCommodityFromMap}
              />
              <SignalFeed signals={data.signals} />
            </div>

            <StateCommandBoard
              rows={data.regionActivity || []}
              onSelectState={selectStateFromMap}
              onSelectCommodity={selectCommodityFromMap}
            />

            <LaneCommandBoard lanes={data.laneScorecards || []} />

            <div className="grid gap-5 xl:grid-cols-2">
              <OriginCommandBoard routes={data.routeActivity || []} />
              <DestinationDemandBoard routes={data.routeActivity || []} />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <CommodityTable rows={data.commodityTrends} />
              <RouteTable rows={data.routeActivity} />
            </div>

            <CommodityStateMatrix
              rows={data.commodityGeography || []}
              onFocus={focusCommodityState}
            />

            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <ExternalPricePanel rows={data.externalPrices} />
              <ExternalContextPanel rows={data.externalContext || []} />
            </div>

            <PriceGapPanel rows={data.priceGaps || []} />

            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <PeopleToCall rows={data.peopleToCall} />
              <SourceCoverage
                coverage={data.sourceCoverage}
                backlog={data.sourceBacklog}
                needs={data.sourceNeeds || []}
              />
            </div>

            <SourceLabControls
              defaultCommodity={commodity.trim()}
              defaultState={state.trim()}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function ScopeChip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm text-emerald-900">
      <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      <span className="font-semibold">{value}</span>
      <button
        type="button"
        onClick={onClear}
        className="border-l border-emerald-200 pl-2 text-xs font-semibold text-emerald-800"
      >
        Clear
      </button>
    </span>
  );
}

function DatePresetStrip({
  currentStartDate,
  currentEndDate,
  onSelect,
}: {
  currentStartDate: string;
  currentEndDate: string;
  onSelect: (preset: DatePreset) => void;
}) {
  const presets = useMemo(() => buildDatePresets(), []);

  return (
    <div className="border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Date presets
          </div>
          <div className="text-sm text-slate-600">
            Jump to exact quarters or months for mandi, crop, and gadi comparison.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active =
              currentStartDate === preset.startDate && currentEndDate === preset.endDate;
            return (
              <button
                key={`${preset.kind}-${preset.label}`}
                type="button"
                onClick={() => onSelect(preset)}
                className={`border px-3 py-2 text-xs font-semibold ${
                  active
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-600 hover:text-emerald-700'
                }`}
                title={`${preset.startDate} to ${preset.endDate}`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function buildDatePresets(): DatePreset[] {
  const today = new Date();
  const quarters = Array.from({ length: 6 }, (_, index) => {
    const quarterIndex = Math.floor(today.getMonth() / 3) - index;
    const year = today.getFullYear() + Math.floor(quarterIndex / 4);
    const normalizedQuarter = ((quarterIndex % 4) + 4) % 4;
    const start = new Date(year, normalizedQuarter * 3, 1);
    const quarterEnd = new Date(year, normalizedQuarter * 3 + 3, 0);
    const end = quarterEnd.getTime() > today.getTime() ? today : quarterEnd;
    return {
      label: `Q${normalizedQuarter + 1} ${year}`,
      startDate: dateOnly(start),
      endDate: dateOnly(end),
      kind: 'quarter' as const,
    };
  });

  const months = Array.from({ length: 4 }, (_, index) => {
    const start = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const end = monthEnd.getTime() > today.getTime() ? today : monthEnd;
    return {
      label: start.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      startDate: dateOnly(start),
      endDate: dateOnly(end),
      kind: 'month' as const,
    };
  });

  return [...quarters, ...months];
}

function dateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMs(value: number) {
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

function initialParam(key: string) {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) || '';
}

function initialPeriod(): MarketPeriod {
  const value = initialParam('period');
  return PERIODS.some((item) => item.value === value) ? (value as MarketPeriod) : 'quarter';
}

function buildScopeUrl(scope: {
  period: MarketPeriod;
  commodity: string;
  state: string;
  startDate: string;
  endDate: string;
}) {
  const url = new URL(
    typeof window === 'undefined'
      ? 'http://localhost/admin/market-intelligence'
      : window.location.href,
  );
  url.pathname = '/admin/market-intelligence';
  url.search = '';
  url.searchParams.set('period', scope.period);
  if (scope.commodity.trim()) url.searchParams.set('commodity', scope.commodity.trim());
  if (scope.state.trim()) url.searchParams.set('state', scope.state.trim());
  if (scope.period === 'custom') {
    if (scope.startDate) url.searchParams.set('startDate', scope.startDate);
    if (scope.endDate) url.searchParams.set('endDate', scope.endDate);
  }
  return url.toString();
}

function syncScopeUrl(scope: {
  period: MarketPeriod;
  commodity: string;
  state: string;
  startDate: string;
  endDate: string;
}) {
  if (typeof window === 'undefined') return;
  const nextUrl = buildScopeUrl(scope);
  window.history.replaceState(null, '', nextUrl);
}
