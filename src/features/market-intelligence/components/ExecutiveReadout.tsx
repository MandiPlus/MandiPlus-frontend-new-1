import { MarketExecutiveSummary } from '../types';
import { formatNumber } from '../formatters';

export function ExecutiveReadout({ summary }: { summary: MarketExecutiveSummary }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_0.9fr]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Deterministic Readout
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{summary.headline}</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            <Metric label="Signals" value={formatNumber(summary.generatedFrom.signalCount)} />
            <Metric label="Opportunities" value={formatNumber(summary.generatedFrom.opportunityCount)} />
            <Metric label="Missions" value={formatNumber(summary.generatedFrom.missionCount)} />
            <Metric label="Routes" value={formatNumber(summary.generatedFrom.routeCount)} />
          </div>
          <div className="mt-4 space-y-2">
            {summary.readout.slice(0, 4).map((item) => (
              <div key={item} className="border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
          <ListBlock title="Immediate Actions" items={summary.immediateActions} />
          <ListBlock title="Watchouts" items={summary.watchouts} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 space-y-2">
        {items.slice(0, 5).map((item) => (
          <div key={`${title}-${item}`} className="border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-700">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
