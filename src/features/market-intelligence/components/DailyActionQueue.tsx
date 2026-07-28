import { MarketDailyAction } from '../types';
import { formatEnumLabel, formatNumber, severityClass } from '../formatters';
import { downloadCsv } from '../exporters';

function actionTypeClass(type: MarketDailyAction['actionType']) {
  if (type === 'CALL_MISSION') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (type === 'LANE_ACTION') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (type === 'EVIDENCE_CHECK') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function DailyActionQueue({ actions }: { actions: MarketDailyAction[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Today&apos;s Action Queue</h2>
          <p className="text-sm text-slate-500">
            Ranked worklist for operators: calls, lane actions, evidence checks, and source setup.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportActions(actions)}
            disabled={actions.length === 0}
            className="border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export CSV
          </button>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {formatNumber(actions.length)} actions
          </div>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No actions generated for this filter.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {actions.slice(0, 10).map((item) => (
            <article key={item.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[64px_1fr_0.9fr]">
              <div>
                <div className="flex h-11 w-11 items-center justify-center bg-slate-950 text-sm font-semibold text-white">
                  #{item.rank}
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-500">{item.score}/100</div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`border px-2 py-1 text-[11px] font-semibold uppercase ${actionTypeClass(item.actionType)}`}>
                    {formatEnumLabel(item.actionType)}
                  </span>
                  <span className={`border px-2 py-1 text-[11px] font-semibold uppercase ${severityClass(item.priority)}`}>
                    {item.priority}
                  </span>
                  <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                    {item.ownerHint}
                  </span>
                  <span className="border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                    {item.deadline}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.whyNow}</p>
                {(item.commodity || item.state || item.route) && (
                  <div className="mt-2 flex flex-wrap gap-1 text-xs font-semibold text-slate-600">
                    {item.commodity && <span className="border border-slate-200 bg-white px-2 py-1">{item.commodity}</span>}
                    {item.state && <span className="border border-slate-200 bg-white px-2 py-1">{item.state}</span>}
                    {item.route && (
                      <span className="border border-slate-200 bg-white px-2 py-1">
                        {item.route.source} → {item.route.destination}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <div className="border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm leading-5 text-emerald-950">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Do this
                  </div>
                  <div className="mt-1">{item.action}</div>
                </div>
                <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-700">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Success metric
                  </div>
                  <div className="mt-1">{item.successMetric}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function exportActions(actions: MarketDailyAction[]) {
  downloadCsv(
    'mandiplus-market-action-queue',
    [
      'Rank',
      'Type',
      'Priority',
      'Score',
      'Owner',
      'Deadline',
      'Title',
      'Why Now',
      'Action',
      'Success Metric',
      'Commodity',
      'State',
      'Route',
    ],
    actions.map((item) => [
      item.rank,
      item.actionType,
      item.priority,
      item.score,
      item.ownerHint,
      item.deadline,
      item.title,
      item.whyNow,
      item.action,
      item.successMetric,
      item.commodity,
      item.state,
      item.route ? `${item.route.source} -> ${item.route.destination}` : '',
    ]),
  );
}
