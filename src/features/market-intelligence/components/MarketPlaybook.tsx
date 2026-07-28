import { MarketPlay } from '../types';
import { formatEnumLabel, severityClass } from '../formatters';

export function MarketPlaybook({ plays }: { plays: MarketPlay[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">Market Plays</h2>
        <p className="text-sm text-slate-500">Concrete moves synthesized from rates, regions, gadi flow, and people to call.</p>
      </div>
      {plays.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No high-conviction market plays for this filter yet.
        </div>
      ) : (
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          {plays.map((play) => (
            <article key={play.id} className="border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{play.title}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {formatEnumLabel(play.playType)}
                    {play.commodity ? ` · ${play.commodity}` : ''}
                    {play.state ? ` · ${play.state}` : ''}
                  </div>
                </div>
                <span className={`border px-2 py-1 text-xs font-semibold ${severityClass(play.priority)}`}>
                  {play.priority.toUpperCase()} · {Math.round(play.score)}
                </span>
              </div>

              <div className="mt-3 space-y-3 text-sm text-slate-700">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Thesis</div>
                  <div className="mt-1">{play.thesis}</div>
                </div>
                <div className="border border-emerald-100 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Action</div>
                  <div className="mt-1 text-slate-800">{play.recommendedAction}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Expected value</div>
                  <div className="mt-1">{play.expectedValue}</div>
                </div>
              </div>

              {play.proof.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {play.proof.slice(0, 3).map((item) => (
                    <div key={`${play.id}-${item.label}`} className="border border-slate-200 bg-white p-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {item.label}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">{item.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {play.callList.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Call targets
                  </div>
                  <div className="mt-2 divide-y divide-slate-200 border border-slate-200 bg-white">
                    {play.callList.slice(0, 3).map((person) => (
                      <div key={`${play.id}-${person.userId}`} className="px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium text-slate-950">{person.name}</div>
                          <div className="text-xs font-semibold text-slate-600">{person.mobileNumber}</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{person.reason}</div>
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
