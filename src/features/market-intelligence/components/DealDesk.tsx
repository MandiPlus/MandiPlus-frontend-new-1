import {
  MarketLaneScorecard,
  MarketOpportunity,
  PeopleToCallRow,
} from '../types';
import { formatMoney, formatNumber, severityClass } from '../formatters';
import { downloadCsv, phoneHref, whatsappHref } from '../exporters';

export function DealDesk({
  opportunities,
  lanes,
  people,
}: {
  opportunities: MarketOpportunity[];
  lanes: MarketLaneScorecard[];
  people: PeopleToCallRow[];
}) {
  const deals = opportunities.slice(0, 8).map((opportunity) => {
    const lane = opportunity.route
      ? lanes.find(
          (item) =>
            item.source === opportunity.route?.source &&
            item.destination === opportunity.route?.destination,
        )
      : null;
    const person =
      people.find((item) => {
        if (opportunity.commodity && item.recentCommodity === opportunity.commodity) return true;
        if (opportunity.state && item.state === opportunity.state) return true;
        return false;
      }) || people[0] || null;

    return {
      opportunity,
      lane,
      person,
      score: Math.min(
        100,
        Math.round(
          opportunity.score * 0.45 +
            opportunity.urgencyScore * 0.25 +
            opportunity.confidenceScore * 0.2 +
            (lane?.activeTrips || 0) * 2 +
            ((person?.priorityScore || 0) / 10),
        ),
      ),
    };
  });

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Deal Desk</h2>
          <p className="text-sm text-slate-500">
            One-row commercial plays: commodity, lane, person, action, and proof to verify.
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportDeals(deals)}
          disabled={deals.length === 0}
          className="w-fit border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
        >
          Export deals
        </button>
      </div>

      {deals.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No deal-ready opportunities for this scope yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {deals.map(({ opportunity, lane, person, score }, index) => (
            <article key={opportunity.id} className="px-4 py-4">
              <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr_0.85fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                      #{index + 1}
                    </span>
                    <span className={`border px-2 py-1 text-xs font-semibold ${severityClass(opportunity.priority)}`}>
                      {opportunity.priority.toUpperCase()} · {score}
                    </span>
                  </div>
                  <div className="mt-2 font-semibold text-slate-950">{opportunity.title}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-700">{opportunity.whyNow}</div>
                </div>

                <div className="grid gap-2 text-sm">
                  <Metric label="Value" value={formatMoney(opportunity.commercialValue)} />
                  <Metric label="Commodity" value={opportunity.commodity || '-'} />
                  <Metric
                    label="Lane"
                    value={
                      opportunity.route
                        ? `${opportunity.route.source} -> ${opportunity.route.destination}`
                        : opportunity.state || '-'
                    }
                  />
                  {lane && (
                    <Metric
                      label="Gadi"
                      value={`${formatNumber(lane.vehicleCount)} total, ${formatNumber(lane.activeTrips)} active`}
                    />
                  )}
                </div>

                <div>
                  <div className="border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-950">
                    {opportunity.executionPlan[0] || 'Verify market movement before assigning execution.'}
                  </div>
                  {person && (
                    <div className="mt-2 border border-slate-200 bg-slate-50 p-3">
                      <div className="font-medium text-slate-950">{person.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {person.roleCategory || person.identity || 'contact'} · {person.state} · {person.recentCommodity || '-'}
                      </div>
                      <div className="mt-2 flex gap-1 text-xs font-semibold">
                        <a href={phoneHref(person.mobileNumber)} className="border border-slate-200 bg-white px-2 py-1 text-slate-700">
                          Call
                        </a>
                        <a
                          href={whatsappHref(person.mobileNumber, person.callObjective || person.suggestedAction)}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-emerald-200 bg-white px-2 py-1 text-emerald-800"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {opportunity.verificationQuestions.slice(0, 3).map((question) => (
                  <div key={`${opportunity.id}-${question}`} className="border border-slate-200 bg-white p-2 text-xs leading-5 text-slate-600">
                    {question}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function exportDeals(
  deals: Array<{
    opportunity: MarketOpportunity;
    lane: MarketLaneScorecard | null | undefined;
    person: PeopleToCallRow | null;
    score: number;
  }>,
) {
  downloadCsv(
    'mandiplus-deal-desk',
    [
      'rank',
      'title',
      'priority',
      'deal_score',
      'commodity',
      'state',
      'route',
      'commercial_value',
      'urgency',
      'confidence',
      'gadi',
      'active_trips',
      'call_target',
      'mobile',
      'action',
      'questions',
    ],
    deals.map((deal, index) => [
      index + 1,
      deal.opportunity.title,
      deal.opportunity.priority,
      deal.score,
      deal.opportunity.commodity,
      deal.opportunity.state,
      deal.opportunity.route
        ? `${deal.opportunity.route.source} -> ${deal.opportunity.route.destination}`
        : '',
      deal.opportunity.commercialValue,
      deal.opportunity.urgencyScore,
      deal.opportunity.confidenceScore,
      deal.lane?.vehicleCount,
      deal.lane?.activeTrips,
      deal.person?.name,
      deal.person?.mobileNumber,
      deal.opportunity.executionPlan[0],
      deal.opportunity.verificationQuestions.join(' | '),
    ]),
  );
}
