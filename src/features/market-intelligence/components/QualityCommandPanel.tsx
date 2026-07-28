import { MarketQualitySnapshot } from '../types';
import { formatEnumLabel, formatNumber } from '../formatters';

function statusClass(status: MarketQualitySnapshot['status'] | 'strong' | 'watch' | 'weak') {
  if (status === 'strong') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'blind' || status === 'weak') return 'border-red-200 bg-red-50 text-red-800';
  if (status === 'watch' || status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function QualityCommandPanel({ quality }: { quality: MarketQualitySnapshot }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-4 border-b border-slate-200 p-4 xl:grid-cols-[260px_1fr]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Signal Quality
          </div>
          <div className="mt-2 flex items-end gap-2">
            <div className="text-4xl font-semibold text-slate-950">
              {formatNumber(quality.overallScore)}
            </div>
            <div className="pb-1 text-sm font-medium text-slate-500">/ 100</div>
          </div>
          <span className={`mt-3 inline-flex border px-2 py-1 text-xs font-semibold uppercase ${statusClass(quality.status)}`}>
            {quality.status}
          </span>
        </div>
        <div>
          <p className="text-sm leading-6 text-slate-700">{quality.summary}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {quality.dimensions.map((item) => (
              <div key={item.key} className="border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-950">{item.label}</div>
                  <span className={`border px-2 py-0.5 text-[11px] font-semibold uppercase ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-slate-200">
                  <div
                    className="h-1.5 bg-slate-950"
                    style={{ width: `${Math.max(4, Math.min(100, item.score))}%` }}
                  />
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-600">{item.evidence}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr_0.8fr]">
        <ListBlock title="Next Actions" items={quality.nextActions} emptyText="No urgent actions." />
        <ListBlock title="Blind Spots" items={quality.blindSpots} emptyText="No major blind spots detected." />
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Signal Mix
          </div>
          <div className="mt-2 divide-y divide-slate-100 border border-slate-100">
            {quality.signalMix.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No signals yet.</div>
            ) : (
              quality.signalMix.slice(0, 6).map((item) => (
                <div key={item.type} className="grid grid-cols-[1fr_50px_54px] gap-2 px-3 py-2 text-xs">
                  <span className="truncate font-medium text-slate-800">{formatEnumLabel(item.type)}</span>
                  <span className="text-right text-slate-600">{item.count}</span>
                  <span className="text-right text-slate-500">{item.avgScore}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
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
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {items.length === 0 ? (
        <div className="mt-2 border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {items.slice(0, 6).map((item) => (
            <div key={item} className="border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-700">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
