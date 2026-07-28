import { SourceBacklogRow, SourceCoverageRow, SourceNeedRow } from '../types';
import { formatEnumLabel, formatNumber } from '../formatters';

export function SourceCoverage({
  coverage,
  backlog,
  needs,
}: {
  coverage: SourceCoverageRow[];
  backlog: SourceBacklogRow[];
  needs?: SourceNeedRow[];
}) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">Source Lab</h2>
        <p className="text-sm text-slate-500">Current internal coverage and next official feeds to wire.</p>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-3">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Internal coverage
          </div>
          {coverage.map((row) => (
            <div key={row.source} className="flex items-center justify-between border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">{row.source}</span>
              <span className={row.status === 'active' ? 'text-emerald-700' : 'text-slate-500'}>
                {formatNumber(row.records)} records
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Source readiness
          </div>
          {(needs || []).map((row) => (
            <div key={row.key} className="border border-slate-100 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-900">{row.name}</span>
                <span
                  className={
                    row.status === 'ready'
                      ? 'text-xs font-semibold uppercase text-emerald-700'
                      : 'text-xs font-semibold uppercase text-amber-700'
                  }
                >
                  {row.status}
                </span>
              </div>
              {row.requiredEnv && (
                <div className="mt-1 font-mono text-xs font-semibold text-slate-600">
                  {row.requiredEnv}
                </div>
              )}
              <div className="mt-1 text-xs text-slate-500">{row.impact}</div>
              {row.status !== 'ready' && row.setupNote && (
                <div className="mt-2 border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                  {row.setupNote}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Next feeds
          </div>
          {backlog.slice(0, 7).map((row) => (
            <div key={row.name} className="border border-slate-100 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-900">{row.name}</span>
                <span className="text-xs text-slate-500">T{row.trustTier}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-semibold uppercase">
                {row.connectorStatus && (
                  <span className={sourceStatusClass(row.connectorStatus)}>
                    {formatEnumLabel(row.connectorStatus)}
                  </span>
                )}
                {row.accessModel && (
                  <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                    {formatEnumLabel(row.accessModel)}
                  </span>
                )}
                {row.recommendedCadence && (
                  <span className="border border-slate-200 bg-white px-2 py-0.5 text-slate-500">
                    {row.recommendedCadence}
                  </span>
                )}
              </div>
              <div className="mt-1 text-slate-600">{row.useCase}</div>
              {row.signalValue && (
                <div className="mt-1 text-xs leading-5 text-slate-500">{row.signalValue}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function sourceStatusClass(status: NonNullable<SourceBacklogRow['connectorStatus']>) {
  if (status === 'implemented') {
    return 'border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800';
  }
  if (status === 'ready_to_build') {
    return 'border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-800';
  }
  return 'border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800';
}
