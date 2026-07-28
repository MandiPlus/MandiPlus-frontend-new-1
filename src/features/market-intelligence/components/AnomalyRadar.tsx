import { MarketAnomaly } from '../types';
import { formatEnumLabel, formatNumber, formatPct, severityClass } from '../formatters';

export function AnomalyRadar({ anomalies }: { anomalies: MarketAnomaly[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">Anomaly Radar</h2>
        <p className="text-sm text-slate-500">Unusual shifts versus the previous comparable period.</p>
      </div>
      {anomalies.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No unusual commodity or route movements detected for this filter.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {anomalies.slice(0, 8).map((anomaly) => (
            <article key={anomaly.id} className="px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{anomaly.title}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {formatEnumLabel(anomaly.anomalyType)}
                  </div>
                </div>
                <span className={`border px-2 py-1 text-xs font-semibold ${severityClass(anomaly.severity)}`}>
                  {anomaly.severity.toUpperCase()} · {Math.round(anomaly.score)}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Metric label="Current" value={formatNumber(anomaly.currentValue)} />
                <Metric label="Previous" value={formatNumber(anomaly.previousValue)} />
                <Metric label="Change" value={formatPct(anomaly.changePct)} />
              </div>

              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div className="border border-slate-100 bg-slate-50 p-3 text-slate-700">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What changed</div>
                  <div className="mt-1">{anomaly.explanation}</div>
                </div>
                <div className="border border-amber-100 bg-amber-50 p-3 text-slate-800">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Verify now</div>
                  <div className="mt-1">{anomaly.recommendedAction}</div>
                </div>
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
    <div className="border border-slate-200 bg-slate-50 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}
