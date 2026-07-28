import { useState } from 'react';
import { Clipboard, Download } from 'lucide-react';
import { MarketPulseData } from '../types';
import { downloadCsv } from '../exporters';
import { formatMoney, formatNumber } from '../formatters';

export function MorningOperatingBrief({ data }: { data: MarketPulseData }) {
  const [copied, setCopied] = useState(false);
  const brief = buildBrief(data);

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Morning Operating Brief
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-950">{brief.headline}</h2>
          <p className="mt-1 text-sm text-slate-500">
            One-page working brief for sales, sourcing, dispatch, and field verification.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copyBrief(brief, setCopied)}
            className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-emerald-600 hover:text-emerald-700"
          >
            <Clipboard className="h-3.5 w-3.5" />
            {copied ? 'Copied' : 'Copy brief'}
          </button>
          <button
            type="button"
            onClick={() => exportBrief(brief)}
            className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-emerald-600 hover:text-emerald-700"
          >
            <Download className="h-3.5 w-3.5" />
            Export brief
          </button>
        </div>
      </div>

      <div className="grid gap-3 p-4 xl:grid-cols-5">
        {brief.cards.map((card) => (
          <div key={card.label} className="border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {card.label}
            </div>
            <div className="mt-1 min-h-10 text-sm font-semibold leading-5 text-slate-950">
              {card.title}
            </div>
            <div className="mt-2 text-xs leading-5 text-slate-600">{card.detail}</div>
            <div className="mt-2 border border-white bg-white px-2 py-1 text-[11px] leading-4 text-slate-500">
              {card.proof}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 border-t border-slate-100 p-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="border border-emerald-100 bg-emerald-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            First 60 minutes
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {brief.firstHour.map((item) => (
              <div key={item} className="border border-emerald-100 bg-white px-3 py-2 text-sm leading-5 text-emerald-950">
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="border border-amber-100 bg-amber-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Do not miss
          </div>
          <div className="mt-2 space-y-2">
            {brief.watchouts.map((item) => (
              <div key={item} className="border border-amber-100 bg-white px-3 py-2 text-sm leading-5 text-amber-950">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function buildBrief(data: MarketPulseData) {
  const topAction = data.dailyActions?.[0] || null;
  const topLane =
    data.routeActivity?.find((route) => route.activeTrips > 0) ||
    data.routeActivity?.[0] ||
    null;
  const topMission = data.callMissions?.[0] || null;
  const topPerson =
    topMission?.callTargets?.[0] ||
    data.peopleToCall?.[0] ||
    null;
  const topRisk =
    data.anomalies?.[0]?.recommendedAction ||
    data.priceGaps?.[0]?.recommendedAction ||
    data.quality?.nextActions?.[0] ||
    'No urgent risk action generated for this scope.';
  const sourceBlocker =
    data.sourceNeeds?.find((need) => need.status === 'missing') ||
    null;
  const topCommodity = data.commodityTrends?.[0] || null;
  const topState = data.regionActivity?.[0] || null;

  const cards = [
    {
      label: 'Start here',
      title: topAction?.title || data.executiveSummary?.headline || 'No ranked action generated',
      detail: topAction?.action || data.executiveSummary?.immediateActions?.[0] || 'Refresh scope or capture field feedback.',
      proof: topAction
        ? `${topAction.priority} priority · ${topAction.score}/100 · ${topAction.ownerHint}`
        : `${formatNumber(data.signals?.length || 0)} signals in scope`,
    },
    {
      label: 'Lane to work',
      title: topLane ? `${topLane.source} -> ${topLane.destination}` : 'No lane activity',
      detail: topLane?.operatorAction || 'No route movement found in this period.',
      proof: topLane
        ? `${formatNumber(topLane.vehicleCount)} gadi · ${formatNumber(topLane.activeTrips)} active · ${topLane.urgencyScore}/100 urgency`
        : `${formatNumber(data.totals.tripCount)} trips in scope`,
    },
    {
      label: 'First call',
      title: topPerson?.name || 'No call target',
      detail: callTargetDetail(topPerson, topMission?.expectedOutcome),
      proof: topPerson
        ? `${topPerson.mobileNumber || ''} · ${topPerson.identity || 'contact'}`
        : `${formatNumber(data.peopleToCall?.length || 0)} people mapped`,
    },
    {
      label: 'Risk check',
      title: data.anomalies?.[0]?.title || data.priceGaps?.[0]?.market || data.quality?.status || 'Risk quiet',
      detail: topRisk,
      proof: `${formatNumber(data.anomalies?.length || 0)} anomalies · ${formatNumber(data.priceGaps?.length || 0)} price gaps`,
    },
    {
      label: 'Source gap',
      title: sourceBlocker?.requiredEnv || 'No key blocker',
      detail: sourceBlocker?.impact || 'Official source blockers are not the current limiting factor.',
      proof: sourceBlocker?.setupNote || `${formatNumber(data.sourceCoverage?.length || 0)} sources represented`,
    },
  ];

  const firstHour = [
    topAction?.action || data.executiveSummary?.immediateActions?.[0] || 'Review top signal and pick one verification call.',
    topLane?.operatorAction || 'Check active gadi flow and confirm whether movement repeats today.',
    topMission
      ? `Complete ${topMission.callTargets.length} calls in ${topMission.timeBoxMinutes} minutes.`
      : 'Capture field feedback for the top commodity/state.',
  ];

  const watchouts = [
    data.executiveSummary?.watchouts?.[0] || topRisk,
    sourceBlocker
      ? `Configure ${sourceBlocker.requiredEnv} to unlock stronger official price corroboration.`
      : data.quality?.blindSpots?.[0] || 'Keep public-source corroboration attached to every major decision.',
  ];

  const headline = [
    topCommodity ? `${topCommodity.commodity}` : null,
    topState ? `${topState.state}` : null,
    topLane ? `${formatNumber(topLane.activeTrips)} active gadi` : null,
    data.totals.gmv ? formatMoney(data.totals.gmv) : null,
  ].filter(Boolean).join(' · ') || 'MandiPlus operating brief';

  return { headline, cards, firstHour, watchouts };
}

function callTargetDetail(
  person:
    | NonNullable<MarketPulseData['callMissions'][number]['callTargets'][number]>
    | NonNullable<MarketPulseData['peopleToCall'][number]>
    | null,
  fallback: string | undefined,
) {
  if (!person) return fallback || 'No call script generated.';
  if ('ask' in person && person.ask) return person.ask;
  if ('suggestedAction' in person && person.suggestedAction) return person.suggestedAction;
  if ('reason' in person && person.reason) return person.reason;
  return fallback || 'No call script generated.';
}

function exportBrief(brief: ReturnType<typeof buildBrief>) {
  downloadCsv(
    'mandiplus-morning-operating-brief',
    ['Section', 'Title', 'Detail', 'Proof'],
    [
      ...brief.cards.map((card) => [card.label, card.title, card.detail, card.proof]),
      ...brief.firstHour.map((item, index) => [`First 60 minutes ${index + 1}`, item, '', '']),
      ...brief.watchouts.map((item, index) => [`Watchout ${index + 1}`, item, '', '']),
    ],
  );
}

async function copyBrief(
  brief: ReturnType<typeof buildBrief>,
  setCopied: (value: boolean) => void,
) {
  const text = [
    `MandiPlus Morning Operating Brief: ${brief.headline}`,
    ...brief.cards.map((card) => `${card.label}: ${card.title}. ${card.detail} Proof: ${card.proof}`),
    `First 60 minutes: ${brief.firstHour.join(' | ')}`,
    `Watchouts: ${brief.watchouts.join(' | ')}`,
  ].join('\n');

  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  } catch {
    setCopied(false);
  }
}
