import { useMemo, useState } from 'react';
import { AlertTriangle, Download, FilterX } from 'lucide-react';
import {
  ExternalContextIntelligence,
  MarketAnomaly,
  MarketQualitySnapshot,
  PriceGapIntelligence,
} from '../types';
import { downloadCsv } from '../exporters';
import { formatEnumLabel, formatMoney, formatNumber, formatPct, severityClass } from '../formatters';

type RiskCategory = 'all' | 'anomaly' | 'price_gap' | 'external_context' | 'blind_spot';
type RiskSeverity = 'all' | 'high' | 'medium' | 'low';

interface RiskItem {
  id: string;
  category: Exclude<RiskCategory, 'all'>;
  severity: Exclude<RiskSeverity, 'all'>;
  score: number;
  title: string;
  scope: string;
  evidence: string;
  action: string;
  source: string;
}

export function RiskWatchBoard({
  anomalies,
  priceGaps,
  externalContext,
  quality,
}: {
  anomalies: MarketAnomaly[];
  priceGaps: PriceGapIntelligence[];
  externalContext: ExternalContextIntelligence[];
  quality: MarketQualitySnapshot | null;
}) {
  const [categoryFilter, setCategoryFilter] = useState<RiskCategory>('all');
  const [severityFilter, setSeverityFilter] = useState<RiskSeverity>('all');

  const risks = useMemo(
    () => buildRiskItems({ anomalies, priceGaps, externalContext, quality }),
    [anomalies, externalContext, priceGaps, quality],
  );

  const filteredRisks = useMemo(
    () =>
      risks.filter((risk) => {
        if (categoryFilter !== 'all' && risk.category !== categoryFilter) return false;
        if (severityFilter !== 'all' && risk.severity !== severityFilter) return false;
        return true;
      }),
    [categoryFilter, risks, severityFilter],
  );

  const totals = useMemo(
    () => ({
      total: filteredRisks.length,
      high: filteredRisks.filter((risk) => risk.severity === 'high').length,
      priceGaps: filteredRisks.filter((risk) => risk.category === 'price_gap').length,
      blindSpots: filteredRisks.filter((risk) => risk.category === 'blind_spot').length,
    }),
    [filteredRisks],
  );

  function exportRisks() {
    downloadCsv(
      'mandiplus-risk-watch',
      ['Category', 'Severity', 'Score', 'Title', 'Scope', 'Evidence', 'Action', 'Source'],
      filteredRisks.map((risk) => [
        formatEnumLabel(risk.category),
        risk.severity,
        risk.score,
        risk.title,
        risk.scope,
        risk.evidence,
        risk.action,
        risk.source,
      ]),
    );
  }

  function resetFilters() {
    setCategoryFilter('all');
    setSeverityFilter('all');
  }

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-4 border-b border-slate-200 p-4 xl:grid-cols-[1fr_auto] xl:items-end">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <h2 className="text-base font-semibold text-slate-950">Risk Watch Board</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            One queue for abnormal movement, price mismatch, outside hazards, and signal blind spots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as RiskCategory)}
            className="border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-600"
          >
            <option value="all">All categories</option>
            <option value="anomaly">Anomalies</option>
            <option value="price_gap">Price gaps</option>
            <option value="external_context">External context</option>
            <option value="blind_spot">Blind spots</option>
          </select>
          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value as RiskSeverity)}
            className="border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-600"
          >
            <option value="all">All severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {(categoryFilter !== 'all' || severityFilter !== 'all') && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            >
              <FilterX className="h-4 w-4" />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={exportRisks}
            className="inline-flex items-center gap-2 bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div className="grid gap-px bg-slate-200 md:grid-cols-4">
        <Metric label="Filtered risks" value={formatNumber(totals.total)} />
        <Metric label="High severity" value={formatNumber(totals.high)} tone="red" />
        <Metric label="Price gaps" value={formatNumber(totals.priceGaps)} />
        <Metric label="Blind spots" value={formatNumber(totals.blindSpots)} />
      </div>

      {filteredRisks.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No risk items match this scope. Expand filters or refresh after more source observations arrive.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filteredRisks.slice(0, 12).map((risk) => (
            <article key={risk.id} className="grid gap-4 px-4 py-4 xl:grid-cols-[210px_1fr_0.85fr]">
              <div>
                <span className={`inline-flex border px-2 py-1 text-xs font-semibold uppercase ${severityClass(risk.severity)}`}>
                  {risk.severity} · {Math.round(risk.score)}
                </span>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {formatEnumLabel(risk.category)}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-800">{risk.scope}</div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-950">{risk.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{risk.evidence}</p>
                <div className="mt-2 text-xs text-slate-500">{risk.source}</div>
              </div>

              <div className="border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-slate-800">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Operator action
                </div>
                <div className="mt-1">{risk.action}</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function buildRiskItems({
  anomalies,
  priceGaps,
  externalContext,
  quality,
}: {
  anomalies: MarketAnomaly[];
  priceGaps: PriceGapIntelligence[];
  externalContext: ExternalContextIntelligence[];
  quality: MarketQualitySnapshot | null;
}): RiskItem[] {
  const anomalyItems = anomalies.map<RiskItem>((anomaly) => ({
    id: `anomaly-${anomaly.id}`,
    category: 'anomaly',
    severity: anomaly.severity,
    score: anomaly.score,
    title: anomaly.title,
    scope: anomaly.route
      ? `${anomaly.route.source} -> ${anomaly.route.destination}`
      : [anomaly.commodity, anomaly.state].filter(Boolean).join(' · ') || 'Market scope',
    evidence: `${formatEnumLabel(anomaly.metric)} moved from ${formatNumber(anomaly.previousValue)} to ${formatNumber(anomaly.currentValue)} (${formatPct(anomaly.changePct)}). ${anomaly.explanation}`,
    action: anomaly.recommendedAction,
    source: 'Invoice and trip movement comparison',
  }));

  const priceGapItems = priceGaps.map<RiskItem>((gap) => {
    const severity = gapSeverity(gap.gapPct);
    return {
      id: `price-gap-${gap.commodity}-${gap.state}-${gap.market}-${gap.direction}`,
      category: 'price_gap',
      severity,
      score: Math.min(100, Math.max(45, Math.abs(gap.gapPct) * 4)),
      title: `${gap.commodity} price gap in ${gap.state}`,
      scope: `${gap.market} · ${gap.direction === 'PUBLIC_PREMIUM' ? 'public premium' : 'internal premium'}`,
      evidence: `Internal ${formatMoney(gap.internalAvgRate)} vs public ${formatMoney(gap.publicModalPrice)}. Gap ${formatPct(gap.gapPct)} across ${formatNumber(gap.invoiceCount)} invoices and ${formatNumber(gap.vehicleCount)} gadi.`,
      action: gap.recommendedAction,
      source: gap.sourceName,
    };
  });

  const externalItems = externalContext
    .filter((row) => row.confidence >= 55 || (row.hazardTags || []).length > 0)
    .map<RiskItem>((row, index) => {
      const severity = externalSeverity(row);
      const location = [row.market, row.state].filter(Boolean).join(', ') || 'External scope';
      return {
        id: `external-${row.observationType}-${row.latestObservedAt}-${index}`,
        category: 'external_context',
        severity,
        score: Math.min(100, Math.max(35, row.confidence + (row.hazardTags?.length || 0) * 8)),
        title: row.title,
        scope: [row.commodity, location].filter(Boolean).join(' · '),
        evidence: row.rawText || 'Context captured without a text excerpt.',
        action: buildExternalAction(row),
        source: `${row.sourceName}${row.latestObservedAt ? ` · ${formatObservedAt(row.latestObservedAt)}` : ''}`,
      };
    });

  const blindSpotItems = (quality?.blindSpots || []).map<RiskItem>((blindSpot, index) => ({
    id: `blind-spot-${index}-${blindSpot}`,
    category: 'blind_spot',
    severity: quality?.status === 'blind' ? 'high' : 'medium',
    score: Math.max(40, 100 - (quality?.overallScore || 0)),
    title: 'Signal blind spot',
    scope: 'Coverage quality',
    evidence: blindSpot,
    action: quality?.nextActions[index] || 'Add one trusted source or field confirmation for this blind spot.',
    source: 'Signal quality scorecard',
  }));

  return [...anomalyItems, ...priceGapItems, ...externalItems, ...blindSpotItems]
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}

function gapSeverity(gapPct: number): RiskItem['severity'] {
  const absGap = Math.abs(gapPct);
  if (absGap >= 15) return 'high';
  if (absGap >= 8) return 'medium';
  return 'low';
}

function externalSeverity(row: ExternalContextIntelligence): RiskItem['severity'] {
  const hazardCount = row.hazardTags?.length || 0;
  if (row.confidence >= 80 || hazardCount >= 2 || row.observationType === 'competitor_text') return 'high';
  if (row.confidence >= 60 || hazardCount === 1) return 'medium';
  return 'low';
}

function buildExternalAction(row: ExternalContextIntelligence) {
  const target = [row.commodity, row.market || row.state].filter(Boolean).join(' in ');
  if (row.observationType === 'weather') {
    return `Check supply and dispatch timing${target ? ` for ${target}` : ''}; verify crop arrivals with two operators.`;
  }
  if (row.observationType === 'policy') {
    return `Confirm trade impact with mandi agent and update buyer/supplier call script${target ? ` for ${target}` : ''}.`;
  }
  if (row.observationType === 'competitor_text') {
    return `Ask active partners what competitor rate or incentive changed${target ? ` around ${target}` : ''}.`;
  }
  return `Validate this context with field calls and watch matching invoice/route movement${target ? ` for ${target}` : ''}.`;
}

function formatObservedAt(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Metric({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'red';
}) {
  return (
    <div className="bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === 'red' ? 'text-red-700' : 'text-slate-950'}`}>
        {value}
      </div>
    </div>
  );
}
