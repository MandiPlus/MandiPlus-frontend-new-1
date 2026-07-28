import { MarketOpportunity } from '../types';
import { formatEnumLabel, formatMoney, formatNumber, severityClass } from '../formatters';

export function OpportunityDesk({ opportunities }: { opportunities: MarketOpportunity[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Opportunity Desk</h2>
          <p className="text-sm text-slate-500">
            Ranked market moves using value, urgency, confidence, routes, and call readiness.
          </p>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {formatNumber(opportunities.length)} ranked
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No ranked opportunities for this filter yet.
        </div>
      ) : (
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          {opportunities.slice(0, 6).map((item) => (
            <article key={item.id} className="border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {formatEnumLabel(item.opportunityType)}
                    {item.commodity ? ` · ${item.commodity}` : ''}
                    {item.state ? ` · ${item.state}` : ''}
                  </div>
                </div>
                <span className={`border px-2 py-1 text-xs font-semibold ${severityClass(item.priority)}`}>
                  {item.priority.toUpperCase()} · {item.score}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Metric label="Value" value={formatMoney(item.commercialValue)} />
                <Metric label="Urgency" value={`${item.urgencyScore}/100`} />
                <Metric label="Confidence" value={`${item.confidenceScore}/100`} />
              </div>

              <div className="mt-3 border border-emerald-100 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Why now
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-800">{item.whyNow}</div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Execution
                  </div>
                  <ol className="mt-2 space-y-2">
                    {item.executionPlan.slice(0, 3).map((step, index) => (
                      <li key={`${item.id}-step-${index}`} className="flex gap-2 text-sm leading-5 text-slate-700">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-slate-900 text-[11px] font-semibold text-white">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Call targets
                  </div>
                  {item.callTargets.length === 0 ? (
                    <div className="mt-2 border border-slate-100 bg-white p-3 text-sm text-slate-500">
                      No direct target mapped.
                    </div>
                  ) : (
                    <div className="mt-2 divide-y divide-slate-100 border border-slate-100 bg-white">
                      {item.callTargets.slice(0, 3).map((person) => (
                        <div key={`${item.id}-${person.userId}`} className="px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-950">{person.name}</span>
                            <span className="text-xs font-semibold text-slate-600">{person.mobileNumber}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{person.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
                <div className="border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Verify On Call
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {item.verificationQuestions.slice(0, 4).map((question) => (
                      <li key={`${item.id}-${question}`} className="text-sm leading-5 text-slate-700">
                        {question}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-2">
                  <DecisionBlock
                    title="Confirm If"
                    items={item.confirmationCriteria.slice(0, 2)}
                    tone="confirm"
                  />
                  <DecisionBlock
                    title="Reject If"
                    items={item.rejectionCriteria.slice(0, 2)}
                    tone="reject"
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                {item.proof.slice(0, 4).map((proof) => (
                  <Metric key={`${item.id}-${proof.label}`} label={proof.label} value={proof.value} />
                ))}
              </div>

              {item.risks.length > 0 && (
                <div className="mt-3 text-xs leading-5 text-slate-500">
                  Risk: {item.risks[0]}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DecisionBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'confirm' | 'reject';
}) {
  const className =
    tone === 'confirm'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-900'
      : 'border-red-100 bg-red-50 text-red-900';

  return (
    <div className={`border p-2 ${className}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide">{title}</div>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={`${title}-${item}`} className="text-xs leading-4">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}
