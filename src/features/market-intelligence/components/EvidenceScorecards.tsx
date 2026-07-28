import { MarketEvidenceScorecard } from '../types';
import { formatEnumLabel, formatNumber } from '../formatters';

function statusClass(status: MarketEvidenceScorecard['status']) {
  if (status === 'actionable') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'verify') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-red-200 bg-red-50 text-red-800';
}

function strengthClass(strength: 'strong' | 'medium' | 'weak') {
  if (strength === 'strong') return 'border-slate-900 bg-slate-900 text-white';
  if (strength === 'medium') return 'border-slate-300 bg-white text-slate-800';
  return 'border-red-200 bg-red-50 text-red-800';
}

export function EvidenceScorecards({
  scorecards,
}: {
  scorecards: MarketEvidenceScorecard[];
}) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Evidence Scorecards</h2>
          <p className="text-sm text-slate-500">
            Trust level, missing proof, and first verification step for the top market moves.
          </p>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {formatNumber(scorecards.length)} scored
        </div>
      </div>

      {scorecards.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No scorecards yet. Opportunities need to be generated before evidence quality can be ranked.
        </div>
      ) : (
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          {scorecards.slice(0, 6).map((item) => (
            <article key={item.id} className="border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {formatEnumLabel(item.signalType)}
                    {item.commodity ? ` · ${item.commodity}` : ''}
                    {item.state ? ` · ${item.state}` : ''}
                  </div>
                </div>
                <span className={`border px-2 py-1 text-xs font-semibold uppercase ${statusClass(item.status)}`}>
                  {item.status} · {item.score}
                </span>
              </div>

              <div className="mt-3 border border-emerald-100 bg-white p-3 text-sm leading-6 text-slate-800">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Operator decision
                </div>
                <div className="mt-1">{item.operatorDecision}</div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[0.85fr_1fr]">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Evidence mix
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.evidenceMix.slice(0, 6).map((evidence) => (
                      <span
                        key={`${item.id}-${evidence.source}`}
                        className={`border px-2 py-1 text-xs font-semibold ${strengthClass(evidence.strength)}`}
                      >
                        {evidence.source} · {evidence.count}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Verify first
                  </div>
                  <div className="mt-2 border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-5 text-slate-800">
                    {item.nextVerificationStep}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ListBlock title="Corroboration" items={item.corroboration} emptyText="No corroborating proof yet." />
                <ListBlock title="Missing / Risk" items={[...item.missingEvidence, ...item.contradictionRisks].slice(0, 5)} emptyText="No major gaps flagged." />
              </div>

              {item.sourceGaps.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Source gaps
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {item.sourceGaps.slice(0, 4).map((gap) => (
                      <div
                        key={`${item.id}-${gap.sourceKey}-${gap.blockerType}`}
                        className="border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-slate-950">{gap.label}</div>
                          <span className={`border px-2 py-0.5 text-[11px] font-semibold uppercase ${gapSeverityClass(gap.severity)}`}>
                            {gap.severity}
                          </span>
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-slate-400">
                          {gap.sourceKey} · {formatEnumLabel(gap.blockerType)}
                        </div>
                        <div className="mt-2 text-xs leading-5 text-slate-600">{gap.impact}</div>
                        <div className="mt-2 border border-amber-100 bg-amber-50 px-2 py-1 text-xs leading-5 text-amber-900">
                          {gap.nextAction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function gapSeverityClass(severity: 'high' | 'medium' | 'low') {
  if (severity === 'high') return 'border-red-200 bg-red-50 text-red-800';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function ListBlock({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="mt-2 border border-slate-100 bg-white px-3 py-2 text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {items.slice(0, 4).map((item) => (
            <div key={`${title}-${item}`} className="border border-slate-100 bg-white px-3 py-2 text-sm leading-5 text-slate-700">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
